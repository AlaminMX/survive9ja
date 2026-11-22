begin;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('gist-voice-notes','gist-voice-notes',false,2097152,
  array['audio/webm','audio/mp4','audio/ogg','audio/mpeg','audio/wav','audio/x-wav','audio/aac','audio/x-m4a'])
on conflict (id) do update set
  public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create table if not exists community_private.gist_voice_notes (
  path text primary key,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  entry_id uuid unique references community_private.entries(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table community_private.gist_voice_notes enable row level security;
revoke all on community_private.gist_voice_notes from public,anon,authenticated;

create or replace function public.reserve_gist_voice_note() returns text
language plpgsql security definer set search_path='' as $$
declare member uuid; object_path text;
begin
  member := community_private.require_member();
  perform community_private.take_slot(member,'gist_voice_upload',15);
  object_path := member::text||'/'||gen_random_uuid()::text;
  insert into community_private.gist_voice_notes(path,owner_id) values(object_path,member);
  return object_path;
end $$;

create or replace function public.gist_voice_object_allowed(p_path text,p_operation text) returns boolean
language sql stable security definer set search_path='' as $$
  select exists (
    select 1 from community_private.gist_voice_notes v
    left join community_private.entries e on e.id=v.entry_id
    where v.path=p_path and (
      (v.entry_id is null and v.owner_id=auth.uid() and community_private.verified() and (
        p_operation='delete' or (p_operation in ('read','insert') and v.created_at>now()-interval '1 day')
      ))
      or (p_operation='read' and e.id is not null
        and (community_private.visible(e) or community_private.has_moderator_role()))
    )
  )
$$;

drop policy if exists gist_voice_insert on storage.objects;
create policy gist_voice_insert on storage.objects for insert to authenticated
  with check (bucket_id='gist-voice-notes' and public.gist_voice_object_allowed(name,'insert'));
drop policy if exists gist_voice_read on storage.objects;
create policy gist_voice_read on storage.objects for select to anon,authenticated
  using (bucket_id='gist-voice-notes' and (
    (storage.allow_only_operation('storage.object.get_authenticated') and public.gist_voice_object_allowed(name,'read'))
    or (storage.allow_only_operation('storage.object.delete_many') and public.gist_voice_object_allowed(name,'delete'))
  ));
drop policy if exists gist_voice_delete_draft on storage.objects;
create policy gist_voice_delete_draft on storage.objects for delete to authenticated
  using (bucket_id='gist-voice-notes' and public.gist_voice_object_allowed(name,'delete'));

create or replace function public.publish_gist_with_voice(
  p_path text,p_title text,p_body text,p_category text,p_circle text default '',
  p_circle_name text default null,p_circle_description text default null
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare member uuid; clip community_private.gist_voice_notes; published uuid; circle_slug text;
begin
  member := community_private.require_member();
  select * into clip from community_private.gist_voice_notes where path=p_path and owner_id=member for update;
  if not found then raise exception 'Upload a voice note first.'; end if;
  if clip.entry_id is not null then
    select c.slug into circle_slug from community_private.entries e
      join community_private.circles c on c.id=e.circle_id where e.id=clip.entry_id;
    return jsonb_build_object('id',clip.entry_id,'circle_slug',circle_slug);
  end if;
  if clip.created_at<=now()-interval '1 day' then raise exception 'This upload expired. Attach the audio again.'; end if;
  perform 1 from storage.objects where bucket_id='gist-voice-notes' and name=p_path for share;
  if not found then raise exception 'The voice note upload is missing.'; end if;
  if p_circle_name is not null then
    circle_slug := public.create_circle(p_circle_name,p_circle_description,p_title,p_body,p_category);
    select e.id into strict published from community_private.entries e
      join community_private.circles c on c.id=e.circle_id where c.slug=circle_slug;
  elsif nullif(p_circle,'') is not null then
    circle_slug := p_circle;
    published := public.publish_circle_post(circle_slug,p_title,p_body,p_category);
  else
    published := public.publish_entry('square',p_title,p_body,p_category,false);
  end if;
  update community_private.gist_voice_notes set entry_id=published where path=p_path;
  return jsonb_build_object('id',published,'circle_slug',circle_slug);
end $$;

-- An authenticated storage request rechecks visibility on each download.
-- Expose the path only through existing public-entry and moderator review payloads.
create or replace function community_private.entry_fields(e community_private.entries) returns jsonb
language sql stable set search_path='' as $$
  select jsonb_build_object(
    'id',e.id,'kind',e.kind,'title',e.title,'body',e.body,'category',e.category,
    'created_at',e.created_at,'parent_id',e.parent_id,'anonymous',e.anonymous,
    'author',case when not e.anonymous then (
      select community_private.profile_fields(p) from public.profiles p where p.id=e.owner_id
    ) end,
    'owned',not e.anonymous and coalesce(e.owner_id=auth.uid(),false),
    'system_seed',e.system_seed,
    'voice_note',(select v.path from community_private.gist_voice_notes v where v.entry_id=e.id),
    'circle',(select jsonb_build_object('slug',c.slug,'name',c.name)
      from community_private.circles c where c.id=e.circle_id and not c.archived),
    'replies',(select count(*) from community_private.entries r where r.root_id=e.id and community_private.visible(r)),
    'reactions',(select count(*) from community_private.reactions r where r.target_id=e.id),
    'relate',(select count(*) from community_private.reactions r where r.target_id=e.id and r.reaction='I relate'),
    'mine',(select reaction from community_private.reactions r where r.target_id=e.id and r.user_id=auth.uid())
  )
$$;
revoke all on function community_private.entry_fields(community_private.entries) from public,anon,authenticated;

create or replace function community_private.review_fields(r community_private.reports) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id',r.id,'target_id',e.id,'reason',r.reason,'note',r.note,'body',e.body,
    'title',coalesce(e.title,root.title),'root_id',e.root_id,'root_body',root.body,
    'kind',e.kind,'system_seed',e.system_seed,'anonymous',e.anonymous,'hidden',not community_private.visible(e),'target_hidden',e.hidden,
    'parent_hidden',not e.hidden and not community_private.visible(e),
    'voice_note',(select v.path from community_private.gist_voice_notes v where v.entry_id=coalesce(e.root_id,e.id)),
    'banned',exists(select 1 from community_private.bans b where b.user_id=e.owner_id),
    'created_at',r.created_at
  )
  from community_private.entries e left join community_private.entries root on root.id=e.root_id
  where e.id=r.target_id
$$;

create or replace function public.admin_delete_account(p_target uuid,p_note text) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform community_private.require_admin();
  perform 1 from auth.users where id=p_target for update;
  perform 1 from public.profiles where id=p_target for update;
  perform public.admin_check_account_deletion(p_target,p_note);
  if exists(select 1 from storage.objects where bucket_id in ('survive9ja-avatars','gist-voice-notes') and name like p_target::text||'/%')
    then raise exception 'Uploaded media must be removed before deleting this account.'; end if;
  delete from auth.users where id=p_target;
  insert into community_private.moderation_log(actor,target_id,action,note)
    values(auth.uid(),p_target,'delete_account',btrim(p_note));
end $$;

revoke all on function public.reserve_gist_voice_note(),public.gist_voice_object_allowed(text,text),
  public.publish_gist_with_voice(text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.gist_voice_object_allowed(text,text) to anon,authenticated;
grant execute on function public.reserve_gist_voice_note(),public.publish_gist_with_voice(text,text,text,text,text,text,text) to authenticated;

commit;
