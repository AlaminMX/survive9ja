begin;

create table if not exists community_private.survival_applications (
  story_id uuid primary key references community_private.entries(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  context text not null check (length(context) between 20 and 600),
  duration text not null check (length(duration) between 3 and 120),
  challenges text not null check (length(challenges) between 20 and 600),
  response text not null check (length(response) between 20 and 600),
  lesson text not null check (length(lesson) between 20 and 600),
  quiz_score integer not null check (quiz_score between 0 and 3),
  approved_level integer check (approved_level in (4,5)),
  created_at timestamptz not null default now()
);
create index if not exists survival_applications_owner_idx on community_private.survival_applications(owner_id);
create table if not exists community_private.survival_votes (
  story_id uuid references community_private.survival_applications(story_id) on delete cascade,
  voter_id uuid references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('useful','vouch')),
  primary key(story_id,voter_id)
);
create table if not exists community_private.survival_awards (
  owner_id uuid primary key references public.profiles(id) on delete cascade,
  story_id uuid not null references community_private.survival_applications(story_id) on delete cascade,
  code uuid not null unique default gen_random_uuid(),
  level integer not null check (level between 1 and 5),
  shared boolean not null default false,
  awarded_at timestamptz not null default now()
);
create table if not exists community_private.business_listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('Business','Product','Service','Initiative','Collaboration','Business Survivors')),
  title text not null check (length(title) between 3 and 100),
  description text not null check (length(description) between 20 and 2000),
  location text check (length(location)<=100),
  website text check (length(website)<=300 and website ~ '^https://[^[:space:]]+$'),
  status text not null default 'pending' check (status in ('pending','published','hidden')),
  created_at timestamptz not null default now()
);
create index if not exists business_listings_feed_idx on community_private.business_listings(status,kind,created_at desc,id desc);
create index if not exists business_listings_owner_idx on community_private.business_listings(owner_id);
create table if not exists community_private.business_reports (
  listing_id uuid references community_private.business_listings(id) on delete cascade,
  reporter_id uuid references public.profiles(id) on delete cascade,
  reason text not null check (length(reason) between 5 and 300),
  primary key(listing_id,reporter_id)
);

alter table community_private.survival_applications enable row level security;
alter table community_private.survival_votes enable row level security;
alter table community_private.survival_awards enable row level security;
alter table community_private.business_listings enable row level security;
alter table community_private.business_reports enable row level security;
revoke all on all tables in schema community_private from public,anon,authenticated;

create or replace function community_private.survival_score(a community_private.survival_applications) returns integer
language sql stable set search_path='' as $$
  select 20 + a.quiz_score*15 + least((
    select coalesce(sum(case when v.kind='vouch' then 3 else 2 end),0)
    from community_private.survival_votes v
    where v.story_id=a.story_id and not exists(select 1 from community_private.bans b where b.user_id=v.voter_id)
  ),35)::int
$$;

create or replace function community_private.current_survival_level(p_member uuid) returns integer
language sql stable set search_path='' as $$
  select coalesce((select w.level from community_private.survival_awards w
    join community_private.entries e on e.id=w.story_id
    where w.owner_id=p_member and not e.hidden and not e.anonymous
      and not exists(select 1 from community_private.bans b where b.user_id=p_member)),0)
$$;

create or replace function public.submit_survival(p_story uuid,p_context text,p_duration text,p_challenges text,p_response text,p_lesson text,p_answers integer[]) returns void
language plpgsql security definer set search_path='' as $$
declare member uuid; points integer;
begin
  member := community_private.require_member();
  if not exists(select 1 from community_private.entries where id=p_story and owner_id=member
    and kind='diary' and root_id is null and not anonymous and not hidden) then
    raise exception 'Choose one of your visible, named Diaries.';
  end if;
  if array_length(p_answers,1) is distinct from 3 or array_position(p_answers,null) is not null
    or not p_answers <@ array[0,1,2] then raise exception 'Answer all three scenarios.'; end if;
  points := (p_answers[1]=1)::int + (p_answers[2]=2)::int + (p_answers[3]=0)::int;
  perform community_private.take_slot(member,'survival_application',3);
  insert into community_private.survival_applications(story_id,owner_id,context,duration,challenges,response,lesson,quiz_score)
    values(p_story,member,btrim(p_context),btrim(p_duration),btrim(p_challenges),btrim(p_response),btrim(p_lesson),points)
  on conflict(story_id) do update set quiz_score=greatest(survival_applications.quiz_score,excluded.quiz_score);
end $$;

create or replace function public.survival_story(p_story uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('useful',(select count(*) from community_private.survival_votes where story_id=a.story_id and kind='useful'),
    'vouches',(select count(*) from community_private.survival_votes where story_id=a.story_id and kind='vouch'),
    'vote',(select kind from community_private.survival_votes where story_id=a.story_id and voter_id=auth.uid()))
  from community_private.survival_applications a join community_private.entries e on e.id=a.story_id
  where a.story_id=p_story and not e.hidden and not e.anonymous
$$;

create or replace function public.vote_survival(p_story uuid,p_kind text) returns void
language plpgsql security definer set search_path='' as $$
declare member uuid;
begin
  member := community_private.require_member();
  if not exists(select 1 from community_private.survival_applications a join community_private.entries e on e.id=a.story_id
    where a.story_id=p_story and a.owner_id<>member and not e.hidden and not e.anonymous) then
    raise exception 'You can only vote on another member’s visible submission.';
  end if;
  if p_kind is null then
    delete from community_private.survival_votes where story_id=p_story and voter_id=member;
  else
    insert into community_private.survival_votes(story_id,voter_id,kind) values(p_story,member,p_kind)
    on conflict(story_id,voter_id) do update set kind=excluded.kind;
  end if;
end $$;

create or replace function public.my_survival() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare member uuid;
begin
  member := community_private.require_member(true);
  return jsonb_build_object(
    'level',community_private.current_survival_level(member),
    'award',(select jsonb_build_object('code',code,'shared',shared) from community_private.survival_awards where owner_id=member
      and community_private.current_survival_level(member)>0),
    'stories',(select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'title',e.title,'score',community_private.survival_score(a),'quiz',a.quiz_score,'approved',a.approved_level)
      order by e.created_at desc),'[]'::jsonb) from community_private.entries e
      left join community_private.survival_applications a on a.story_id=e.id
      where e.owner_id=member and e.kind='diary' and e.root_id is null and not e.anonymous and not e.hidden));
end $$;

create or replace function public.claim_survival(p_story uuid) returns integer
language plpgsql security definer set search_path='' as $$
declare member uuid; a community_private.survival_applications; score integer; awarded integer;
begin
  member := community_private.require_member();
  select s.* into a from community_private.survival_applications s join community_private.entries e on e.id=s.story_id
    where s.story_id=p_story and s.owner_id=member and not e.hidden and not e.anonymous for update of s;
  if not found then raise exception 'Submit a visible Diary first.'; end if;
  score := community_private.survival_score(a);
  awarded := case when score>=90 and a.approved_level=5 then 5
    when score>=80 and a.approved_level>=4 then 4 when score>=65 and a.quiz_score>=2 and (
      select count(*) from community_private.survival_votes v where v.story_id=a.story_id
        and not exists(select 1 from community_private.bans b where b.user_id=v.voter_id)
    )>=2 then 3
    when score>=45 and a.quiz_score>=1 then 2 else 1 end;
  insert into community_private.survival_awards(owner_id,story_id,level) values(member,p_story,awarded)
    on conflict(owner_id) do update set story_id=excluded.story_id,level=excluded.level,awarded_at=now()
    where survival_awards.level<excluded.level
      or community_private.current_survival_level(member)=0;
  return community_private.current_survival_level(member);
end $$;

create or replace function public.share_survival(p_shared boolean) returns void
language plpgsql security definer set search_path='' as $$
declare member uuid;
begin
  member := community_private.require_member(not coalesce(p_shared,false));
  if p_shared and community_private.current_survival_level(member)=0 then raise exception 'Earn a level before sharing.'; end if;
  update community_private.survival_awards set shared=coalesce(p_shared,false) where owner_id=member;
end $$;

create or replace function public.verify_survival(p_code uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('level',w.level,'name',p.display_name,'issued_at',w.awarded_at,'id',w.code)
  from community_private.survival_awards w join public.profiles p on p.id=w.owner_id
  where w.code=p_code and (w.shared or w.owner_id=auth.uid()) and community_private.current_survival_level(w.owner_id)>0
$$;

create or replace function public.public_survival_badge(p_username text) returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('level',w.level,'code',w.code)
  from community_private.survival_awards w join public.profiles p on p.id=w.owner_id
  where p.username=p_username and w.shared and community_private.current_survival_level(w.owner_id)>0
$$;

create or replace function public.survival_review_queue() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  perform community_private.require_moderator();
  return (select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) from (
    select a.story_id,e.title,a.context,a.duration,a.challenges,a.response,a.lesson,a.quiz_score,a.approved_level,
      community_private.survival_score(a) as score
    from community_private.survival_applications a join community_private.entries e on e.id=a.story_id
    where not e.hidden and not e.anonymous and community_private.survival_score(a)>=80
      and coalesce(a.approved_level,0) < case when community_private.survival_score(a)>=90 then 5 else 4 end
    order by a.created_at limit 50
  ) q);
end $$;

create or replace function public.approve_survival(p_story uuid,p_level integer,p_note text) returns void
language plpgsql security definer set search_path='' as $$
declare a community_private.survival_applications;
begin
  perform community_private.require_moderator();
  select s.* into a from community_private.survival_applications s join community_private.entries e on e.id=s.story_id
    where s.story_id=p_story and not e.hidden and not e.anonymous for update of s;
  if not found or a.owner_id=auth.uid() or p_level is null or p_level not in (4,5)
    or p_level<=coalesce(a.approved_level,0) or a.quiz_score<>3
    or community_private.survival_score(a)<(case when p_level=5 then 90 else 80 end)
    or coalesce(length(btrim(p_note)),0) not between 3 and 500 then
    raise exception 'This application is not eligible for the requested review decision.';
  end if;
  update community_private.survival_applications set approved_level=p_level where story_id=p_story;
  insert into community_private.moderation_log(actor,target_id,action,note)
    values(auth.uid(),p_story,'survival_level_'||p_level,btrim(p_note));
end $$;

create or replace function public.save_business(p_id uuid,p_kind text,p_title text,p_description text,p_location text,p_website text) returns uuid
language plpgsql security definer set search_path='' as $$
declare member uuid; listing uuid;
begin
  member := community_private.require_member();
  if p_kind='Business Survivors' and community_private.current_survival_level(member)<3 then
    raise exception 'Business Survivors requires Survival Level 3.';
  end if;
  perform community_private.take_slot(member,'business_listing',5);
  if p_id is null then
    insert into community_private.business_listings(owner_id,kind,title,description,location,website)
    values(member,p_kind,btrim(p_title),btrim(p_description),nullif(btrim(p_location),''),nullif(btrim(p_website),''))
    returning id into listing;
  else
    update community_private.business_listings set kind=p_kind,title=btrim(p_title),description=btrim(p_description),
      location=nullif(btrim(p_location),''),website=nullif(btrim(p_website),''),status='pending'
    where id=p_id and owner_id=member and status<>'hidden' returning id into listing;
    if not found then raise exception 'This listing can’t be edited.'; end if;
  end if;
  return listing;
end $$;

create or replace function public.business_directory(p_query text default '',p_kind text default null,p_private boolean default false,p_listing uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if p_private and community_private.current_survival_level(auth.uid())<3 then
    raise exception 'Business Survivors requires Survival Level 3.';
  end if;
  return (select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) from (
    select b.id,b.kind,b.title,b.description,b.location,b.website,p.username,p.display_name
    from community_private.business_listings b join public.profiles p on p.id=b.owner_id
    where b.status='published' and (b.kind='Business Survivors')=p_private
      and (p_kind is null or b.kind=p_kind)
      and (p_listing is null or b.id=p_listing)
      and not exists(select 1 from community_private.bans where user_id=b.owner_id)
      and (not p_private or community_private.current_survival_level(b.owner_id)>=3)
      and (nullif(btrim(p_query),'') is null or strpos(lower(b.title||' '||b.description||' '||coalesce(b.location,'')),lower(left(btrim(p_query),100)))>0)
    order by b.created_at desc,b.id desc limit 50
  ) q);
end $$;

create or replace function public.my_business() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare member uuid;
begin
  member := community_private.require_member(true);
  return (select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) from (
    select id,kind,title,description,location,website,status from community_private.business_listings
    where owner_id=member order by created_at desc limit 50
  ) q);
end $$;

create or replace function public.report_business(p_id uuid,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
declare member uuid;
begin
  member := community_private.require_member();
  if not exists(select 1 from community_private.business_listings where id=p_id and status='published'
    and (kind<>'Business Survivors' or community_private.current_survival_level(member)>=3)) then
    raise exception 'This listing isn’t available.';
  end if;
  insert into community_private.business_reports(listing_id,reporter_id,reason)
    values(p_id,member,btrim(p_reason)) on conflict(listing_id,reporter_id) do update set reason=excluded.reason;
end $$;

create or replace function public.business_review_queue() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  perform community_private.require_moderator();
  return (select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) from (
    select b.id,b.kind,b.title,b.description,b.location,b.website,b.status,
      (select coalesce(jsonb_agg(r.reason),'[]'::jsonb) from community_private.business_reports r where r.listing_id=b.id) as reports
    from community_private.business_listings b
    order by (b.status='pending' or exists(select 1 from community_private.business_reports where listing_id=b.id)) desc,
      b.created_at desc limit 80
  ) q);
end $$;

create or replace function public.moderate_business(p_id uuid,p_status text,p_note text) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform community_private.require_moderator();
  if p_status is null or p_status not in ('published','hidden')
    or coalesce(length(btrim(p_note)),0) not between 3 and 500 then raise exception 'Enter a moderation reason.'; end if;
  update community_private.business_listings set status=p_status where id=p_id;
  if not found then raise exception 'Listing not found.'; end if;
  delete from community_private.business_reports where listing_id=p_id;
  insert into community_private.moderation_log(actor,target_id,action,note)
    values(auth.uid(),p_id,'business_'||p_status,btrim(p_note));
end $$;

create table if not exists community_private.credit_ledger (
  id bigint generated always as identity primary key,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  delta integer not null check (delta<>0),
  reason text not null,
  reference text not null unique,
  created_at timestamptz not null default now()
);
create index if not exists credit_ledger_owner_idx on community_private.credit_ledger(owner_id,id desc);
create table if not exists community_private.credit_packs (
  id text primary key check (id ~ '^[a-z0-9_-]{1,30}$'),
  credits integer not null check (credits between 1 and 100000),
  amount_kobo integer not null check (amount_kobo between 100 and 100000000),
  active boolean not null default false
);
create table if not exists community_private.credit_payments (
  reference uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  credits integer not null check (credits>0),
  amount_kobo integer not null check (amount_kobo>0),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists credit_payments_owner_idx on community_private.credit_payments(owner_id,created_at desc);
create table if not exists community_private.promotions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  entry_id uuid references community_private.entries(id) on delete cascade,
  business_id uuid references community_private.business_listings(id) on delete cascade,
  ends_at timestamptz not null,
  check ((entry_id is null)<>(business_id is null))
);
create index if not exists promotions_active_idx on community_private.promotions(ends_at);
alter table community_private.credit_ledger enable row level security;
alter table community_private.credit_packs enable row level security;
alter table community_private.credit_payments enable row level security;
alter table community_private.promotions enable row level security;
revoke all on all tables in schema community_private from public,anon,authenticated;

create or replace function public.credit_wallet() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare member uuid;
begin
  member := community_private.require_member(true);
  return jsonb_build_object(
    'balance', (select coalesce(sum(delta),0) from community_private.credit_ledger where owner_id=member),
    'activity',(select coalesce(jsonb_agg(to_jsonb(q) order by q.id desc),'[]'::jsonb) from (
      select id,delta,reason,created_at from community_private.credit_ledger where owner_id=member order by id desc limit 30) q),
    'packs',(select coalesce(jsonb_agg(to_jsonb(p) order by p.amount_kobo),'[]'::jsonb) from (
      select id,credits,amount_kobo from community_private.credit_packs where active) p));
end $$;

create or replace function public.earn_survival_credit() returns void
language plpgsql security definer set search_path='' as $$
declare member uuid;
begin
  member := community_private.require_member();
  if community_private.current_survival_level(member)<1 then raise exception 'Earn a Survival Level to claim your one-time participation credit.'; end if;
  insert into community_private.credit_ledger(owner_id,delta,reason,reference)
    values(member,1,'Survival participation','survival:'||member) on conflict(reference) do nothing;
end $$;

create or replace function public.boost_content(p_kind text,p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare member uuid; boost uuid;
begin
  member := community_private.require_member();
  if p_kind='square' then
    if not exists(select 1 from community_private.entries where id=p_id and owner_id=member and kind='square'
      and root_id is null and not hidden) then raise exception 'Only your visible Square posts can be boosted.'; end if;
  elsif p_kind='business' then
    if not exists(select 1 from community_private.business_listings where id=p_id and owner_id=member
      and status='published' and kind<>'Business Survivors') then raise exception 'Only your published public listings can be boosted.'; end if;
  else raise exception 'Choose a Square post or business listing.'; end if;
  if exists(select 1 from community_private.promotions where (entry_id=p_id or business_id=p_id) and ends_at>now()) then
    raise exception 'This item already has an active boost.';
  end if;
  if (select coalesce(sum(delta),0) from community_private.credit_ledger where owner_id=member)<1 then
    raise exception 'A 24-hour boost costs one credit.';
  end if;
  insert into community_private.promotions(owner_id,entry_id,business_id,ends_at)
    values(member,case when p_kind='square' then p_id end,case when p_kind='business' then p_id end,now()+interval '24 hours')
    returning id into boost;
  insert into community_private.credit_ledger(owner_id,delta,reason,reference)
    values(member,-1,'24-hour boost','boost:'||boost);
end $$;

create or replace function public.sponsored_content(p_kind text) returns jsonb
language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) from (
    select coalesce(e.id,b.id) as id,coalesce(e.title,b.title) as title
    from community_private.promotions p
    left join community_private.entries e on e.id=p.entry_id and not e.hidden and e.kind='square'
    left join community_private.business_listings b on b.id=p.business_id and b.status='published' and b.kind<>'Business Survivors'
    where p.ends_at>now() and not exists(select 1 from community_private.bans where user_id=p.owner_id)
      and ((p_kind='square' and e.id is not null) or (p_kind='business' and b.id is not null))
    order by p.ends_at desc,p.id limit 3
  ) q
$$;

create or replace function public.start_credit_payment(p_pack text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare member uuid; pack community_private.credit_packs; ref uuid;
begin
  member := community_private.require_member();
  select * into pack from community_private.credit_packs where id=p_pack and active;
  if not found then raise exception 'This credit pack is unavailable.'; end if;
  perform community_private.take_slot(member,'credit_checkout',15);
  insert into community_private.credit_payments(owner_id,credits,amount_kobo)
    values(member,pack.credits,pack.amount_kobo) returning reference into ref;
  return jsonb_build_object('reference',ref,'amount',pack.amount_kobo);
end $$;

create or replace function public.settle_credit_payment(p_reference uuid,p_amount integer,p_currency text) returns boolean
language plpgsql security definer set search_path='' as $$
declare charge community_private.credit_payments;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Payment settlement requires server access.'; end if;
  select * into charge from community_private.credit_payments where reference=p_reference for update;
  if not found or p_amount is distinct from charge.amount_kobo or p_currency is distinct from 'NGN' then return false; end if;
  if charge.paid_at is not null then return true; end if;
  perform pg_advisory_xact_lock(hashtextextended(charge.owner_id::text,19));
  insert into community_private.credit_ledger(owner_id,delta,reason,reference)
    values(charge.owner_id,charge.credits,'Paystack credit purchase','paystack:'||p_reference);
  update community_private.credit_payments set paid_at=now() where reference=p_reference;
  return true;
end $$;

revoke all on function community_private.survival_score(community_private.survival_applications),community_private.current_survival_level(uuid) from public,anon,authenticated;
revoke all on function public.submit_survival(uuid,text,text,text,text,text,integer[]),public.survival_story(uuid),public.vote_survival(uuid,text),
  public.my_survival(),public.claim_survival(uuid),public.share_survival(boolean),public.verify_survival(uuid),public.public_survival_badge(text),
  public.survival_review_queue(),public.approve_survival(uuid,integer,text),
  public.save_business(uuid,text,text,text,text,text),public.business_directory(text,text,boolean,uuid),public.my_business(),
  public.report_business(uuid,text),public.business_review_queue(),public.moderate_business(uuid,text,text),
  public.credit_wallet(),public.earn_survival_credit(),public.boost_content(text,uuid),public.sponsored_content(text),
  public.start_credit_payment(text),public.settle_credit_payment(uuid,integer,text) from public,anon,authenticated;
grant execute on function public.survival_story(uuid),public.verify_survival(uuid),public.public_survival_badge(text),
  public.business_directory(text,text,boolean,uuid),public.sponsored_content(text) to anon,authenticated;
grant execute on function public.submit_survival(uuid,text,text,text,text,text,integer[]),public.vote_survival(uuid,text),
  public.my_survival(),public.claim_survival(uuid),public.share_survival(boolean),public.survival_review_queue(),public.approve_survival(uuid,integer,text),
  public.save_business(uuid,text,text,text,text,text),public.my_business(),public.report_business(uuid,text),
  public.business_review_queue(),public.moderate_business(uuid,text,text),public.credit_wallet(),public.earn_survival_credit(),
  public.boost_content(text,uuid),public.start_credit_payment(text) to authenticated;
grant execute on function public.settle_credit_payment(uuid,integer,text) to service_role;

commit;
