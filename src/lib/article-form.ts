import type { AdminArticle, ArticleStatus } from "@/lib/admin";
import { createSlug } from "@/lib/slug";

export type EditorForm = {
  title: string;
  slug: string;
  status: ArticleStatus;
  excerpt: string;
  content: string;
  cover_image_url: string;
  category_id: string | null;
  author_id: string | null;
  scheduled_at: string;
  is_featured: boolean;
  is_breaking: boolean;
  seo_title: string;
  seo_description: string;
  tag_ids: string[];
};

export const emptyForm = (): EditorForm => ({
  title: "",
  slug: "",
  status: "draft",
  excerpt: "",
  content: "",
  cover_image_url: "",
  category_id: null,
  author_id: null,
  scheduled_at: "",
  is_featured: false,
  is_breaking: false,
  seo_title: "",
  seo_description: "",
  tag_ids: [],
});

const pad = (value: number) => String(value).padStart(2, "0");

// <input type="datetime-local"> works in the browser's time zone, not UTC.
export const toDateTimeLocal = (iso: string | null) => {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const fromDateTimeLocal = (value: string) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

export const formFromArticle = (article: AdminArticle, tagIds: string[]): EditorForm => ({
  title: article.title,
  slug: article.slug,
  status: article.status,
  excerpt: article.excerpt ?? "",
  content: article.content ?? "",
  cover_image_url: article.cover_image_url ?? "",
  category_id: article.category_id,
  author_id: article.author_id,
  scheduled_at: toDateTimeLocal(article.scheduled_at),
  is_featured: article.is_featured,
  is_breaking: article.is_breaking,
  seo_title: article.seo_title ?? "",
  seo_description: article.seo_description ?? "",
  tag_ids: tagIds,
});

export const buildArticlePayload = (form: EditorForm, existing: AdminArticle | null, now: Date) => {
  const title = form.title.trim();
  if (!title) throw new Error("El título es obligatorio.");

  const scheduledAt = form.status === "scheduled" ? fromDateTimeLocal(form.scheduled_at) : null;
  if (form.status === "scheduled" && !scheduledAt) throw new Error("Elegí la fecha de publicación.");

  // An article keeps its original date; only its first publication sets one.
  const publishedAt = existing?.published_at ?? (form.status === "published" ? now.toISOString() : null);

  return {
    title,
    slug: form.slug.trim() || createSlug(title) || `articulo-${now.getTime()}`,
    status: form.status,
    excerpt: form.excerpt.trim() || null,
    content: form.content,
    cover_image_url: form.cover_image_url.trim() || null,
    category_id: form.category_id,
    author_id: form.author_id,
    scheduled_at: scheduledAt,
    published_at: publishedAt,
    is_featured: form.is_featured,
    is_breaking: form.is_breaking,
    seo_title: form.seo_title.trim() || null,
    seo_description: form.seo_description.trim() || null,
  };
};

export const isNewlyPublished = (previous: ArticleStatus | undefined, next: ArticleStatus) =>
  next === "published" && previous !== "published";
