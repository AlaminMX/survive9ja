begin;

-- Requires the Square and Diaries migrations. Keep all publication checks except account age.
create or replace function public.publish_entry(p_kind text,p_title text,p_body text,p_category text,p_anonymous boolean default false) returns uuid
language plpgsql security definer set search_path = '' as $$
declare member uuid; result uuid;
begin
  member := community_private.require_member();
  if p_kind='diary' then
    perform community_private.validate_diary_tag(p_category);
    if coalesce(p_anonymous,false) and not exists(select 1 from community_private.pilot_config where singleton and anonymous_diaries)
      then raise exception 'Anonymous publishing is currently disabled.'; end if;
    perform community_private.take_slot(member,'diary',5);
  elsif p_kind='square' then
    if coalesce(p_anonymous,false) then raise exception 'Discussions are published under your public profile name.'; end if;
    perform community_private.validate_square_category(p_category);
    perform community_private.take_slot(member,'square',10);
  else raise exception 'Choose a valid publication type.';
  end if;
  insert into community_private.entries(kind,owner_id,title,body,category,anonymous)
  values(p_kind,member,btrim(p_title),btrim(p_body),p_category,coalesce(p_anonymous,false)) returning id into result;
  return result;
end $$;

commit;
