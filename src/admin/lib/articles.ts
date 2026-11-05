import { useQuery } from "@tanstack/react-query";
import { getAdminCategories, type ArticleStatus } from "@/lib/admin";
import { buildSearchFilter } from "@/lib/api";
import { requireSupabaseClient } from "@/lib/supabase";

export const PAGE_SIZE = 25;

export type ArticleFilters = {
  page: number;
  q?: string | undefined;
  status?: ArticleStatus | undefined;
  categoryId?: string | undefined;
  authorId?: string | undefined;
};

export type ArticleRow = {
  id: string;
  title: string;
  status: ArticleStatus;
  cover_image_url: string | null;
  published_at: string | null;
  scheduled_at: string | null;
  updated_at: string;
  views_count: number;
  category: { name: string } | null;
  author: { full_name: string | null } | null;
};

const LIST_SELECT = `
  id, title, status, cover_image_url, published_at, scheduled_at, updated_at, views_count,
  category:categories(name),
  author:public_profiles(full_name)
`;

export const listArticles = async ({ page, q, status, categoryId, authorId }: ArticleFilters) => {
  let query = requireSupabaseClient()
    .from("articles")
    .select(LIST_SELECT, { count: "exact" })
    .order("updated_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (status) query = query.eq("status", status);
  if (categoryId) query = query.eq("category_id", categoryId);
  if (authorId) query = query.eq("author_id", authorId);
  const term = q?.trim();
  if (term) query = query.or(buildSearchFilter(term, []));

  const { data, error, count } = await query;
  if (error) throw error;
  return { rows: (data ?? []) as unknown as ArticleRow[], total: count ?? 0 };
};

// RLS answers a refused write with zero rows and no error, so the count is what proves it worked.
const assertAllChanged = (changed: unknown[] | null, ids: string[], verb: string) => {
  const done = changed?.length ?? 0;
  if (done !== ids.length) {
    throw new Error(`Solo se pudo ${verb} ${done} de ${ids.length} notas.`);
  }
};

export const setArticlesStatus = async (ids: string[], status: ArticleStatus) => {
  const { data, error } = await requireSupabaseClient()
    .from("articles")
    .update({ status })
    .in("id", ids)
    .select("id");
  if (error) throw error;
  assertAllChanged(data, ids, "cambiar");
};

export const deleteArticles = async (ids: string[]) => {
  const { data, error } = await requireSupabaseClient()
    .from("articles")
    .delete()
    .in("id", ids)
    .select("id");
  if (error) throw error;
  assertAllChanged(data, ids, "borrar");
};

export const useCategories = () =>
  useQuery({ queryKey: ["admin", "categories"], queryFn: getAdminCategories });

const listAuthors = async () => {
  const { data, error } = await requireSupabaseClient().rpc("list_team_authors");
  if (error) throw error;
  return data ?? [];
};

export const useAuthors = () => useQuery({ queryKey: ["admin", "authors"], queryFn: listAuthors });
