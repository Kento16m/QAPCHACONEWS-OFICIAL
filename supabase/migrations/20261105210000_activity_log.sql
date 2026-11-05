-- Who did what. Written only by the database, so nobody can skip it or forge it from the browser.
create table public.activity_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  summary text not null,
  created_at timestamptz not null default now()
);

create index activity_log_recent_idx on public.activity_log (id desc);

alter table public.activity_log enable row level security;
create policy activity_log_read_admin on public.activity_log for select to authenticated
  using ((select private.is_admin()));
revoke all on public.activity_log from public, anon, authenticated;
grant select on public.activity_log to authenticated;

create function private.log_activity(p_action text, p_entity text, p_entity_id text, p_summary text)
returns void
language sql security definer set search_path = '' as $$
  insert into public.activity_log (actor_id, action, entity, entity_id, summary)
  select p.id, p_action, p_entity, p_entity_id, p_summary
  from (select 1) one
  left join public.profiles p on p.id = auth.uid();
$$;

create function private.log_article() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- Deleting a category or a user also touches notes: that action is already logged.
  if pg_trigger_depth() > 1 then
    return null;
  end if;

  if tg_op = 'INSERT' then
    perform private.log_activity('created', 'article', new.id::text, new.title);
  elsif tg_op = 'DELETE' then
    perform private.log_activity('deleted', 'article', old.id::text, old.title);
  elsif new.status is distinct from old.status then
    perform private.log_activity(
      case
        when new.status = 'published' then 'published'
        when old.status = 'published' then 'unpublished'
        when new.status = 'archived' then 'archived'
        when new.status = 'scheduled' then 'scheduled'
        else 'status_changed'
      end,
      'article', new.id::text, new.title
    );
  elsif (new.title, new.content) is distinct from (old.title, old.content) then
    perform private.log_activity('edited', 'article', new.id::text, new.title);
  end if;
  return null;
end;
$$;

create trigger articles_log_activity
after insert or update of status, title, content or delete on public.articles
for each row execute function private.log_article();

create function private.log_comment_removed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- A person removing their own comment, or a note taking its comments with it, is not moderation.
  if pg_trigger_depth() > 1 or auth.uid() is null or auth.uid() = old.user_id then
    return null;
  end if;
  perform private.log_activity('deleted', 'comment', old.id::text, left(old.body, 120));
  return null;
end;
$$;

create trigger comments_log_activity
after delete on public.comments
for each row execute function private.log_comment_removed();

create function private.log_profile_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  who text := coalesce(new.full_name, 'Sin nombre');
begin
  if new.role is distinct from old.role then
    perform private.log_activity('role_changed', 'user', new.id::text, who || ': ' || old.role || ' a ' || new.role);
  end if;
  if new.is_blocked is distinct from old.is_blocked then
    perform private.log_activity(case when new.is_blocked then 'blocked' else 'unblocked' end, 'user', new.id::text, who);
  end if;
  return null;
end;
$$;

create trigger profiles_log_activity
after update of role, is_blocked on public.profiles
for each row execute function private.log_profile_change();

create function private.log_taxonomy() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  entity text := case when tg_table_name = 'categories' then 'category' else 'tag' end;
begin
  if tg_op = 'INSERT' then
    perform private.log_activity('created', entity, new.id::text, new.name);
  elsif tg_op = 'DELETE' then
    perform private.log_activity('deleted', entity, old.id::text, old.name);
  elsif new.name is distinct from old.name then
    perform private.log_activity('edited', entity, new.id::text, new.name);
  end if;
  return null;
end;
$$;

create trigger categories_log_activity
after insert or update or delete on public.categories
for each row execute function private.log_taxonomy();

create trigger tags_log_activity
after insert or update or delete on public.tags
for each row execute function private.log_taxonomy();

create function private.log_homepage() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.log_activity('homepage_changed', 'homepage', null, 'Cambió la portada');
  return null;
end;
$$;

-- Saving the homepage rewrites its rows in one statement each: one line per save is enough.
create trigger homepage_slots_log_activity
after delete on public.homepage_slots
for each statement execute function private.log_homepage();
