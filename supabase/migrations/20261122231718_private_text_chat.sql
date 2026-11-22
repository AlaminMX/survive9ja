begin;

create table if not exists community_private.dm_threads (
  id uuid primary key default gen_random_uuid(),
  low_member uuid not null references public.profiles(id) on delete cascade,
  high_member uuid not null references public.profiles(id) on delete cascade,
  requester uuid not null,
  status text not null check (status in ('pending','accepted','declined')),
  low_read bigint not null default 0,
  high_read bigint not null default 0,
  activity_at timestamptz not null default now(),
  check (low_member<high_member and requester in (low_member,high_member)),
  unique(low_member,high_member)
);
create index if not exists dm_low_activity on community_private.dm_threads(low_member,activity_at desc,id desc);
create index if not exists dm_high_activity on community_private.dm_threads(high_member,activity_at desc,id desc);

create table if not exists community_private.dm_messages (
  id bigint generated always as identity primary key,
  thread_id uuid not null references community_private.dm_threads(id) on delete cascade,
  sender uuid not null references public.profiles(id) on delete cascade,
  nonce uuid not null,
  body text not null check (char_length(btrim(body,E' \t\r\n')) between 1 and 2000),
  created_at timestamptz not null default now(),
  unique(sender,nonce)
);
create index if not exists dm_message_thread on community_private.dm_messages(thread_id,id desc);

create table if not exists community_private.dm_blocks (
  thread_id uuid references community_private.dm_threads(id) on delete cascade,
  blocker uuid references public.profiles(id) on delete cascade,
  primary key(thread_id,blocker)
);

create table if not exists community_private.dm_reports (
  message_id bigint references community_private.dm_messages(id) on delete cascade,
  reporter uuid references public.profiles(id) on delete cascade,
  reason text not null check (char_length(reason) between 3 and 500),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  primary key(message_id,reporter)
);

alter table community_private.dm_threads enable row level security;
alter table community_private.dm_messages enable row level security;
alter table community_private.dm_blocks enable row level security;
alter table community_private.dm_reports enable row level security;
revoke all on community_private.dm_threads,community_private.dm_messages,
  community_private.dm_blocks,community_private.dm_reports from public,anon,authenticated;

-- Realtime carries only a change signal. Message data always comes through participant-checked RPCs.
create table if not exists public.dm_changes (
  id uuid primary key default gen_random_uuid(),
  member uuid not null unique references public.profiles(id) on delete cascade,
  changed_at timestamptz not null default clock_timestamp()
);
alter table public.dm_changes enable row level security;
revoke all on public.dm_changes from public,anon,authenticated;
grant select on public.dm_changes to authenticated;
drop policy if exists dm_own_changes on public.dm_changes;
create policy dm_own_changes on public.dm_changes for select to authenticated using (member=(select auth.uid()));
do $$
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime')
     and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='dm_changes') then
    alter publication supabase_realtime add table public.dm_changes;
  end if;
end $$;

create or replace function community_private.signal_dm(p_first uuid,p_second uuid) returns void
language sql set search_path='' as $$
  insert into public.dm_changes(member)
    select v from (select distinct unnest(array[p_first,p_second]) as v) q order by v
    on conflict(member) do update set changed_at=clock_timestamp()
$$;

create or replace function community_private.dm_summary(t community_private.dm_threads,member uuid) returns jsonb
language sql stable set search_path='' as $$
  select jsonb_build_object(
    'id',t.id,'username',p.username,'name',p.display_name,'avatar_url',p.avatar_url,
    'status',t.status,'incoming',t.requester<>member,
    'blocked',exists(select 1 from community_private.dm_blocks where thread_id=t.id),
    'blocked_by_me',exists(select 1 from community_private.dm_blocks where thread_id=t.id and blocker=member),
    'unread',exists(select 1 from community_private.dm_messages m
      where m.thread_id=t.id and m.sender<>member and m.id>case when t.low_member=member then t.low_read else t.high_read end),
    'activity_at',t.activity_at,
    'latest',(select m.body from community_private.dm_messages m where m.thread_id=t.id order by m.id desc limit 1))
  from public.profiles p where p.id=case when member=t.low_member then t.high_member else t.low_member end
$$;

create or replace function public.dm_inbox(p_before timestamptz default null,p_before_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare member uuid := community_private.require_member(true);
begin
  return (select coalesce(jsonb_agg(q.card order by q.activity_at desc,q.id desc),'[]'::jsonb)
    from (select t.id,t.activity_at,community_private.dm_summary(t,member) as card
      from community_private.dm_threads t
      where member in(t.low_member,t.high_member) and t.status<>'declined'
        and (p_before is null or (t.activity_at,t.id)<(p_before,p_before_id))
      order by t.activity_at desc,t.id desc limit 31) q);
end $$;

create or replace function public.dm_unread_count() returns integer
language plpgsql stable security definer set search_path='' as $$
declare member uuid := community_private.require_member(true);
begin
  return (select count(*)::integer from community_private.dm_threads t
    where member in(t.low_member,t.high_member) and t.status<>'declined'
      and exists(select 1 from community_private.dm_messages m where m.thread_id=t.id and m.sender<>member
        and m.id>case when t.low_member=member then t.low_read else t.high_read end));
end $$;

create or replace function public.dm_read(p_id uuid,p_before bigint default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare member uuid := community_private.require_member(true); thread community_private.dm_threads;
begin
  select * into thread from community_private.dm_threads where id=p_id and member in(low_member,high_member);
  if not found then raise exception 'Conversation unavailable.' using errcode='42501'; end if;
  return jsonb_build_object('thread',community_private.dm_summary(thread,member),'messages',(
    select coalesce(jsonb_agg(q order by q.id),'[]'::jsonb)
    from (select m.id,m.body,m.created_at,m.sender=member as mine
      from community_private.dm_messages m where m.thread_id=p_id and (p_before is null or m.id<p_before)
      order by m.id desc limit 41) q));
end $$;

create or replace function public.dm_open(p_username text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare member uuid := community_private.require_member(true); target public.profiles; thread uuid; follows boolean; mutual boolean;
begin
  select * into target from public.profiles where username=p_username and completed_at is not null and id<>member;
  if not found then raise exception 'Member unavailable.'; end if;
  select id into thread from community_private.dm_threads where low_member=least(member,target.id) and high_member=greatest(member,target.id);
  select exists(select 1 from community_private.profile_follows where follower=member and followed=target.id),
    exists(select 1 from community_private.profile_follows where follower=target.id and followed=member)
    into follows,mutual;
  return jsonb_build_object('id',thread,'name',target.display_name,'can_start',follows,'direct',follows and mutual);
end $$;

create or replace function public.dm_send(p_username text,p_body text,p_nonce uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare member uuid := community_private.require_member(); target uuid; thread community_private.dm_threads;
  content text := btrim(p_body,E' \t\r\n'); existing_thread uuid;
begin
  if p_nonce is null or coalesce(length(content),0) not between 1 and 2000 then
    raise exception 'Write a message of 1–2,000 characters.';
  end if;
  select id into target from public.profiles where username=p_username and completed_at is not null and id<>member;
  if target is null then raise exception 'Member unavailable.'; end if;
  -- Serialize first contact from either direction and all sends for the same pair.
  perform pg_advisory_xact_lock(hashtextextended(least(member,target)::text||greatest(member,target)::text,31));
  select * into thread from community_private.dm_threads
    where low_member=least(member,target) and high_member=greatest(member,target) for update;
  select thread_id into existing_thread from community_private.dm_messages where sender=member and nonce=p_nonce;
  if found then
    if existing_thread=thread.id then return thread.id; end if;
    raise exception 'This message was already submitted.';
  end if;
  if thread.id is null then
    if not exists(select 1 from community_private.profile_follows where follower=member and followed=target) then
      raise exception 'Follow this member before messaging.';
    end if;
    if exists(select 1 from community_private.profile_follows where follower=target and followed=member) then
      insert into community_private.dm_threads(low_member,high_member,requester,status)
        values(least(member,target),greatest(member,target),member,'accepted') returning * into thread;
    else
      perform community_private.take_slot(member,'dm_request',10);
      insert into community_private.dm_threads(low_member,high_member,requester,status)
        values(least(member,target),greatest(member,target),member,'pending') returning * into thread;
    end if;
  elsif thread.status<>'accepted' or exists(select 1 from community_private.dm_blocks where thread_id=thread.id) then
    raise exception 'This conversation cannot receive new messages.';
  end if;
  perform community_private.take_slot(member,'dm_message',150);
  insert into community_private.dm_messages(thread_id,sender,nonce,body) values(thread.id,member,p_nonce,content);
  update community_private.dm_threads set activity_at=clock_timestamp() where id=thread.id;
  perform community_private.signal_dm(member,target);
  return thread.id;
end $$;

create or replace function public.dm_action(p_id uuid,p_action text) returns void
language plpgsql security definer set search_path='' as $$
declare member uuid := community_private.require_member(p_action in ('block','unblock','decline')); thread community_private.dm_threads;
begin
  select * into thread from community_private.dm_threads where id=p_id and member in(low_member,high_member) for update;
  if not found then raise exception 'Conversation unavailable.' using errcode='42501'; end if;
  if p_action='block' then
    insert into community_private.dm_blocks values(p_id,member) on conflict do nothing;
    update community_private.dm_threads set status='declined' where id=p_id and status='pending';
  elsif p_action='unblock' then
    delete from community_private.dm_blocks where thread_id=p_id and blocker=member;
  elsif p_action in ('accept','decline') and thread.status='pending' and thread.requester<>member then
    update community_private.dm_threads set status=case when p_action='accept' then 'accepted' else 'declined' end where id=p_id;
  else
    raise exception 'This action is unavailable.';
  end if;
  perform community_private.signal_dm(thread.low_member,thread.high_member);
end $$;

create or replace function public.dm_mark_read(p_id uuid,p_seen bigint) returns void
language plpgsql security definer set search_path='' as $$
declare member uuid := community_private.require_member(true);
begin
  if not exists(select 1 from community_private.dm_messages where thread_id=p_id and id=p_seen) then return; end if;
  update community_private.dm_threads set
    low_read=case when low_member=member then greatest(low_read,p_seen) else low_read end,
    high_read=case when high_member=member then greatest(high_read,p_seen) else high_read end
    where id=p_id and member in(low_member,high_member)
      and p_seen>case when low_member=member then low_read else high_read end;
  if found then perform community_private.signal_dm(member,member); end if;
end $$;

create or replace function public.dm_report(p_message bigint,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
declare member uuid := community_private.require_member(true);
begin
  if coalesce(length(btrim(p_reason)),0) not between 3 and 500 then raise exception 'Enter a reason of 3–500 characters.'; end if;
  if not exists(select 1 from community_private.dm_messages m join community_private.dm_threads t on t.id=m.thread_id
    where m.id=p_message and m.sender<>member and member in(t.low_member,t.high_member))
    then raise exception 'Message unavailable.' using errcode='42501'; end if;
  perform community_private.take_slot(member,'dm_report',20);
  insert into community_private.dm_reports(message_id,reporter,reason) values(p_message,member,btrim(p_reason)) on conflict do nothing;
end $$;

create or replace function public.dm_report_queue() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  perform community_private.require_moderator();
  return (select coalesce(jsonb_agg(q order by q.created_at),'[]'::jsonb) from (
    select r.message_id,r.reporter,r.reason,r.created_at,m.body,p.username as sender
    from community_private.dm_reports r join community_private.dm_messages m on m.id=r.message_id
    join public.profiles p on p.id=m.sender where r.resolved_at is null
    order by r.created_at,r.message_id,r.reporter limit 50) q);
end $$;

create or replace function public.dm_resolve_report(p_message bigint,p_reporter uuid,p_note text) returns void
language plpgsql security definer set search_path='' as $$
declare thread uuid;
begin
  perform community_private.require_moderator();
  if coalesce(length(btrim(p_note)),0) not between 3 and 500 then raise exception 'Enter a moderation note of 3–500 characters.'; end if;
  select m.thread_id into thread from community_private.dm_messages m where m.id=p_message;
  update community_private.dm_reports set resolved_at=clock_timestamp()
    where message_id=p_message and reporter=p_reporter and resolved_at is null;
  if not found then raise exception 'Report unavailable.'; end if;
  insert into community_private.moderation_log(actor,target_id,action,note)
    values(auth.uid(),thread,'dm_report_resolve',btrim(p_note));
end $$;

revoke all on function community_private.signal_dm(uuid,uuid),
  community_private.dm_summary(community_private.dm_threads,uuid) from public,anon,authenticated;
revoke all on function public.dm_inbox(timestamptz,uuid),public.dm_unread_count(),public.dm_read(uuid,bigint),
  public.dm_open(text),public.dm_send(text,text,uuid),public.dm_action(uuid,text),
  public.dm_mark_read(uuid,bigint),public.dm_report(bigint,text),public.dm_report_queue(),
  public.dm_resolve_report(bigint,uuid,text) from public,anon,authenticated;
grant execute on function public.dm_inbox(timestamptz,uuid),public.dm_unread_count(),public.dm_read(uuid,bigint),
  public.dm_open(text),public.dm_send(text,text,uuid),public.dm_action(uuid,text),
  public.dm_mark_read(uuid,bigint),public.dm_report(bigint,text),public.dm_report_queue(),
  public.dm_resolve_report(bigint,uuid,text) to authenticated;

commit;
