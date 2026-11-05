-- Saving a note replaces its tags in one step, so a failure can never leave it without any.
create function public.replace_article_tags(p_article_id uuid, p_tag_ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (select private.is_staff()) then
    raise exception 'Solo para el equipo.' using errcode = '42501';
  end if;

  delete from public.article_tags
  where article_id = p_article_id and not (tag_id = any (p_tag_ids));

  insert into public.article_tags (article_id, tag_id)
  select p_article_id, tag_id from unnest(p_tag_ids) as tag_id
  on conflict do nothing;
end;
$$;

revoke all on function public.replace_article_tags(uuid, uuid[]) from public, anon;
grant execute on function public.replace_article_tags(uuid, uuid[]) to authenticated;
