import type { PostgrestError } from "@supabase/supabase-js";
import { requireSupabaseClient } from "@/lib/supabase";
import type { Article, Category, Paginated, Tag } from "@/types";

const makeArticleSelect = (includeContent = true) => {
  const fields = [
    "id",
    "title",
    "slug",
    "subtitle",
    "excerpt",
    includeContent ? "content" : "",
    "cover_image_url",
    "is_featured",
    "is_breaking",
    "reading_time_minutes",
    "seo_title",
    "seo_description",
    "views_count",
    "published_at",
    "category:categories(id,name,slug,color,sort_order)",
    "author:public_profiles(full_name,avatar_url)",
    "tags:article_tags(tag:tags(id,name,slug))",
  ]
    .filter(Boolean)
    .join(",");

  return fields;
};

const normalizePublishedAt = (value: string | null | undefined) =>
  value ?? new Date().toISOString();

const escapeLikeValue = (value: string) => value.replace(/\\/g, "\\\\").replace(/[%_]/g, "\\$&");

// PostgREST treats , . : ( ) as syntax inside or(): double quotes keep them as plain text.
const quoteFilterValue = (value: string) =>
  `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

export const buildSearchFilter = (term: string, categoryIds: string[]) => {
  const pattern = quoteFilterValue(`%${escapeLikeValue(term)}%`);
  const clauses = ["title", "subtitle", "excerpt"].map((field) => `${field}.ilike.${pattern}`);
  if (categoryIds.length > 0) clauses.push(`category_id.in.(${categoryIds.join(",")})`);
  return clauses.join(",");
};

type ArticleRow = Omit<
  Article,
  "tags" | "category" | "author" | "published_at" | "content" | "views_count"
> & {
  content?: string | null;
  views_count?: number | null;
  published_at?: string | null;
  category?: Category | null;
  author?: { full_name: string | null; avatar_url: string | null } | null;
  tags?: Array<{ tag?: { id?: string; name?: string; slug?: string | null } | null }> | null;
};

// The select list is built at run time, so the client cannot infer these rows.
const mapRow = (input: unknown): Article => {
  const row = input as ArticleRow;
  const tags: Tag[] = Array.isArray(row?.tags)
    ? row.tags
        .map((entry) => {
          const tag = entry?.tag;
          if (!tag?.id || !tag?.name) return null;
          return {
            id: tag.id,
            name: tag.name,
            slug: tag.slug ?? tag.name.toLowerCase().replace(/\s+/g, "-"),
          };
        })
        .filter((tag): tag is Tag => tag !== null)
    : [];

  const category = row?.category
    ? {
        id: row.category.id,
        name: row.category.name,
        slug: row.category.slug,
        color: row.category.color ?? null,
        sort_order: row.category.sort_order ?? 0,
      }
    : null;

  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    subtitle: row.subtitle ?? null,
    excerpt: row.excerpt ?? null,
    content: row.content ?? "",
    cover_image_url: row.cover_image_url ?? null,
    category,
    author: row.author
      ? {
          full_name: row.author.full_name ?? "",
          avatar_url: row.author.avatar_url ?? null,
        }
      : null,
    tags,
    is_featured: Boolean(row.is_featured),
    is_breaking: Boolean(row.is_breaking),
    reading_time_minutes: row.reading_time_minutes ?? null,
    seo_title: row.seo_title ?? null,
    seo_description: row.seo_description ?? null,
    views_count: Number(row.views_count ?? 0),
    published_at: normalizePublishedAt(row.published_at),
  };
};

const handleSupabaseError = (error: PostgrestError | null) => {
  if (error) {
    console.error(error);
    throw error;
  }
};

export const getFeaturedArticle = async (): Promise<Article | null> => {
  const client = requireSupabaseClient();
  const latestPublished = () =>
    client
      .from("articles")
      .select(makeArticleSelect(false))
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(1);

  const { data: featured, error: featuredError } = await latestPublished()
    .eq("is_featured", true)
    .maybeSingle();
  handleSupabaseError(featuredError);
  if (featured) return mapRow(featured);

  const { data: latest, error: latestError } = await latestPublished().maybeSingle();
  handleSupabaseError(latestError);
  return latest ? mapRow(latest) : null;
};

export const getBreakingArticles = async (): Promise<Article[]> => {
  const client = requireSupabaseClient();
  const { data, error } = await client
    .from("articles")
    .select(makeArticleSelect(false))
    .eq("status", "published")
    .eq("is_breaking", true)
    .order("published_at", { ascending: false })
    .limit(10);

  handleSupabaseError(error);
  return (data ?? []).map(mapRow);
};

export const getMostReadArticles = async (limit = 5): Promise<Article[]> => {
  const client = requireSupabaseClient();
  const { data, error } = await client
    .from("articles")
    .select(makeArticleSelect(false))
    .eq("status", "published")
    .order("views_count", { ascending: false })
    .limit(limit);

  handleSupabaseError(error);
  return (data ?? []).map(mapRow);
};

export const getLatestArticles = async (limit = 6): Promise<Article[]> => {
  const client = requireSupabaseClient();
  const { data, error } = await client
    .from("articles")
    .select(makeArticleSelect(false))
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(limit);

  handleSupabaseError(error);
  return (data ?? []).map(mapRow);
};

export const getArticlesByCategory = async (
  slug: string,
  page = 1,
  pageSize = 4,
): Promise<Paginated<Article>> => {
  const client = requireSupabaseClient();
  const pageIndex = Math.max(page, 1) - 1;
  const from = pageIndex * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await client
    .from("articles")
    .select(
      "id, title, slug, subtitle, excerpt, cover_image_url, is_featured, is_breaking, reading_time_minutes, seo_title, seo_description, views_count, published_at, category:categories!inner(id,name,slug,color,sort_order), author:public_profiles(full_name,avatar_url), tags:article_tags(tag:tags(id,name,slug))",
      { count: "exact" },
    )
    .eq("status", "published")
    .eq("category.slug", slug)
    .order("published_at", { ascending: false })
    .range(from, to);

  handleSupabaseError(error);
  return {
    items: (data ?? []).map(mapRow),
    total: count ?? 0,
    page,
    pageSize,
  };
};

export const getArticlesByTag = async (
  slug: string,
  page = 1,
  pageSize = 12,
): Promise<Paginated<Article>> => {
  const client = requireSupabaseClient();
  const pageIndex = Math.max(page, 1) - 1;
  const from = pageIndex * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await client
    .from("articles")
    .select(
      "id, title, slug, subtitle, excerpt, cover_image_url, is_featured, is_breaking, reading_time_minutes, seo_title, seo_description, views_count, published_at, category:categories(id,name,slug,color,sort_order), author:public_profiles(full_name,avatar_url), tags:article_tags!inner(tag:tags!inner(id,name,slug))",
      { count: "exact" },
    )
    .eq("status", "published")
    .eq("tags.tag.slug", slug)
    .order("published_at", { ascending: false })
    .range(from, to);

  handleSupabaseError(error);
  return {
    items: (data ?? []).map(mapRow),
    total: count ?? 0,
    page,
    pageSize,
  };
};

export const getArticleBySlug = async (slug: string): Promise<Article | null> => {
  const client = requireSupabaseClient();
  const { data, error } = await client
    .from("articles")
    .select(makeArticleSelect())
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    handleSupabaseError(error);
  }

  return data ? mapRow(data) : null;
};

export const getRelatedArticles = async (
  articleId: string,
  categoryId: string | null,
): Promise<Article[]> => {
  if (!categoryId) return [];
  const client = requireSupabaseClient();
  const { data, error } = await client
    .from("articles")
    .select(makeArticleSelect(false))
    .eq("status", "published")
    .eq("category_id", categoryId)
    .neq("id", articleId)
    .order("published_at", { ascending: false })
    .limit(4);

  handleSupabaseError(error);
  return (data ?? []).map(mapRow);
};

export const getCategories = async (): Promise<Category[]> => {
  const client = requireSupabaseClient();
  const { data, error } = await client
    .from("categories")
    .select("id,name,slug,color,sort_order")
    .order("sort_order", { ascending: true });

  handleSupabaseError(error);
  return (data ?? []) as Category[];
};

export const searchArticles = async (
  term: string,
  page = 1,
  pageSize = 12,
): Promise<Paginated<Article>> => {
  const query = term.trim();
  const client = requireSupabaseClient();
  const pageIndex = Math.max(page, 1) - 1;
  const from = pageIndex * pageSize;
  const to = from + pageSize - 1;

  const baseQuery = client
    .from("articles")
    .select(
      "id, title, slug, subtitle, excerpt, cover_image_url, is_featured, is_breaking, reading_time_minutes, seo_title, seo_description, views_count, published_at, category:categories(id,name,slug,color,sort_order), author:public_profiles(full_name,avatar_url), tags:article_tags(tag:tags(id,name,slug))",
      { count: "exact" },
    )
    .eq("status", "published");

  if (!query) {
    const { data, error, count } = await baseQuery
      .order("published_at", { ascending: false })
      .range(from, to);

    handleSupabaseError(error);
    return {
      items: (data ?? []).map(mapRow),
      total: count ?? 0,
      page,
      pageSize,
    };
  }

  const escaped = escapeLikeValue(query);
  const { data: categoryMatches, error: categoryError } = await client
    .from("categories")
    .select("id")
    .ilike("name", `%${escaped}%`);

  handleSupabaseError(categoryError);

  const categoryIds = [...new Set((categoryMatches ?? []).map((row) => row.id).filter(Boolean))];

  const { data, error, count } = await baseQuery
    .or(buildSearchFilter(query, categoryIds))
    .order("published_at", { ascending: false })
    .range(from, to);

  handleSupabaseError(error);
  return {
    items: (data ?? []).map(mapRow),
    total: count ?? 0,
    page,
    pageSize,
  };
};

export const subscribeNewsletter = async (email: string): Promise<{ ok: true; email: string }> => {
  const client = requireSupabaseClient();

  const { error } = await client.from("newsletter_subscribers").insert({ email });

  if (error) {
    if (error.code === "23505") {
      throw new Error("Este correo ya está suscripto");
    }
    console.error(error);
    throw error;
  }

  return { ok: true, email };
};

export const registerArticleView = async (articleId: string): Promise<void> => {
  const client = requireSupabaseClient();

  if (typeof window === "undefined" || !articleId) return;

  const sessionKey = `qap_article_view_session:${articleId}`;
  const viewStorageKey = "qap_article_view_registry_v2";
  const now = Date.now();
  const ttlMs = 1000 * 60 * 60 * 12;

  try {
    if (window.sessionStorage.getItem(sessionKey) === "1") {
      return;
    }

    const raw = window.localStorage.getItem(viewStorageKey);
    const registry: Record<string, number> = raw ? JSON.parse(raw) : {};
    const lastSeen = Number(registry[articleId] ?? 0);

    if (lastSeen && now - lastSeen < ttlMs) {
      window.sessionStorage.setItem(sessionKey, "1");
      return;
    }

    registry[articleId] = now;
    window.localStorage.setItem(viewStorageKey, JSON.stringify(registry));
    window.sessionStorage.setItem(sessionKey, "1");
  } catch (error) {
    console.warn("No se pudo guardar la deduplicación local de la vista.", error);
    return;
  }

  try {
    const { error } = await client.rpc("incrementar_vista", { p_articulo_id: articleId });
    if (!error) return;

    if (error.code === "PGRST301" || error.code === "42883") {
      console.warn("RPC increment_vista no existe todavía; usando fallback local.");
      return;
    }

    console.error("No se pudo registrar la vista del artículo via RPC:", error);
  } catch (error) {
    console.warn(
      "Fallback de vista no disponible; la vista quedará controlada solo por deduplicación local.",
      error,
    );
  }
};
