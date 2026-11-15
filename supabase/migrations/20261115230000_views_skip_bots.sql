-- Robots made about three of every four views (logs, 8-15 Nov 2026). The page now counts only
-- after the reader stays and interacts; this also drops robots that name themselves.

-- True for calls through the API from a robot or a script, which send no browser name or a robot's.
create function private.is_bot_request() returns boolean
language plpgsql stable set search_path = '' as $$
declare
  headers text := nullif(current_setting('request.headers', true), '');
  agent text;
begin
  -- Direct database calls (tests, scripts) carry no request headers.
  if headers is null then
    return false;
  end if;
  agent := coalesce(headers::json ->> 'user-agent', '');
  return agent = ''
    or agent ~* '(bot|crawl|spider|slurp|scrap|headless|lighthouse|pagespeed|preview|facebookexternalhit|meta-externalagent|meta-webindexer|python|curl|wget|okhttp|axios|node-fetch|undici|deno|go-http|java/|puppeteer|playwright|selenium|phantomjs)';
end;
$$;

revoke all on function private.is_bot_request() from public, anon, authenticated;

create or replace function public.incrementar_vista(p_articulo_id uuid) returns void
language sql security definer set search_path = '' as $$
  with counted as (
    update public.articles
    set views_count = views_count + 1
    where id = p_articulo_id and status = 'published' and published_at <= now()
      and not private.is_bot_request()
    returning id
  )
  insert into public.article_views_daily (article_id, day, views)
  select id, private.local_day(now()), 1 from counted
  on conflict (article_id, day) do update set views = public.article_views_daily.views + 1;
$$;
