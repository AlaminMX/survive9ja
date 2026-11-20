begin;

create index if not exists profiles_public_username_prefix_idx
  on public.profiles (username text_pattern_ops)
  where completed_at is not null;

create or replace function public.search_mention_members(p_prefix text)
returns table (username text, display_name text)
language sql stable security definer set search_path = '' as $$
  select p.username, p.display_name
  from public.profiles p
  where p.completed_at is not null
    and p_prefix ~ '^[a-z0-9_]{2,20}$'
    and p.username like (replace(p_prefix, '_', '!_') || '%') escape '!'
    and community_private.verified()
    and exists (
      select 1 from public.profiles member
      where member.id = auth.uid() and member.completed_at is not null
    )
  order by p.username
  limit 6
$$;

revoke all on function public.search_mention_members(text) from public, anon, authenticated;
grant execute on function public.search_mention_members(text) to authenticated;

commit;
