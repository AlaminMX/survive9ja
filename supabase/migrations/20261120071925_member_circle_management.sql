begin;

-- Expose a viewer-specific flag without returning the owner's ID.
create or replace function community_private.circle_card(c community_private.circles) returns jsonb
language sql stable set search_path='' as $$
  select jsonb_build_object(
    'slug',c.slug,'name',c.name,'description',c.description,'starter',c.starter,
    'owned',coalesce(c.owner_id=auth.uid(),false),
    'following',exists(select 1 from community_private.circle_follows f
      where f.circle_id=c.id and f.user_id=auth.uid())
  )
$$;
revoke all on function community_private.circle_card(community_private.circles) from public,anon,authenticated;

create index if not exists circles_active_owner_idx
  on community_private.circles(owner_id,created_at desc,slug)
  where not archived and owner_id is not null;

create or replace function public.my_created_circles() returns jsonb
language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(community_private.circle_card(c) order by c.created_at desc,c.slug),'[]'::jsonb)
  from community_private.circles c
  where not c.archived and c.owner_id=auth.uid()
$$;

create or replace function public.rename_circle(p_slug text,p_name text) returns text
language plpgsql security definer set search_path='' as $$
declare member uuid; saved_name text;
begin
  member := community_private.require_member();
  if coalesce(char_length(btrim(p_name)),0) not between 3 and 60 then
    raise exception 'Enter a Circle name between 3 and 60 characters.';
  end if;
  update community_private.circles
    set name=btrim(p_name)
    where slug=p_slug and owner_id=member and not archived
    returning name into saved_name;
  if not found then raise exception 'Only the owner can rename an active Circle.'; end if;
  return saved_name;
end $$;

revoke all on function public.my_created_circles(),public.rename_circle(text,text) from public,anon,authenticated;
grant execute on function public.my_created_circles(),public.rename_circle(text,text) to authenticated;

commit;
