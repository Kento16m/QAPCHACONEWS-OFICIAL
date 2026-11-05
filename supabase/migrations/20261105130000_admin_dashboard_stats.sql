-- Everything the panel's Hoy screen reads, counted in the database so no list is downloaded.
create function public.admin_dashboard_stats() returns jsonb
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
    'stale_breaking', (select count(*) from public.articles where status = 'published' and is_breaking and published_at < now() - interval '24 hours'),
    'homepage_open_slots', null,
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

revoke all on function public.admin_dashboard_stats() from public, anon;
grant execute on function public.admin_dashboard_stats() to authenticated;
