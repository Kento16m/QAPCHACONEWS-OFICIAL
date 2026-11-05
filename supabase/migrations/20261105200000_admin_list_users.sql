-- The users screen needs each person's email, which lives in auth.users. Administrators only.
create function public.admin_list_users(p_page integer default 1, p_q text default '')
returns table (
  id uuid,
  email text,
  full_name text,
  avatar_url text,
  role public.user_role,
  is_blocked boolean,
  blocked_reason text,
  is_protected boolean,
  created_at timestamptz,
  total bigint
)
language plpgsql stable security definer set search_path = '' as $$
declare
  pattern text := '%' || replace(replace(replace(coalesce(p_q, ''), '\', '\\'), '%', '\%'), '_', '\_') || '%';
begin
  if not (select private.is_admin()) then
    raise exception 'Solo para administradores.' using errcode = '42501';
  end if;

  return query
    select
      p.id, u.email::text, p.full_name, p.avatar_url, p.role, p.is_blocked, p.blocked_reason,
      p.is_protected, p.created_at, count(*) over ()
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.full_name ilike pattern or u.email ilike pattern
    order by p.role = 'reader', p.full_name nulls last, u.email
    limit 25 offset (greatest(p_page, 1) - 1) * 25;
end;
$$;

revoke all on function public.admin_list_users(integer, text) from public, anon;
grant execute on function public.admin_list_users(integer, text) to authenticated;
