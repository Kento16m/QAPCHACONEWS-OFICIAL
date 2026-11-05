-- Restoring brings back a deleted note. A note that exists is never overwritten from here:
-- the editor's history is the place for that, with a person reviewing the text first.
create or replace function public.admin_restore_article(p_revision_id bigint) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  revision public.article_revisions;
  free_slug text;
  category uuid;
begin
  if not (select private.is_admin()) then
    raise exception 'Solo para administradores.' using errcode = '42501';
  end if;

  select * into revision from public.article_revisions where id = p_revision_id;
  if not found then
    raise exception 'Esa versión ya no existe.' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.articles where id = revision.article_id) then
    raise exception 'Esa nota ya existe.' using errcode = 'QC409';
  end if;

  -- The category may have been deleted since.
  select id into category from public.categories where id = revision.category_id;

  -- The address may have been taken since the note was deleted.
  free_slug := case
    when exists (select 1 from public.articles where slug = revision.slug)
    then revision.slug || '-' || left(revision.article_id::text, 8)
    else revision.slug
  end;

  insert into public.articles (
    id, title, slug, subtitle, excerpt, content, cover_image_url, category_id,
    seo_title, seo_description, status
  ) values (
    revision.article_id, revision.title, free_slug, revision.subtitle, revision.excerpt,
    revision.content, revision.cover_image_url, category,
    revision.seo_title, revision.seo_description, 'draft'
  );
  return revision.article_id;
end;
$$;

-- Breaking news counts from when readers can see it, whatever was ticked before publishing.
create function private.start_breaking() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.is_breaking
     and new.status = 'published'
     and (new.breaking_until is null or new.breaking_until <= now())
     -- On insert there is no old row, so both of these read as "it just started".
     and (old.status is distinct from 'published' or old.is_breaking is not true) then
    new.breaking_until := now() + interval '24 hours';
  end if;
  return new;
end;
$$;

create trigger articles_start_breaking
before insert or update of status, is_breaking on public.articles
for each row execute function private.start_breaking();

-- A name can be changed by its owner and an account can be deleted, so the log keeps who it was.
alter table public.activity_log add column actor_name text, add column actor_email text;

update public.activity_log log set actor_name = p.full_name, actor_email = u.email
from public.profiles p left join auth.users u on u.id = p.id
where p.id = log.actor_id;

create or replace function private.log_activity(p_action text, p_entity text, p_entity_id text, p_summary text)
returns void
language sql security definer set search_path = '' as $$
  insert into public.activity_log (actor_id, actor_name, actor_email, action, entity, entity_id, summary)
  select p.id, p.full_name, u.email, p_action, p_entity, p_entity_id, p_summary
  from (select 1) one
  left join public.profiles p on p.id = auth.uid()
  left join auth.users u on u.id = auth.uid();
$$;
