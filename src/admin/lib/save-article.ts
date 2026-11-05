import type { PostgrestError } from "@supabase/supabase-js";
import { mapArticleRow, selectArticleQuery, type AdminArticle, type ArticleRow } from "@/lib/admin";
import type { ArticlePayload, EditorForm } from "@/lib/article-form";
import { requireSupabaseClient } from "@/lib/supabase";

export class ArticleConflictError extends Error {
  constructor() {
    super("Otra persona guardó esta nota mientras la editabas.");
    this.name = "ArticleConflictError";
  }
}

const REPEATED_ADDRESS = "Ya existe otra nota con esa dirección. Cambiala para poder guardar.";

const failure = (error: PostgrestError | Error) =>
  "code" in error && error.code === "23505" ? new Error(REPEATED_ADDRESS) : error;

const toArticle = (row: unknown) => mapArticleRow(row as ArticleRow);

export const fetchArticle = async (id: string): Promise<AdminArticle | null> => {
  const { data, error } = await requireSupabaseClient()
    .from("articles")
    .select(selectArticleQuery)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? toArticle(data) : null;
};

/** Saves only over the version that was opened, so nobody overwrites someone else's work unseen. */
export const saveArticle = async (
  id: string | null,
  payload: ArticlePayload & { breaking_until?: string | null },
  expectedUpdatedAt: string | null,
): Promise<AdminArticle> => {
  const client = requireSupabaseClient();

  if (!id) {
    const { data, error } = await client
      .from("articles")
      .insert(payload)
      .select(selectArticleQuery)
      .maybeSingle();
    if (error) throw failure(error);
    return toArticle(data);
  }

  let query = client.from("articles").update(payload).eq("id", id);
  if (expectedUpdatedAt) query = query.eq("updated_at", expectedUpdatedAt);
  const { data, error } = await query.select(selectArticleQuery).maybeSingle();
  if (error) throw failure(error);
  if (!data) throw new ArticleConflictError();
  return toArticle(data);
};

/** Breaking news ends by itself: a note gets 24 hours when it starts, and keeps its date after. */
export const breakingUntilFor = (
  isBreaking: boolean,
  current: Pick<AdminArticle, "is_breaking" | "breaking_until"> | null,
  now: Date,
) => {
  if (!isBreaking) return null;
  if (current?.is_breaking) return current.breaking_until;
  return new Date(now.getTime() + 24 * 3_600_000).toISOString();
};

export const replaceTags = async (articleId: string, tagIds: string[]) => {
  const { error } = await requireSupabaseClient().rpc("replace_article_tags", {
    p_article_id: articleId,
    p_tag_ids: tagIds,
  });
  if (error) throw error;
};

export type Issue = { id: "cover" | "category" | "excerpt" | "seo" | "alt"; message: string };

const hasImageWithoutDescription = (html: string) =>
  [...html.matchAll(/<img\b[^>]*>/gi)].some(([tag]) => !/\balt="[^"]*\S[^"]*"/i.test(tag));

/** What is worth another look before publishing. Never blocks: urgent news cannot wait for SEO. */
export const prePublishIssues = (form: EditorForm): Issue[] => {
  const issues: Issue[] = [];
  if (!form.cover_image_url.trim())
    issues.push({ id: "cover", message: "No tiene foto de portada." });
  if (!form.category_id) issues.push({ id: "category", message: "No tiene sección." });
  if (!form.excerpt.trim()) issues.push({ id: "excerpt", message: "No tiene resumen." });
  if (!form.seo_title.trim() && !form.seo_description.trim()) {
    issues.push({ id: "seo", message: "No tiene título ni descripción para buscadores." });
  }
  if (hasImageWithoutDescription(form.content)) {
    issues.push({ id: "alt", message: "Hay imágenes en el texto sin descripción." });
  }
  return issues;
};

/** What WhatsApp and Facebook will show. Same order as netlify/shared/article-meta.mjs. */
export const shareCard = (form: EditorForm, site: string) => ({
  title: form.seo_title.trim() || form.title.trim(),
  description: form.seo_description.trim() || form.excerpt.trim(),
  image: /^https?:\/\//i.test(form.cover_image_url) ? form.cover_image_url : `${site}/og-image.png`,
  host: new URL(site).hostname,
});
