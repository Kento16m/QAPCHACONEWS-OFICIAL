-- Every saved change keeps what the note said before. Deleting a note keeps them too: there is
-- deliberately no foreign key to articles, so a deleted note can still be read and restored.
create table public.article_revisions (
  id bigint generated always as identity primary key,
  article_id uuid not null,
  title text not null,
  slug text not null,
  subtitle text,
  excerpt text,
  content text not null,
  cover_image_url text,
  category_id uuid references public.categories (id) on delete set null,
  seo_title text,
  seo_description text,
  is_deletion boolean not null default false,
  edited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index article_revisions_article_idx on public.article_revisions (article_id, id desc);

alter table public.article_revisions enable row level security;
create policy article_revisions_read_staff on public.article_revisions for select to authenticated
  using ((select private.is_staff()));
revoke all on public.article_revisions from public, anon, authenticated;
grant select on public.article_revisions to authenticated;

create function private.save_article_revision() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.article_revisions (
    article_id, title, slug, subtitle, excerpt, content, cover_image_url, category_id,
    seo_title, seo_description, is_deletion, edited_by
  ) values (
    old.id, old.title, old.slug, old.subtitle, old.excerpt, old.content, old.cover_image_url,
    old.category_id, old.seo_title, old.seo_description, tg_op = 'DELETE', auth.uid()
  );

  delete from public.article_revisions
  where article_id = old.id
    and id not in (
      select id from public.article_revisions
      where article_id = old.id
      order by id desc
      limit 50
    );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger articles_save_revision
before update of title, slug, subtitle, excerpt, content, cover_image_url, category_id, seo_title, seo_description
on public.articles
for each row
when (
  (old.title, old.slug, old.subtitle, old.excerpt, old.content, old.cover_image_url, old.category_id, old.seo_title, old.seo_description)
  is distinct from
  (new.title, new.slug, new.subtitle, new.excerpt, new.content, new.cover_image_url, new.category_id, new.seo_title, new.seo_description)
)
execute function private.save_article_revision();

create trigger articles_save_revision_on_delete
before delete on public.articles
for each row
execute function private.save_article_revision();

-- Brings back a deleted note as a draft, or puts an existing note back to that version.
create function public.admin_restore_article(p_revision_id bigint) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  revision public.article_revisions;
  free_slug text;
begin
  if not (select private.is_admin()) then
    raise exception 'Solo para administradores.' using errcode = '42501';
  end if;

  select * into revision from public.article_revisions where id = p_revision_id;
  if not found then
    raise exception 'Esa versión ya no existe.' using errcode = 'P0002';
  end if;

  if exists (select 1 from public.articles where id = revision.article_id) then
    update public.articles set
      title = revision.title,
      subtitle = revision.subtitle,
      excerpt = revision.excerpt,
      content = revision.content,
      cover_image_url = revision.cover_image_url,
      category_id = revision.category_id,
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
    revision.content, revision.cover_image_url, revision.category_id,
    revision.seo_title, revision.seo_description, 'draft'
  );
  return revision.article_id;
end;
$$;

revoke all on function public.admin_restore_article(bigint) from public, anon;
grant execute on function public.admin_restore_article(bigint) to authenticated;
