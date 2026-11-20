begin;

create or replace function public.admin_access() returns text
language sql stable security definer set search_path='' as $$
  select case
    when community_private.has_moderator_role() and exists (
      select 1 from auth.sessions s
      where s.user_id=auth.uid() and s.id::text=auth.jwt()->>'session_id'
        and (s.not_after is null or s.not_after>now())
    ) then (
      select r.role from public.user_roles r
      where r.user_id=auth.uid() order by r.role limit 1
    )
  end
$$;

create or replace function community_private.require_admin() returns void
language plpgsql stable set search_path='' as $$
begin
  if public.admin_access() is distinct from 'admin' then
    raise exception 'Administrator access is required.' using errcode='42501';
  end if;
end $$;

create or replace function public.admin_account_stats() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  perform community_private.require_admin();
  return jsonb_build_object(
    'accounts',(select count(*) from auth.users where deleted_at is null),
    'new_week',(select count(*) from auth.users where deleted_at is null and created_at >= now()-interval '7 days'),
    'verified',(select count(*) from auth.users where deleted_at is null and email_confirmed_at is not null),
    'onboarded',(select count(*) from public.profiles where completed_at is not null),
    'sessions',(select count(distinct s.user_id) from auth.sessions s join auth.users u on u.id=s.user_id
      where u.deleted_at is null and (s.not_after is null or s.not_after>now())),
    'moderators',(select count(*) from public.user_roles where role='moderator'),
    'open_reports',(select count(*) from community_private.reports where closed_at is null),
    'gists',(select count(*) from community_private.entries where kind='square' and root_id is null and community_private.visible(entries)),
    'diaries',(select count(*) from community_private.entries where kind='diary' and root_id is null and community_private.visible(entries))
  );
end $$;

create or replace function public.admin_accounts(
  p_query text default '',p_sessions_only boolean default false,
  p_before_date timestamptz default null,p_before_id uuid default null
) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare needle text := lower(left(btrim(coalesce(p_query,'')),254));
begin
  perform community_private.require_admin();
  return (select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc,q.id desc),'[]'::jsonb)
    from (
      select u.id,u.email,u.created_at,u.last_sign_in_at,
        u.email_confirmed_at is not null as verified,
        p.completed_at is not null as onboarded,p.username,p.display_name,
        exists(select 1 from public.user_roles r where r.user_id=u.id and r.role='admin') as admin,
        exists(select 1 from public.user_roles r where r.user_id=u.id and r.role='moderator') as moderator,
        exists(select 1 from community_private.bans b where b.user_id=u.id) as banned,
        exists(select 1 from auth.sessions s where s.user_id=u.id and (s.not_after is null or s.not_after>now())) as has_session
      from auth.users u left join public.profiles p on p.id=u.id
      where u.deleted_at is null
        and (not coalesce(p_sessions_only,false) or exists(select 1 from auth.sessions s
          where s.user_id=u.id and (s.not_after is null or s.not_after>now())))
        and (needle='' or strpos(lower(coalesce(u.email,'')),needle)>0
          or (ltrim(needle,'@')<>'' and strpos(coalesce(p.username,''),ltrim(needle,'@'))>0)
          or strpos(lower(coalesce(p.display_name,'')),needle)>0)
        and (p_before_date is null or (u.created_at,u.id)<(p_before_date,p_before_id))
      order by u.created_at desc,u.id desc limit 26
    ) q);
end $$;

create or replace function public.admin_set_moderator(p_target uuid,p_grant boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform community_private.require_admin();
  perform 1 from auth.users where id=p_target and deleted_at is null for update;
  if not found then raise exception 'Account unavailable.'; end if;
  if p_grant is null or exists(select 1 from public.user_roles where user_id=p_target and role='admin')
    then raise exception 'Administrator roles are managed separately.'; end if;
  if p_grant then
    if not exists(select 1 from auth.users u join public.profiles p on p.id=u.id
      where u.id=p_target and u.email_confirmed_at is not null and p.completed_at is not null)
      then raise exception 'The member must verify their email and complete their profile.'; end if;
    insert into public.user_roles(user_id,role) values(p_target,'moderator') on conflict do nothing;
  else
    delete from public.user_roles where user_id=p_target and role='moderator';
  end if;
  if found then
    insert into community_private.moderation_log(actor,target_id,action,note)
    values(auth.uid(),p_target,case when p_grant then 'grant_moderator' else 'remove_moderator' end,'Account role changed');
  end if;
end $$;

create or replace function community_private.check_deletable_account(p_target uuid) returns void
language plpgsql stable set search_path='' as $$
begin
  if not exists(select 1 from auth.users where id=p_target and deleted_at is null)
    then raise exception 'Account unavailable.'; end if;
  if exists(select 1 from public.user_roles where user_id=p_target and role='admin')
    then raise exception 'Administrator accounts are protected.'; end if;
  if exists(select 1 from community_private.credit_payments where owner_id=p_target)
    then raise exception 'This account has payment records. Reconcile them before deleting the account.'; end if;
end $$;

create or replace function public.admin_check_account_deletion(p_target uuid,p_note text) returns void
language plpgsql stable security definer set search_path='' as $$
begin
  perform community_private.require_admin();
  if coalesce(char_length(btrim(p_note)),0) not between 3 and 500
    then raise exception 'Enter a deletion reason (3–500 characters).'; end if;
  perform community_private.check_deletable_account(p_target);
end $$;

create or replace function public.admin_delete_account(p_target uuid,p_note text) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform community_private.require_admin();
  perform 1 from auth.users where id=p_target for update;
  perform 1 from public.profiles where id=p_target for update;
  perform public.admin_check_account_deletion(p_target,p_note);
  if exists(select 1 from storage.objects where bucket_id='survive9ja-avatars' and name like p_target::text||'/%')
    then raise exception 'Profile photos must be removed before deleting this account.'; end if;
  delete from auth.users where id=p_target;
  insert into community_private.moderation_log(actor,target_id,action,note)
    values(auth.uid(),p_target,'delete_account',btrim(p_note));
end $$;

create or replace function public.avatar_account_exists() returns boolean
language sql stable security definer set search_path='' as $$
  select community_private.verified()
$$;
drop policy if exists survive9ja_insert_own_avatar on storage.objects;
create policy survive9ja_insert_own_avatar on storage.objects for insert to authenticated
  with check (bucket_id='survive9ja-avatars'
    and (select public.avatar_account_exists())
    and (select auth.uid())::text=(storage.foldername(name))[1]
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$');

create or replace function public.admin_account_history() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  perform community_private.require_admin();
  return (select coalesce(jsonb_agg(to_jsonb(q) order by q.id desc),'[]'::jsonb)
    from (select l.id,l.action,l.target_id,l.note,l.created_at,p.username as actor
      from community_private.moderation_log l left join public.profiles p on p.id=l.actor
      where l.action in ('grant_moderator','remove_moderator','delete_account')
      order by l.id desc limit 30) q);
end $$;

revoke all on function community_private.require_admin(),community_private.check_deletable_account(uuid) from public,anon,authenticated;
revoke all on function public.admin_access(),public.admin_account_stats(),public.admin_accounts(text,boolean,timestamptz,uuid),
  public.admin_set_moderator(uuid,boolean),public.admin_check_account_deletion(uuid,text),public.admin_delete_account(uuid,text),
  public.avatar_account_exists(),public.admin_account_history() from public,anon,authenticated;
grant execute on function public.admin_access(),public.admin_account_stats(),public.admin_accounts(text,boolean,timestamptz,uuid),
  public.admin_set_moderator(uuid,boolean),public.admin_check_account_deletion(uuid,text),public.admin_delete_account(uuid,text),
  public.avatar_account_exists(),public.admin_account_history() to authenticated;

commit;
