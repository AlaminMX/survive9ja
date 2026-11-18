begin;
create schema if not exists community_private;
revoke all on schema community_private from public, anon, authenticated;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text check (char_length(display_name) between 1 and 60),
  country text not null default 'Nigeria' check (char_length(country) between 1 and 80),
  region text check (char_length(region) between 1 and 80),
  bio text check (char_length(bio) <= 160),
  abroad boolean not null default false,
  avatar_url text check (char_length(avatar_url) <= 500 and avatar_url ~ '^https://[^[:space:]]+$'),
  terms_version text,
  privacy_version text,
  accepted_at timestamptz,
  completed_at timestamptz,
  check (completed_at is null or (username is not null and display_name is not null
    and terms_version is not null and privacy_version is not null and accepted_at is not null))
);
create table if not exists public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','moderator')),
  primary key (user_id,role)
);
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
revoke all on public.profiles,public.user_roles from public,anon,authenticated;

create or replace function community_private.provision_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id) values (new.id) on conflict do nothing;
  return new;
end $$;
revoke all on function community_private.provision_profile() from public,anon,authenticated;
drop trigger if exists survive9ja_provision_profile on auth.users;
create trigger survive9ja_provision_profile after insert on auth.users
for each row execute function community_private.provision_profile();
insert into public.profiles(id) select id from auth.users on conflict do nothing;

create or replace function community_private.verified() returns boolean
language sql stable set search_path = '' as $$
  select exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null)
$$;
create or replace function community_private.has_moderator_role() returns boolean
language sql stable set search_path = '' as $$
  select community_private.verified() and exists (
    select 1 from public.user_roles r join public.profiles p on p.id=r.user_id
    where r.user_id=auth.uid() and r.role in ('admin','moderator') and p.completed_at is not null
  )
$$;
revoke all on function community_private.verified(),community_private.has_moderator_role() from public,anon,authenticated;
grant execute on function community_private.has_moderator_role() to postgres;

create or replace function community_private.profile_fields(p public.profiles) returns jsonb
language sql stable set search_path = '' as $$
  select case when p.completed_at is not null then jsonb_build_object(
    'username',p.username,'display_name',p.display_name,'country',p.country,
    'region',p.region,'bio',p.bio,'abroad',p.abroad,'avatar_url',p.avatar_url
  ) end
$$;
revoke all on function community_private.profile_fields(public.profiles) from public,anon,authenticated;

create or replace function public.my_profile() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('username',p.username,'display_name',p.display_name,'country',p.country,
    'region',p.region,'bio',p.bio,'abroad',p.abroad,'avatar_url',p.avatar_url,'completed_at',p.completed_at)
  from public.profiles p where p.id=auth.uid()
$$;
create or replace function public.save_profile(
  p_username text,p_name text,p_country text,p_region text,p_bio text,p_abroad boolean,
  p_avatar text,p_terms text,p_privacy text
) returns void
language plpgsql security definer set search_path = '' as $$
declare already_completed timestamptz;
begin
  if not community_private.verified() then raise exception 'Confirm your email first.'; end if;
  if p_username is null or p_username !~ '^[a-z0-9_]{3,20}$' then
    raise exception 'Use 3–20 lowercase letters, numbers or underscores.';
  end if;
  if nullif(btrim(p_name),'') is null or nullif(btrim(p_country),'') is null then
    raise exception 'Enter a display name and country.';
  end if;
  if lower(btrim(p_country))='nigeria' then
    p_country := 'Nigeria';
    if p_region is null or p_region not in ('Abia','Adamawa','Akwa Ibom','Anambra','Bauchi',
      'Bayelsa','Benue','Borno','Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','Abuja (FCT)',
      'Gombe','Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa',
      'Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara') then
      raise exception 'Choose a Nigerian state or FCT.';
    end if;
  end if;
  select completed_at into already_completed from public.profiles where id=auth.uid() for update;
  if not found then raise exception 'Profile unavailable.'; end if;
  if already_completed is null and (p_terms is distinct from 'draft-1' or p_privacy is distinct from 'draft-1') then
    raise exception 'Accept the current Terms and Privacy Policy.';
  end if;
  update public.profiles set username=p_username,display_name=btrim(p_name),
    country=btrim(p_country),region=nullif(btrim(p_region),''),bio=nullif(btrim(p_bio),''),
    abroad=coalesce(p_abroad,false),avatar_url=nullif(btrim(p_avatar),''),
    terms_version=case when already_completed is null then p_terms else terms_version end,
    privacy_version=case when already_completed is null then p_privacy else privacy_version end,
    accepted_at=coalesce(accepted_at,now()),completed_at=coalesce(completed_at,now())
  where id=auth.uid();
exception when unique_violation then
  raise exception 'That username is already taken.' using errcode='23505';
end $$;

revoke all on function public.my_profile(),public.save_profile(text,text,text,text,text,boolean,text,text,text) from public,anon,authenticated;
grant execute on function public.my_profile(),public.save_profile(text,text,text,text,text,boolean,text,text,text) to authenticated;
commit;
