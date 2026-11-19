begin;

create table if not exists community_private.circles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,79}$'),
  name text not null check (char_length(btrim(name)) between 3 and 60),
  description text not null check (char_length(btrim(description)) between 12 and 280),
  owner_id uuid references public.profiles(id) on delete set null,
  starter boolean not null default false,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists community_private.circle_follows (
  circle_id uuid not null references community_private.circles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key(circle_id,user_id)
);
create index if not exists circle_follows_member_idx on community_private.circle_follows(user_id,circle_id);
create table if not exists community_private.circle_reports (
  circle_id uuid not null references community_private.circles(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  note text not null check (char_length(btrim(note)) between 5 and 500),
  created_at timestamptz not null default now(),
  primary key(circle_id,reporter_id)
);
alter table community_private.circles enable row level security;
alter table community_private.circle_follows enable row level security;
alter table community_private.circle_reports enable row level security;
revoke all on community_private.circles,community_private.circle_follows,community_private.circle_reports from public,anon,authenticated;

alter table community_private.entries add column if not exists circle_id uuid references community_private.circles(id);
alter table community_private.entries add column if not exists system_seed boolean not null default false;
alter table community_private.entries alter column owner_id drop not null;
do $$
begin
  if not exists(select 1 from pg_catalog.pg_constraint where conrelid='community_private.entries'::regclass and conname='circle_entry_scope') then
    alter table community_private.entries add constraint circle_entry_scope check (
      (circle_id is null or (kind='square' and root_id is null and not anonymous))
      and ((owner_id is not null and not system_seed)
        or (owner_id is null and system_seed and circle_id is not null))
    );
  end if;
end $$;
create index if not exists entries_circle_feed_idx on community_private.entries(circle_id,created_at desc,id desc)
  where circle_id is not null and not hidden and root_id is null;

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
    'circle',(select jsonb_build_object('slug',c.slug,'name',c.name)
      from community_private.circles c where c.id=e.circle_id and not c.archived),
    'replies',(select count(*) from community_private.entries r where r.root_id=e.id and community_private.visible(r)),
    'reactions',(select count(*) from community_private.reactions r where r.target_id=e.id),
    'relate',(select count(*) from community_private.reactions r where r.target_id=e.id and r.reaction='I relate'),
    'mine',(select reaction from community_private.reactions r where r.target_id=e.id and r.user_id=auth.uid())
  )
$$;
revoke all on function community_private.entry_fields(community_private.entries) from public,anon,authenticated;

create or replace function community_private.circle_card(c community_private.circles) returns jsonb
language sql stable set search_path='' as $$
  select jsonb_build_object('slug',c.slug,'name',c.name,'description',c.description,'starter',c.starter,
    'following',exists(select 1 from community_private.circle_follows f where f.circle_id=c.id and f.user_id=auth.uid()))
$$;

create or replace function public.circle_directory(p_following boolean default false,p_query text default '') returns jsonb
language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(q.card order by q.starter desc,q.created_at desc,q.slug),'[]'::jsonb)
  from (select c.starter,c.created_at,c.slug,community_private.circle_card(c) as card
    from community_private.circles c
    where not c.archived
      and (not coalesce(p_following,false) or exists(
        select 1 from community_private.circle_follows f where f.circle_id=c.id and f.user_id=auth.uid()))
      and (nullif(btrim(p_query),'') is null or strpos(lower(c.name||' '||c.description),lower(left(btrim(p_query),80)))>0)
    order by c.starter desc,c.created_at desc,c.slug limit 60) q
$$;

create or replace function public.circle_detail(p_slug text,p_before_date timestamptz default null,p_before_id uuid default null) returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('circle',community_private.circle_card(c),'posts',(
    select coalesce(jsonb_agg(q.card order by q.created_at desc,q.id desc),'[]'::jsonb) from (
      select e.created_at,e.id,community_private.entry_fields(e) as card from community_private.entries e
      where e.circle_id=c.id and e.root_id is null and not e.hidden
        and (p_before_date is null or (e.created_at,e.id)<(p_before_date,p_before_id))
      order by e.created_at desc,e.id desc limit 13
    ) q))
  from community_private.circles c where c.slug=p_slug and not c.archived
$$;

create or replace function public.follow_circle(p_slug text,p_follow boolean) returns void
language plpgsql security definer set search_path='' as $$
declare member uuid; target uuid;
begin
  member := community_private.require_member(not coalesce(p_follow,false));
  select id into target from community_private.circles where slug=p_slug and not archived;
  if not found then raise exception 'This Circle is unavailable.'; end if;
  if p_follow then
    insert into community_private.circle_follows(circle_id,user_id) values(target,member) on conflict do nothing;
  else
    delete from community_private.circle_follows where circle_id=target and user_id=member;
  end if;
end $$;

create or replace function public.publish_circle_post(p_slug text,p_title text,p_body text,p_category text) returns uuid
language plpgsql security definer set search_path='' as $$
declare target uuid; new_post uuid;
begin
  perform community_private.require_member();
  select id into target from community_private.circles where slug=p_slug and not archived for share;
  if not found then raise exception 'This Circle is unavailable. Choose another place to post.'; end if;
  new_post := public.publish_entry('square',p_title,p_body,p_category,false);
  update community_private.entries set circle_id=target where id=new_post;
  return new_post;
end $$;

create or replace function public.create_circle(p_name text,p_description text,p_title text,p_body text,p_category text) returns text
language plpgsql security definer set search_path='' as $$
declare member uuid; target uuid := gen_random_uuid(); circle_slug text; slug_base text;
begin
  member := community_private.require_member();
  if coalesce(char_length(btrim(p_name)),0) not between 3 and 60 then
    raise exception 'Enter a Circle name between 3 and 60 characters.';
  end if;
  if coalesce(char_length(btrim(p_description)),0) not between 12 and 280 then
    raise exception 'Describe the Circle in 12–280 characters.';
  end if;
  perform community_private.take_slot(member,'circle_create',2);
  slug_base := trim(both '-' from regexp_replace(lower(left(btrim(p_name),48)), '[^a-z0-9]+','-','g'));
  circle_slug := left(coalesce(nullif(slug_base,''),'circle'),48)||'-'||left(target::text,8);
  insert into community_private.circles(id,slug,name,description,owner_id)
    values(target,circle_slug,btrim(p_name),btrim(p_description),member);
  perform public.publish_circle_post(circle_slug,p_title,p_body,p_category);
  insert into community_private.circle_follows(circle_id,user_id) values(target,member);
  return circle_slug;
end $$;

create or replace function public.report_circle(p_slug text,p_note text) returns void
language plpgsql security definer set search_path='' as $$
declare member uuid; target uuid;
begin
  member := community_private.require_member();
  if coalesce(char_length(btrim(p_note)),0) not between 5 and 500 then raise exception 'Explain the issue in 5–500 characters.'; end if;
  select id into target from community_private.circles where slug=p_slug and not archived;
  if not found then raise exception 'This Circle is unavailable.'; end if;
  perform community_private.take_slot(member,'circle_report',10);
  insert into community_private.circle_reports(circle_id,reporter_id,note)
    values(target,member,btrim(p_note)) on conflict(circle_id,reporter_id) do update set note=excluded.note;
end $$;

create or replace function public.circle_moderation_queue() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  perform community_private.require_moderator();
  return (select coalesce(jsonb_agg(q.card),'[]'::jsonb) from (
    select community_private.circle_card(c)||jsonb_build_object('archived',c.archived,'reports',(
      select coalesce(jsonb_agg(r.note order by r.created_at),'[]'::jsonb)
      from community_private.circle_reports r where r.circle_id=c.id)) as card
    from community_private.circles c where c.archived or exists(select 1 from community_private.circle_reports where circle_id=c.id)
    order by c.archived,c.created_at desc limit 40) q);
end $$;

create or replace function public.moderate_circle(p_slug text,p_decision text,p_note text) returns void
language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
  perform community_private.require_moderator();
  if p_decision is null or p_decision not in ('archive','restore','dismiss')
    or coalesce(char_length(btrim(p_note)),0) not between 3 and 500 then
    raise exception 'Choose a decision and give a short reason.';
  end if;
  select id into target from community_private.circles where slug=p_slug for update;
  if not found then raise exception 'This Circle is unavailable.'; end if;
  if p_decision<>'dismiss' then
    update community_private.circles set archived=p_decision='archive' where id=target;
  end if;
  delete from community_private.circle_reports where circle_id=target;
  insert into community_private.moderation_log(actor,target_id,action,note)
    values(auth.uid(),target,'circle_'||p_decision,btrim(p_note));
end $$;

insert into community_private.circles(id,slug,name,description,starter)
values
 ('6b4c1e30-6670-4cbc-9000-000000000001','campus-life','Campus Life','School fees, food money, accommodation and the everyday gist of being a student in Nigeria.',true),
 ('6b4c1e30-6670-4cbc-9000-000000000002','first-job-nysc','First Job & NYSC','Ask about service year, first jobs and the things nobody tells you when you’re starting out.',true),
 ('6b4c1e30-6670-4cbc-9000-000000000003','money-everyday-life','Money & Everyday Life','Trade practical tips for making everyday life a little easier, from transport to shopping and saving.',true)
on conflict(id) do nothing;

insert into community_private.entries(id,circle_id,kind,owner_id,system_seed,title,body,category)
values
 ('6b4c1e30-6670-4cbc-8000-000000000001','6b4c1e30-6670-4cbc-9000-000000000001','square',null,true,
  'How do you make your food money last on campus?',
  'What actually works for you: cooking with roommates, buying in bulk, or knowing the right food spot? Share one tip a new student could use this week.','Education'),
 ('6b4c1e30-6670-4cbc-8000-000000000002','6b4c1e30-6670-4cbc-9000-000000000002','square',null,true,
  'What do you wish you knew before your first job or NYSC?',
  'Think of one thing that caught you off guard, and one practical thing you would tell someone just starting out.','Jobs'),
 ('6b4c1e30-6670-4cbc-8000-000000000003','6b4c1e30-6670-4cbc-9000-000000000003','square',null,true,
  'What small change saved you money this month?',
  'It could be a different route to work, a market tip, or a bill you finally figured out. What did it change for you?','Everyday Life')
on conflict(id) do nothing;

create or replace function community_private.review_fields(r community_private.reports) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id',r.id,'target_id',e.id,'reason',r.reason,'note',r.note,'body',e.body,
    'title',coalesce(e.title,root.title),'root_id',e.root_id,'root_body',root.body,
    'kind',e.kind,'system_seed',e.system_seed,'anonymous',e.anonymous,'hidden',not community_private.visible(e),'target_hidden',e.hidden,
    'parent_hidden',not e.hidden and not community_private.visible(e),
    'banned',exists(select 1 from community_private.bans b where b.user_id=e.owner_id),
    'created_at',r.created_at
  )
  from community_private.entries e left join community_private.entries root on root.id=e.root_id
  where e.id=r.target_id
$$;

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
    if item.system_seed then raise exception 'Starter discussions have no member account to ban.'; end if;
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

revoke all on function community_private.circle_card(community_private.circles) from public,anon,authenticated;
revoke all on function public.circle_directory(boolean,text),public.circle_detail(text,timestamptz,uuid),
public.follow_circle(text,boolean),public.publish_circle_post(text,text,text,text),public.create_circle(text,text,text,text,text),
public.report_circle(text,text),public.circle_moderation_queue(),public.moderate_circle(text,text,text) from public,anon,authenticated;
grant execute on function public.circle_directory(boolean,text),public.circle_detail(text,timestamptz,uuid) to anon,authenticated;
grant execute on function public.follow_circle(text,boolean),public.publish_circle_post(text,text,text,text),
public.create_circle(text,text,text,text,text),public.report_circle(text,text),public.circle_moderation_queue(),public.moderate_circle(text,text,text) to authenticated;

commit;
