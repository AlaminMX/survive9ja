begin;
create table if not exists community_private.pilot_config (
  singleton boolean primary key default true check (singleton),
  anonymous_diaries boolean not null default false
);
insert into community_private.pilot_config(singleton) values(true) on conflict do nothing;
alter table community_private.pilot_config enable row level security;
revoke all on community_private.pilot_config from public,anon,authenticated;

create or replace function community_private.validate_diary_tag(value text) returns void
language plpgsql immutable set search_path = '' as $$
begin
  if value is null or value not in ('Hustle','Education','Money','Health System','Transport','Light & Power','Relocation','Wins')
    then raise exception 'Choose a valid story tag.'; end if;
end $$;

create or replace function public.publish_entry(p_kind text,p_title text,p_body text,p_category text,p_anonymous boolean default false) returns uuid
language plpgsql security definer set search_path = '' as $$
declare member uuid; result uuid;
begin
  member := community_private.require_member();
  if p_kind='diary' then
    if not exists(select 1 from auth.users where id=member and created_at<=statement_timestamp()-interval '24 hours')
      then raise exception 'You can publish diaries 24 hours after creating your account.'; end if;
    perform community_private.validate_diary_tag(p_category);
    if coalesce(p_anonymous,false) and not exists(select 1 from community_private.pilot_config where singleton and anonymous_diaries)
      then raise exception 'Anonymous publishing is currently disabled.'; end if;
    perform community_private.take_slot(member,'diary',5);
  elsif p_kind='square' then
    if coalesce(p_anonymous,false) then raise exception 'Discussions are published under your public profile name.'; end if;
    perform community_private.validate_square_category(p_category);
    perform community_private.take_slot(member,'square',10);
  else raise exception 'Choose a valid publication type.';
  end if;
  insert into community_private.entries(kind,owner_id,title,body,category,anonymous)
  values(p_kind,member,btrim(p_title),btrim(p_body),p_category,coalesce(p_anonymous,false)) returning id into result;
  return result;
end $$;

create or replace function public.diary_capabilities() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select anonymous_diaries from community_private.pilot_config where singleton),false)
$$;

create or replace function public.editable_diary(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform community_private.require_member(true);
  return (select jsonb_build_object('id',id,'title',title,'body',body,'category',category,'anonymous',anonymous)
    from community_private.entries where id=p_id and owner_id=auth.uid() and kind='diary' and root_id is null and not hidden);
end $$;

create or replace function public.my_diaries() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform community_private.require_member(true);
  return (select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'title',e.title,'hidden',e.hidden,'anonymous',e.anonymous)
    order by e.created_at desc,e.id desc),'[]'::jsonb)
    from community_private.entries e where e.owner_id=auth.uid() and e.kind='diary' and e.root_id is null);
end $$;

create or replace function public.edit_diary(p_id uuid,p_title text,p_body text,p_category text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare member uuid; result uuid;
begin
  member := community_private.require_member();
  perform community_private.validate_diary_tag(p_category);
  update community_private.entries set title=btrim(p_title),body=btrim(p_body),category=p_category
    where id=p_id and owner_id=member and kind='diary' and root_id is null and not hidden returning id into result;
  if result is null then raise exception 'This story is unavailable for editing.'; end if;
  return result;
end $$;

create or replace function public.reported_diary_author(p_report uuid,p_note text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare item community_private.entries; public_identity jsonb;
begin
  perform community_private.require_moderator();
  if p_note is null or char_length(btrim(p_note)) not between 1 and 1000 then raise exception 'Add a reason for the identity lookup.'; end if;
  select e.* into item from community_private.reports r
    join community_private.entries e on e.id=r.target_id where r.id=p_report and e.kind='diary' and e.anonymous;
  if not found then raise exception 'No anonymous diary is attached to this report.'; end if;
  insert into community_private.moderation_log(actor,target_id,report_id,action,note)
    values(auth.uid(),item.id,p_report,'identity_lookup',btrim(p_note));
  select jsonb_build_object('account_id',p.id,'username',p.username,'display_name',p.display_name)
    into public_identity from public.profiles p where p.id=item.owner_id;
  return public_identity;
end $$;

revoke all on function community_private.validate_diary_tag(text),public.publish_entry(text,text,text,text,boolean),
 public.diary_capabilities(),public.editable_diary(uuid),public.my_diaries(),public.edit_diary(uuid,text,text,text),
 public.reported_diary_author(uuid,text) from public,anon,authenticated;
grant execute on function public.publish_entry(text,text,text,text,boolean),public.diary_capabilities(),
 public.editable_diary(uuid),public.my_diaries(),public.edit_diary(uuid,text,text,text),public.reported_diary_author(uuid,text) to authenticated;
commit;
