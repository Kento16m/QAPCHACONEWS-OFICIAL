-- Reads per day, to see trends. Total reads stay in articles.views_count, as before.
create table public.article_views_daily (
  article_id uuid not null references public.articles (id) on delete cascade,
  day date not null,
  views integer not null default 0,
  primary key (article_id, day)
);

create index article_views_daily_day_idx on public.article_views_daily (day);

alter table public.article_views_daily enable row level security;
create policy article_views_daily_read_staff on public.article_views_daily for select to authenticated
  using ((select private.is_staff()));
revoke all on public.article_views_daily from public, anon, authenticated;
grant select on public.article_views_daily to authenticated;

create function private.local_day(p_at timestamptz) returns date
language sql immutable set search_path = '' as $$
  select (p_at at time zone 'America/Asuncion')::date;
$$;

create or replace function public.incrementar_vista(p_articulo_id uuid) returns void
language sql security definer set search_path = '' as $$
  with counted as (
    update public.articles
    set views_count = views_count + 1
    where id = p_articulo_id and status = 'published' and published_at <= now()
    returning id
  )
  insert into public.article_views_daily (article_id, day, views)
  select id, private.local_day(now()), 1 from counted
  on conflict (article_id, day) do update set views = public.article_views_daily.views + 1;
$$;

create function public.admin_reads_series(p_from date, p_to date)
returns table (day date, reads bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (select private.is_staff()) then
    raise exception 'Solo para el equipo.' using errcode = '42501';
  end if;
  return query
    select v.day, sum(v.views)::bigint
    from public.article_views_daily v
    where v.day between p_from and p_to
    group by v.day
    order by v.day;
end;
$$;

create function public.admin_reads_by(p_dimension text, p_from date, p_to date)
returns table (id text, label text, reads bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (select private.is_staff()) then
    raise exception 'Solo para el equipo.' using errcode = '42501';
  end if;
  if p_dimension not in ('article', 'category', 'author') then
    raise exception 'No se puede agrupar así.' using errcode = '22023';
  end if;

  return query
    select
      case p_dimension
        when 'article' then a.id::text
        when 'category' then a.category_id::text
        else a.author_id::text
      end,
      case p_dimension
        when 'article' then a.title
        when 'category' then coalesce(c.name, 'Sin sección')
        else coalesce(p.full_name, 'Redacción')
      end,
      sum(v.views)::bigint
    from public.article_views_daily v
    join public.articles a on a.id = v.article_id
    left join public.categories c on c.id = a.category_id
    left join public.profiles p on p.id = a.author_id
    where v.day between p_from and p_to
    group by 1, 2
    order by 3 desc, 2
    limit 10;
end;
$$;

revoke all on function public.admin_reads_series(date, date) from public, anon;
revoke all on function public.admin_reads_by(text, date, date) from public, anon;
grant execute on function public.admin_reads_series(date, date) to authenticated;
grant execute on function public.admin_reads_by(text, date, date) to authenticated;
