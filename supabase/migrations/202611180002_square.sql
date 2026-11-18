begin;
create schema if not exists community_private;
revoke all on schema community_private from public,anon,authenticated;

create table if not exists community_private.entries (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('square','diary')),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  root_id uuid references community_private.entries(id) on delete cascade,
  parent_id uuid references community_private.entries(id) on delete cascade,
  title text,
  body text not null,
  category text,
  anonymous boolean not null default false,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  check (parent_id is null or root_id is not null),
  check (not anonymous or (root_id is null and kind='diary')),
  check ((root_id is null and title is not null and char_length(btrim(title)) between 1 and 140
    and category is not null and char_length(btrim(body)) between 1 and case when kind='diary' then 20000 else 6000 end)
    or (root_id is not null and title is null and category is null and char_length(btrim(body)) between 1 and 2000))
);
create index if not exists entries_feed_idx on community_private.entries(kind,created_at desc,id desc) where root_id is null and not hidden;
create index if not exists entries_root_idx on community_private.entries(root_id,created_at,id);
create index if not exists entries_parent_idx on community_private.entries(parent_id);
create index if not exists entries_owner_idx on community_private.entries(owner_id,created_at desc);
create table if not exists community_private.reactions (
  target_id uuid references community_private.entries(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  reaction text not null check (reaction in ('Facts','Real','Support','I relate','Been there','Respect')),
  created_at timestamptz not null default now(),
  primary key (target_id,user_id)
);
create table if not exists community_private.bans (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists community_private.daily_usage (
  user_id uuid references public.profiles(id) on delete cascade,
  utc_day date not null,
  action text not null,
  used integer not null check (used>0),
  primary key(user_id,utc_day,action)
);
create table if not exists community_private.reports (
  id uuid primary key default gen_random_uuid(),
  target_id uuid not null references community_private.entries(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (reason in ('Sensitive or identifying information','Harassment','Spam','Harmful or misleading content','Other')),
  note text not null check (char_length(note)<=1000),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
create unique index if not exists reports_one_open_idx on community_private.reports(target_id,reporter_id) where closed_at is null;
create table if not exists community_private.moderation_log (
  id bigint generated always as identity primary key,
  actor uuid not null,
  target_id uuid not null,
  report_id uuid,
  action text not null,
  note text not null,
  created_at timestamptz not null default now()
);
alter table community_private.entries enable row level security;
alter table community_private.reactions enable row level security;
alter table community_private.bans enable row level security;
alter table community_private.daily_usage enable row level security;
alter table community_private.reports enable row level security;
alter table community_private.moderation_log enable row level security;
revoke all on all tables in schema community_private from public,anon,authenticated;

create or replace function community_private.require_member(p_allow_banned boolean default false) returns uuid
language plpgsql set search_path = '' as $$
declare member uuid := auth.uid();
begin
  if not community_private.verified() or not exists (
    select 1 from public.profiles where id=member and completed_at is not null
  ) then raise exception 'Use a verified account and complete onboarding first.'; end if;
  if not p_allow_banned then
    perform pg_advisory_xact_lock(hashtextextended(member::text,19));
    if exists(select 1 from community_private.bans where user_id=member) then
      raise exception 'This account is restricted from participating.';
    end if;
  end if;
  return member;
end $$;

create or replace function community_private.take_slot(p_user uuid,p_action text,p_limit integer) returns void
language plpgsql set search_path = '' as $$
declare used_count integer;
begin
  insert into community_private.daily_usage as usage(user_id,utc_day,action,used)
  values(p_user,(statement_timestamp() at time zone 'UTC')::date,p_action,1)
  on conflict (user_id,utc_day,action) do update set used=usage.used+1 where usage.used<p_limit
  returning used into used_count;
  if used_count is null then raise exception 'You have reached the daily limit of % for this action (UTC).',p_limit; end if;
end $$;

create or replace function community_private.visible(e community_private.entries) returns boolean
language sql stable set search_path = '' as $$
  select not e.hidden
    and (e.root_id is null or exists (select 1 from community_private.entries r where r.id=e.root_id and not r.hidden))
    and (e.parent_id is null or exists (select 1 from community_private.entries p where p.id=e.parent_id and not p.hidden))
$$;

create or replace function community_private.entry_fields(e community_private.entries) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id',e.id,'kind',e.kind,'title',e.title,'body',e.body,'category',e.category,
    'created_at',e.created_at,'parent_id',e.parent_id,'anonymous',e.anonymous,
    'author',case when not e.anonymous then (
      select community_private.profile_fields(p) from public.profiles p where p.id=e.owner_id
    ) end,
    'owned',not e.anonymous and coalesce(e.owner_id=auth.uid(),false),
    'replies',(select count(*) from community_private.entries r where r.root_id=e.id and community_private.visible(r)),
    'reactions',(select count(*) from community_private.reactions r where r.target_id=e.id),
    'relate',(select count(*) from community_private.reactions r where r.target_id=e.id and r.reaction='I relate'),
    'mine',(select reaction from community_private.reactions r where r.target_id=e.id and r.user_id=auth.uid())
  )
$$;

create or replace function community_private.validate_square_category(value text) returns void
language plpgsql immutable set search_path = '' as $$
begin
  if value is null or value not in ('Politics','Economy','Education','Jobs','Social','Everyday Life')
    then raise exception 'Choose a valid discussion category.'; end if;
end $$;

create or replace function public.publish_entry(p_kind text,p_title text,p_body text,p_category text,p_anonymous boolean default false) returns uuid
language plpgsql security definer set search_path = '' as $$
declare member uuid; result uuid;
begin
  member := community_private.require_member();
  if p_kind is distinct from 'square' or p_anonymous is distinct from false then raise exception 'Only named discussions are available.'; end if;
  perform community_private.validate_square_category(p_category);
  perform community_private.take_slot(member,'square',10);
  insert into community_private.entries(kind,owner_id,title,body,category)
  values(p_kind,member,btrim(p_title),btrim(p_body),p_category) returning id into result;
  return result;
end $$;

create or replace function public.publish_reply(p_entry uuid,p_parent uuid,p_body text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare member uuid; root_kind text; result uuid;
begin
  member := community_private.require_member();
  select e.kind into root_kind from community_private.entries e where e.id=p_entry and e.root_id is null and not e.hidden for share;
  if not found then raise exception 'This discussion or story is unavailable.'; end if;
  if p_parent is not null then
    perform 1 from community_private.entries e where e.id=p_parent and e.root_id=p_entry and e.parent_id is null and not e.hidden for share;
    if not found then raise exception 'That reply is unavailable or cannot be nested further.'; end if;
  end if;
  perform community_private.take_slot(member,'reply',60);
  insert into community_private.entries(kind,owner_id,root_id,parent_id,body)
  values(root_kind,member,p_entry,p_parent,btrim(p_body)) returning id into result;
  return result;
end $$;

create or replace function public.react_entry(p_id uuid,p_reaction text) returns void
language plpgsql security definer set search_path = '' as $$
declare member uuid; item_kind text;
begin
  member := community_private.require_member();
  select e.kind into item_kind from community_private.entries e where e.id=p_id and community_private.visible(e);
  if not found then raise exception 'This content is unavailable.'; end if;
  if p_reaction is null then
    delete from community_private.reactions where target_id=p_id and user_id=member;
  elsif (item_kind='square' and p_reaction in ('Facts','Real','Support'))
     or (item_kind='diary' and p_reaction in ('I relate','Been there','Respect')) then
    insert into community_private.reactions(target_id,user_id,reaction) values(p_id,member,p_reaction)
    on conflict (target_id,user_id) do update set reaction=excluded.reaction,created_at=now();
  else raise exception 'Choose a reaction for this type of content.';
  end if;
end $$;

create or replace function public.feed(
  p_kind text,p_category text default null,p_location text default 'all',
  p_rank text default 'latest',p_limit integer default 9,p_as_of timestamptz default now(),
  p_after_score numeric default null,p_after_date timestamptz default null,p_after_id uuid default null
) returns jsonb
language sql stable security definer set search_path = '' as $$
  with eligible as (
    select e,
      case when p_rank='trending' then (
        (select count(*) from community_private.reactions r where r.target_id=e.id and r.created_at<=p_as_of)
        + 2*(select count(*) from community_private.entries r where r.root_id=e.id and r.created_at<=p_as_of and community_private.visible(r))
      ) / power(extract(epoch from (p_as_of-e.created_at))/3600 + 2,1.5)
      else 0 end as score
    from community_private.entries e
    where e.kind=p_kind and e.root_id is null and not e.hidden
      and e.created_at<=least(p_as_of,now())
      and (p_category is null or e.category=p_category)
      and (p_rank<>'trending' or e.created_at>=p_as_of-interval '7 days')
      and (p_location='all' or (not e.anonymous and exists (
        select 1 from public.profiles p where p.id=e.owner_id and p.completed_at is not null
        and ((p_location='nigeria' and p.country='Nigeria') or (p_location='diaspora' and p.abroad))
      )))
  ), page as (
    select * from eligible
    where p_after_id is null or (score,(e).created_at,(e).id)<(p_after_score,p_after_date,p_after_id)
    order by score desc,(e).created_at desc,(e).id desc limit greatest(1,least(coalesce(p_limit,9),51))
  )
  select coalesce(jsonb_agg(community_private.entry_fields(e) || jsonb_build_object('cursor_score',score::text)
    order by score desc,(e).created_at desc,(e).id desc),'[]'::jsonb) from page
$$;

create or replace function public.read_thread(p_id uuid,p_kind text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('entry',community_private.entry_fields(e),'replies',coalesce((
    select jsonb_agg(community_private.entry_fields(r) order by r.created_at,r.id)
    from community_private.entries r where r.root_id=e.id and community_private.visible(r)
  ),'[]'::jsonb))
  from community_private.entries e where e.id=p_id and e.kind=p_kind and e.root_id is null and not e.hidden
$$;

create or replace function public.public_profile(p_username text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('profile',community_private.profile_fields(p),'entries',coalesce((
    select jsonb_agg(community_private.entry_fields(items) order by items.created_at desc,items.id desc)
    from (select e.* from community_private.entries e where e.owner_id=p.id and e.root_id is null
      and not e.hidden and not e.anonymous order by e.created_at desc,e.id desc limit 20) items
  ),'[]'::jsonb))
  from public.profiles p where p.username=p_username and p.completed_at is not null
$$;

create or replace function public.report_entry(p_id uuid,p_reason text,p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare member uuid;
begin
  member := community_private.require_member(true);
  if not exists(select 1 from community_private.entries e where e.id=p_id and community_private.visible(e))
    then raise exception 'This content is unavailable.'; end if;
  insert into community_private.reports(target_id,reporter_id,reason,note)
  values(p_id,member,p_reason,coalesce(p_note,''))
  on conflict (target_id,reporter_id) where closed_at is null do nothing;
end $$;

revoke all on all functions in schema community_private from public,anon,authenticated;
revoke all on function public.feed(text,text,text,text,integer,timestamptz,numeric,timestamptz,uuid),public.read_thread(uuid,text),
 public.public_profile(text),public.publish_entry(text,text,text,text,boolean),public.publish_reply(uuid,uuid,text),
 public.react_entry(uuid,text),public.report_entry(uuid,text,text) from public,anon,authenticated;
grant execute on function public.feed(text,text,text,text,integer,timestamptz,numeric,timestamptz,uuid),public.read_thread(uuid,text),public.public_profile(text) to anon,authenticated;
grant execute on function public.publish_entry(text,text,text,text,boolean),public.publish_reply(uuid,uuid,text),public.react_entry(uuid,text),public.report_entry(uuid,text,text) to authenticated;
commit;
