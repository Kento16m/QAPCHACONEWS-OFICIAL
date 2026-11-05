-- A version must not hold a category in place: deleting the category sets the note's to null, which
-- saves a version pointing at the category being deleted, and a foreign key would refuse that.
alter table public.article_revisions drop constraint article_revisions_category_id_fkey;

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

  -- The category may have been deleted since.
  select id into category from public.categories where id = revision.category_id;

  if exists (select 1 from public.articles where id = revision.article_id) then
    update public.articles set
      title = revision.title,
      subtitle = revision.subtitle,
      excerpt = revision.excerpt,
      content = revision.content,
      cover_image_url = revision.cover_image_url,
      category_id = category,
      seo_title = revision.seo_title,
      seo_description = revision.seo_description
    where id = revision.article_id;
    return revision.article_id;
  end if;

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

-- Everyone in the team can choose a colleague as author. Roles and block reasons stay private.
create function public.list_team_authors() returns table (id uuid, full_name text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (select private.is_staff()) then
    raise exception 'Solo para el equipo.' using errcode = '42501';
  end if;
  return query
    select p.id, p.full_name
    from public.profiles p
    where p.role in ('editor', 'admin')
       or exists (select 1 from public.articles a where a.author_id = p.id)
    order by p.full_name nulls last;
end;
$$;

revoke all on function public.list_team_authors() from public, anon;
grant execute on function public.list_team_authors() to authenticated;
