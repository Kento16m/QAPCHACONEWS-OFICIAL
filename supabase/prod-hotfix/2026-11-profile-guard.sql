-- Hotfix for the CURRENT production project only. The new project does not need it.
-- Run in the Supabase SQL editor of production, then check with supabase/prod-hotfix/README.md.
-- Compatible with the deployed app, which still writes profiles from the browser.
begin;

-- Role and block fields only change for an active admin acting on someone else.
-- Not security definer on purpose: current_user must remain the caller.
create or replace function public.guard_profile_fields() returns trigger
language plpgsql set search_path = '' as $$
begin
  -- Signup trigger, service role and SQL editor are trusted; only API users are limited.
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.role := 'reader';
    new.is_blocked := false;
    new.blocked_reason := null;
    return new;
  end if;

  if (new.role, new.is_blocked, new.blocked_reason) is distinct from (old.role, old.is_blocked, old.blocked_reason)
    and (
      old.id = auth.uid()
      or not exists (
        select 1 from public.profiles
        where id = auth.uid() and role = 'admin' and not is_blocked
      )
    ) then
    raise exception 'No podés cambiar el rol o el bloqueo de esta cuenta.' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before insert or update on public.profiles
  for each row execute function public.guard_profile_fields();

-- Visitors keep author names and avatars, but no longer see roles or block reasons.
revoke select on public.profiles from anon;
grant select (id, full_name, avatar_url, profile_color) on public.profiles to anon;

-- Comments must go through moderate-comment, which uses the service role and is unaffected.
drop policy if exists "Authenticated users can insert comments" on public.comments;

commit;

-- To undo:
-- begin;
-- drop trigger if exists profiles_guard on public.profiles;
-- drop function if exists public.guard_profile_fields();
-- grant select on public.profiles to anon;
-- create policy "Authenticated users can insert comments" on public.comments for insert to authenticated
--   with check (auth.uid() = user_id and length(trim(body)) between 1 and 2000);
-- commit;
