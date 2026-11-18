begin;
create or replace function community_private.require_moderator() returns void
language plpgsql set search_path = '' as $$
begin
  if not community_private.has_moderator_role() then
    raise exception 'Moderator access is required.' using errcode='42501';
  end if;
end $$;

create or replace function community_private.review_fields(r community_private.reports) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id',r.id,'target_id',e.id,'reason',r.reason,'note',r.note,'body',e.body,
    'title',coalesce(e.title,root.title),'root_id',e.root_id,'root_body',root.body,
    'kind',e.kind,'anonymous',e.anonymous,'hidden',not community_private.visible(e),'target_hidden',e.hidden,
    'parent_hidden',not e.hidden and not community_private.visible(e),
    'banned',exists(select 1 from community_private.bans b where b.user_id=e.owner_id),
    'created_at',r.created_at
  )
  from community_private.entries e left join community_private.entries root on root.id=e.root_id
  where e.id=r.target_id
$$;

create or replace function public.moderation_queue() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform community_private.require_moderator();
  return jsonb_build_object('open',(select count(*) from community_private.reports where closed_at is null),
    'hidden',(select count(*) from community_private.entries where hidden),
    'banned',(select count(*) from community_private.bans),
    'items',(select coalesce(jsonb_agg(community_private.review_fields(r) order by r.created_at,r.id),'[]'::jsonb)
      from (select * from community_private.reports where closed_at is null order by created_at,id limit 50) r));
end $$;

create or replace function public.moderation_review(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare item jsonb;
begin
  perform community_private.require_moderator();
  select community_private.review_fields(r) into item from community_private.reports r where r.id=p_id;
  if item is null then raise exception 'Report unavailable.'; end if;
  return item;
end $$;

create or replace function public.moderation_history() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform community_private.require_moderator();
  return (select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'reason',r.reason) order by r.closed_at desc),'[]'::jsonb)
    from (select id,reason,closed_at from community_private.reports where closed_at is not null order by closed_at desc,id desc limit 50) r);
end $$;

create or replace function public.moderate_entry(p_report uuid,p_action text,p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare item community_private.entries;
begin
  perform community_private.require_moderator();
  if p_note is null or char_length(btrim(p_note)) not between 1 and 1000 then raise exception 'Add a moderation note.'; end if;
  select e.* into item from community_private.reports r join community_private.entries e on e.id=r.target_id
    where r.id=p_report for update of r;
  if not found then raise exception 'Report unavailable.'; end if;
  if p_action in ('hide','restore') then
    update community_private.entries set hidden=(p_action='hide') where id=item.id;
  elsif p_action in ('ban','unban') then
    perform pg_advisory_xact_lock(hashtextextended(item.owner_id::text,19));
    if p_action='ban' then
      insert into community_private.bans(user_id) values(item.owner_id) on conflict do nothing;
    else delete from community_private.bans where user_id=item.owner_id;
    end if;
  elsif p_action='resolve' then
    update community_private.reports set closed_at=coalesce(closed_at,now()) where id=p_report;
  else raise exception 'Choose a valid moderation action.';
  end if;
  insert into community_private.moderation_log(actor,target_id,report_id,action,note)
    values(auth.uid(),item.id,p_report,p_action,btrim(p_note));
end $$;

revoke all on function community_private.require_moderator(),community_private.review_fields(community_private.reports),
  public.moderation_queue(),public.moderation_review(uuid),public.moderation_history(),public.moderate_entry(uuid,text,text) from public,anon,authenticated;
grant execute on function public.moderation_queue(),public.moderation_review(uuid),public.moderation_history(),
  public.moderate_entry(uuid,text,text) to authenticated;
commit;
