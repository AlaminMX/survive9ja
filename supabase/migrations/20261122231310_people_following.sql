begin;

create table if not exists community_private.profile_follows (
  follower uuid references public.profiles(id) on delete cascade,
  followed uuid references public.profiles(id) on delete cascade,
  primary key (follower,followed),
  check (follower<>followed)
);
create index if not exists profile_follows_followed_idx on community_private.profile_follows(followed,follower);
alter table community_private.profile_follows enable row level security;
revoke all on community_private.profile_follows from public,anon,authenticated;

create or replace function community_private.follow_state(p_target uuid) returns jsonb
language sql stable set search_path='' as $$
  select jsonb_build_object(
    'following',exists(select 1 from community_private.profile_follows where follower=auth.uid() and followed=p_target),
    'follows_you',exists(select 1 from community_private.profile_follows where follower=p_target and followed=auth.uid())
  )
$$;
revoke all on function community_private.follow_state(uuid) from public,anon,authenticated;

create or replace function public.profile_follow_counts(p_username text) returns jsonb
language sql stable security definer set search_path='' as $$
  select community_private.follow_state(p.id)||jsonb_build_object(
    'followers',(select count(*) from community_private.profile_follows where followed=p.id),
    'following_count',(select count(*) from community_private.profile_follows where follower=p.id)
  )
  from public.profiles p where p.username=p_username and p.completed_at is not null
$$;

create or replace function public.browse_people(
  p_query text default '',p_username text default null,p_direction text default null,p_after text default ''
) returns jsonb
language sql stable security definer set search_path='' as $$
  with params as (select lower(left(btrim(coalesce(p_query,'')),60)) as term)
  select coalesce(jsonb_agg(q.card order by q.username),'[]'::jsonb)
  from (
    select p.username, jsonb_build_object('username',p.username,'display_name',p.display_name,'avatar_url',p.avatar_url)
      ||community_private.follow_state(p.id) as card
    from public.profiles p cross join params
    where p.completed_at is not null and p.username>coalesce(p_after,'')
      and (
        (p_username is null and length(ltrim(term,'@'))>=2
          and (strpos(p.username,ltrim(term,'@'))>0
            or (left(term,1)<>'@' and strpos(lower(p.display_name),term)>0)))
        or (p_username is not null and exists (
          select 1 from public.profiles subject join community_private.profile_follows f
            on (p_direction='followers' and f.followed=subject.id and f.follower=p.id)
              or (p_direction='following' and f.follower=subject.id and f.followed=p.id)
          where subject.username=p_username and subject.completed_at is not null
        ))
      )
    order by p.username limit 21
  ) q
$$;

create or replace function public.set_profile_follow(p_username text,p_follow boolean) returns void
language plpgsql security definer set search_path='' as $$
declare member uuid; target uuid;
begin
  if p_follow is null then raise exception 'Choose follow or unfollow.'; end if;
  member := community_private.require_member(not p_follow);
  select id into target from public.profiles where username=p_username and completed_at is not null;
  if target is null or target=member then raise exception 'This profile cannot be followed.'; end if;
  if p_follow then
    if exists(select 1 from community_private.profile_follows where follower=member and followed=target) then return; end if;
    perform community_private.take_slot(member,'profile_follow',50);
    insert into community_private.profile_follows(follower,followed) values(member,target) on conflict do nothing;
  else
    delete from community_private.profile_follows where follower=member and followed=target;
  end if;
end $$;

revoke all on function public.profile_follow_counts(text),public.browse_people(text,text,text,text),public.set_profile_follow(text,boolean) from public,anon,authenticated;
grant execute on function public.profile_follow_counts(text),public.browse_people(text,text,text,text) to anon,authenticated;
grant execute on function public.set_profile_follow(text,boolean) to authenticated;

commit;
