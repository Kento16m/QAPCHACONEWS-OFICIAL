-- What the writing assistant consumes, per person and day, and the cap that keeps the bill bounded.
create table public.ai_usage (
  day date not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  uses integer not null default 0,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  primary key (day, user_id)
);

alter table public.ai_usage enable row level security;
create policy ai_usage_read_admin on public.ai_usage for select to authenticated
  using ((select private.is_admin()));
revoke all on public.ai_usage from public, anon, authenticated;
grant select on public.ai_usage to authenticated;

-- Only the editor-assist function may call these two.
create function public.service_reserve_ai_use(p_user_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  today date := (now() at time zone 'America/Asuncion')::date;
begin
  -- Serialized, so simultaneous requests cannot slip past the cap.
  perform pg_advisory_xact_lock(hashtextextended('ai_usage', 0));

  if coalesce((select uses from public.ai_usage where day = today and user_id = p_user_id), 0) >= 100 then
    raise exception 'Llegaste al tope diario del asistente.' using errcode = 'QC429';
  end if;
  if coalesce((select sum(uses) from public.ai_usage where day = today), 0) >= 500 then
    raise exception 'El equipo llegó al tope diario del asistente.' using errcode = 'QC429';
  end if;

  insert into public.ai_usage (day, user_id, uses) values (today, p_user_id, 1)
  on conflict (day, user_id) do update set uses = public.ai_usage.uses + 1;
end;
$$;

create function public.service_record_ai_tokens(p_user_id uuid, p_input bigint, p_output bigint) returns void
language sql security definer set search_path = '' as $$
  update public.ai_usage
  set input_tokens = input_tokens + p_input, output_tokens = output_tokens + p_output
  where day = (now() at time zone 'America/Asuncion')::date and user_id = p_user_id;
$$;

revoke all on function public.service_reserve_ai_use(uuid) from public, anon, authenticated;
revoke all on function public.service_record_ai_tokens(uuid, bigint, bigint) from public, anon, authenticated;
grant execute on function public.service_reserve_ai_use(uuid) to service_role;
grant execute on function public.service_record_ai_tokens(uuid, bigint, bigint) to service_role;
