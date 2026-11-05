-- Which notes lead the homepage: place 1 is the main note, 2 to 6 the featured block.
create table public.homepage_slots (
  position integer primary key check (position between 1 and 6),
  article_id uuid references public.articles (id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.homepage_slots enable row level security;
create policy homepage_slots_read on public.homepage_slots for select to anon, authenticated
  using (true);
revoke all on public.homepage_slots from public, anon, authenticated;
grant select on public.homepage_slots to anon, authenticated;

-- Breaking news ends on its own. Null keeps today's behaviour for notes the old panel marks.
alter table public.articles add column breaking_until timestamptz;
grant insert (breaking_until), update (breaking_until) on public.articles to authenticated;

create function public.replace_homepage_slots(p_article_ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (select private.is_staff()) then
    raise exception 'Solo para el equipo.' using errcode = '42501';
  end if;
  if coalesce(array_length(p_article_ids, 1), 0) > 6 then
    raise exception 'La portada tiene 6 lugares.' using errcode = 'QC400';
  end if;
  if (select count(*) from unnest(p_article_ids) as chosen_id where chosen_id is not null)
     <> (select count(distinct chosen_id) from unnest(p_article_ids) as chosen_id where chosen_id is not null) then
    raise exception 'Una nota no puede ocupar dos lugares.' using errcode = 'QC400';
  end if;
  if exists (
    select 1 from unnest(p_article_ids) as chosen_id
    where chosen_id is not null and not exists (
      select 1 from public.articles a
      where a.id = chosen_id and a.status = 'published' and a.published_at <= now()
    )
  ) then
    raise exception 'Solo van en portada las notas publicadas.' using errcode = 'QC400';
  end if;

  delete from public.homepage_slots where position >= 1;
  insert into public.homepage_slots (position, article_id)
  select ordinality, chosen_id from unnest(p_article_ids) with ordinality as chosen (chosen_id, ordinality)
  where chosen_id is not null;
end;
$$;

revoke all on function public.replace_homepage_slots(uuid[]) from public, anon;
grant execute on function public.replace_homepage_slots(uuid[]) to authenticated;

create or replace function public.admin_dashboard_stats() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (select private.is_staff()) then
    raise exception 'Solo para el equipo.' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'published', (select count(*) from public.articles where status = 'published'),
    'articles_total', (select count(*) from public.articles),
    'total_reads', (select coalesce(sum(views_count), 0) from public.articles),
    'comments_total', (select count(*) from public.comments),
    'comments_24h', (select count(*) from public.comments where created_at > now() - interval '24 hours'),
    'subscribers', (select count(*) from public.newsletter_subscribers where confirmed and unsubscribed_at is null),
    'users_total', (select count(*) from public.profiles),
    'stale_drafts', (select count(*) from public.articles where status = 'draft' and updated_at < now() - interval '7 days'),
    'scheduled_24h', (select count(*) from public.articles where status = 'scheduled' and scheduled_at <= now() + interval '24 hours'),
    'stale_breaking', (
      select count(*) from public.articles
      where status = 'published' and is_breaking and breaking_until is null
        and published_at < now() - interval '24 hours'
    ),
    'homepage_open_slots', 6 - (
      select count(*) from public.homepage_slots s
      join public.articles a on a.id = s.article_id
      where a.status = 'published' and a.published_at <= now()
    ),
    'most_read', coalesce((
      select jsonb_agg(row_to_json(top)) from (
        select a.id, a.title, a.views_count as reads, a.published_at, c.name as category
        from public.articles a left join public.categories c on c.id = a.category_id
        where a.status = 'published'
        order by a.views_count desc, a.published_at desc
        limit 5
      ) top
    ), '[]'::jsonb),
    'by_category', coalesce((
      select jsonb_agg(row_to_json(cat)) from (
        select c.id, c.name, coalesce(sum(a.views_count), 0) as reads, count(a.id) as notes
        from public.categories c
        join public.articles a on a.category_id = c.id and a.status = 'published'
        group by c.id, c.name
        order by reads desc, c.name
        limit 6
      ) cat
    ), '[]'::jsonb)
  );
end;
$$;
