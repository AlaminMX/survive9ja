begin;

alter table community_private.entries add column if not exists voice_only boolean not null default false;
alter table community_private.entries drop constraint if exists entries_check2;
alter table community_private.entries add constraint entries_check2 check (
  (root_id is null and title is not null and char_length(btrim(title)) between 1 and 140
    and category is not null
    and ((not voice_only and char_length(btrim(body)) between 1 and case when kind='diary' then 20000 else 6000 end)
      or (kind='square' and voice_only and body='')))
  or (root_id is not null and not voice_only and title is null and category is null
    and char_length(btrim(body)) between 1 and 2000)
);

create or replace function public.publish_gist_with_voice(
  p_path text,p_title text,p_body text,p_category text,p_circle text default '',
  p_circle_name text default null,p_circle_description text default null
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare member uuid; clip community_private.gist_voice_notes; published uuid; circle_slug text;
  body_text text := coalesce(nullif(btrim(p_body,E' \t\r\n'),''),'');
  publication_body text := coalesce(nullif(body_text,''),'Voice note');
begin
  member := community_private.require_member();
  select * into clip from community_private.gist_voice_notes where path=p_path and owner_id=member for update;
  if not found then raise exception 'Upload a voice note first.'; end if;
  if clip.entry_id is not null then
    select c.slug into circle_slug from community_private.entries e
      join community_private.circles c on c.id=e.circle_id where e.id=clip.entry_id;
    return jsonb_build_object('id',clip.entry_id,'circle_slug',circle_slug);
  end if;
  if clip.created_at<=now()-interval '1 day' then raise exception 'This upload expired. Attach the audio again.'; end if;
  perform 1 from storage.objects where bucket_id='gist-voice-notes' and name=p_path for share;
  if not found then raise exception 'The voice note upload is missing.'; end if;
  if p_circle_name is not null then
    circle_slug := public.create_circle(p_circle_name,p_circle_description,p_title,publication_body,p_category);
    select e.id into strict published from community_private.entries e
      join community_private.circles c on c.id=e.circle_id where c.slug=circle_slug;
  elsif nullif(p_circle,'') is not null then
    circle_slug := p_circle;
    published := public.publish_circle_post(circle_slug,p_title,publication_body,p_category);
  else
    published := public.publish_entry('square',p_title,publication_body,p_category,false);
  end if;
  update community_private.gist_voice_notes set entry_id=published where path=p_path;
  -- Preserve the existing writers' validation and quotas. The placeholder is never committed.
  if body_text='' then
    update community_private.entries set body='',voice_only=true where id=published;
  end if;
  return jsonb_build_object('id',published,'circle_slug',circle_slug);
end $$;

commit;
