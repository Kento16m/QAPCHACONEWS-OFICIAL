-- The image library. A file uploaded here or an image that lives at someone else's address.
create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  url text not null unique,
  source text not null check (source in ('upload', 'url')),
  storage_path text,
  mime_type text,
  alt text not null default '',
  width integer,
  height integer,
  uploaded_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint media_assets_https check (url like 'https://%'),
  constraint media_assets_upload_has_path check (source = 'url' or storage_path is not null)
);

create index media_assets_recent_idx on public.media_assets (created_at desc);

alter table public.media_assets enable row level security;
create policy media_assets_read_staff on public.media_assets for select to authenticated
  using ((select private.is_staff()));
create policy media_assets_insert_staff on public.media_assets for insert to authenticated
  with check ((select private.is_staff()));
create policy media_assets_update_staff on public.media_assets for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy media_assets_delete_staff on public.media_assets for delete to authenticated
  using ((select private.is_staff()));

revoke all on public.media_assets from public, anon, authenticated;
grant select, insert, delete on public.media_assets to authenticated;
grant update (alt) on public.media_assets to authenticated;

-- Covers already in use appear in the library from the start.
insert into public.media_assets (url, source, uploaded_by)
select distinct cover_image_url, 'url', null::uuid
from public.articles
where cover_image_url like 'https://%'
on conflict (url) do nothing;
