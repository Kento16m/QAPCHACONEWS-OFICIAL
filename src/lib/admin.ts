import type { PostgrestError } from "@supabase/supabase-js";
import type { ArticlePayload } from "@/lib/article-form";
import type { Database } from "@/types/database";
import { createSlug } from "@/lib/slug";
import { requireSupabaseClient } from "@/lib/supabase";

export type ArticleStatus = "draft" | "scheduled" | "published" | "archived";

export interface AdminArticle {
  id: string;
  title: string;
  slug: string;
  status: ArticleStatus;
  excerpt: string | null;
  content: string;
  cover_image_url: string | null;
  published_at: string | null;
  scheduled_at: string | null;
  is_featured: boolean;
  is_breaking: boolean;
  views_count: number;
  category_id: string | null;
  author_id: string | null;
  seo_title: string | null;
  seo_description: string | null;
  updated_at: string;
  category: { id: string; name: string; slug: string } | null;
  author: { id: string; full_name: string | null } | null;
}

export interface AdminAuthor {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: "reader" | "editor" | "admin";
  is_blocked: boolean;
  blocked_reason: string | null;
  email?: string | null;
}

export interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  sort_order: number;
}

export interface AdminTag {
  id: string;
  name: string;
  slug: string;
}

export interface AdminNewsletterSubscriber {
  id: string;
  email: string;
  confirmed: boolean;
  subscribed_at: string | null;
  unsubscribed_at: string | null;
}

export interface AdminAccessLog {
  id: number;
  user_id: string | null;
  email: string | null;
  full_name: string | null;
  role: string | null;
  user_agent: string | null;
  browser: string | null;
  operating_system: string | null;
  language: string | null;
  timezone: string | null;
  referrer: string | null;
  page_url: string | null;
  session_id: string | null;
  ip_address: string | null;
  accessed_at: string;
  status: string | null;
  event_type: string | null;
}

export interface AdminArticleComment {
  id: number;
  article_id: string;
  user_id: string;
  parent_id: number | null;
  body: string;
  like_count: number;
  created_at: string;
  author_name: string | null;
  author_avatar: string | null;
}

export const selectArticleQuery = `
  id,
  title,
  slug,
  status,
  excerpt,
  content,
  cover_image_url,
  published_at,
  scheduled_at,
  is_featured,
  is_breaking,
  views_count,
  category_id,
  author_id,
  seo_title,
  seo_description,
  updated_at,
  category:categories(id,name,slug),
  author:public_profiles(id,full_name,avatar_url)
`;

export type ArticleRow = Omit<AdminArticle, "category" | "author" | "views_count"> & {
  views_count: number | null;
  category: { id: string; name: string; slug: string } | null;
  author: { id: string | null; full_name: string | null } | null;
};

export const mapArticleRow = (row: ArticleRow): AdminArticle => ({
  id: row.id,
  title: row.title,
  slug: row.slug,
  status: row.status,
  excerpt: row.excerpt ?? null,
  content: row.content ?? "",
  cover_image_url: row.cover_image_url ?? null,
  published_at: row.published_at ?? null,
  scheduled_at: row.scheduled_at ?? null,
  is_featured: Boolean(row.is_featured),
  is_breaking: Boolean(row.is_breaking),
  views_count: Number(row.views_count ?? 0),
  category_id: row.category_id ?? null,
  author_id: row.author_id ?? null,
  seo_title: row.seo_title ?? null,
  seo_description: row.seo_description ?? null,
  updated_at: row.updated_at ?? "",
  category: row.category
    ? { id: row.category.id, name: row.category.name, slug: row.category.slug }
    : null,
  author: row.author
    ? { id: row.author.id ?? "", full_name: row.author.full_name ?? "Redacción" }
    : null,
});

const expectRemoved = async (
  query: PromiseLike<{ data: unknown[] | null; error: PostgrestError | null }>,
) => {
  const { data, error } = await query;
  if (error) throw error;
  if (!data?.length) throw new Error("No se pudo eliminar: ya no existe o no tenés permiso.");
};

export async function getAdminArticles(): Promise<AdminArticle[]> {
  const client = requireSupabaseClient();

  const { data, error } = await client
    .from("articles")
    .select(selectArticleQuery)
    .order("published_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map(mapArticleRow);
}

export async function getAdminAuthors(): Promise<AdminAuthor[]> {
  const client = requireSupabaseClient();

  const { data, error } = await client
    .from("profiles")
    .select("id, full_name, avatar_url, role, is_blocked, blocked_reason")
    .order("full_name", { ascending: true, nullsFirst: false });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    full_name: row.full_name,
    avatar_url: row.avatar_url ?? null,
    role: row.role ?? "reader",
    is_blocked: Boolean(row.is_blocked),
    blocked_reason: row.blocked_reason ?? null,
  }));
}

export async function getAdminCategories(): Promise<AdminCategory[]> {
  const client = requireSupabaseClient();

  const { data, error } = await client
    .from("categories")
    .select("id, name, slug, color, sort_order")
    .order("sort_order", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    color: row.color ?? null,
    sort_order: Number(row.sort_order ?? 0),
  }));
}

export async function getAdminTags(): Promise<AdminTag[]> {
  const client = requireSupabaseClient();

  const { data, error } = await client
    .from("tags")
    .select("id, name, slug")
    .order("name", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
  }));
}

export async function getArticleTagIds(articleId: string): Promise<string[]> {
  const client = requireSupabaseClient();

  const { data, error } = await client
    .from("article_tags")
    .select("tag_id")
    .eq("article_id", articleId);

  if (error) throw error;

  return (data ?? []).map((row) => row.tag_id).filter(Boolean);
}

export async function syncArticleTags(articleId: string, tagIds: string[]): Promise<void> {
  const client = requireSupabaseClient();
  const normalizedTagIds = [...new Set((tagIds ?? []).filter(Boolean))];

  const { error: deleteError } = await client
    .from("article_tags")
    .delete()
    .eq("article_id", articleId);
  if (deleteError) throw deleteError;

  if (normalizedTagIds.length === 0) return;

  const rows = normalizedTagIds.map((tagId) => ({ article_id: articleId, tag_id: tagId }));
  const { error: insertError } = await client.from("article_tags").insert(rows);
  if (insertError) throw insertError;
}

export async function getAdminNewsletterSubscribers(): Promise<AdminNewsletterSubscriber[]> {
  const client = requireSupabaseClient();

  const { data, error } = await client
    .from("newsletter_subscribers")
    .select("id, email, confirmed, subscribed_at, unsubscribed_at")
    .order("subscribed_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    email: row.email ?? "",
    confirmed: Boolean(row.confirmed),
    subscribed_at: row.subscribed_at ?? null,
    unsubscribed_at: row.unsubscribed_at ?? null,
  }));
}

export async function getAdminAccessLogs(): Promise<AdminAccessLog[]> {
  const client = requireSupabaseClient();

  const { data, error } = await client
    .from("admin_access_logs")
    .select(
      "id, user_id, email, full_name, role, user_agent, browser, operating_system, language, timezone, referrer, page_url, session_id, ip_address, accessed_at, status, event_type",
    )
    .order("accessed_at", { ascending: false })
    .limit(500);

  if (error) throw error;

  return (data ?? []) as AdminAccessLog[];
}

export async function recordAdminAccessLog(input: {
  user_id: string | null;
  email?: string | null;
  full_name?: string | null;
  role?: string | null;
  user_agent?: string | null;
  browser?: string | null;
  operating_system?: string | null;
  language?: string | null;
  timezone?: string | null;
  referrer?: string | null;
  page_url?: string | null;
  status?: string | null;
  event_type?: string | null;
}): Promise<void> {
  const client = requireSupabaseClient();

  try {
    const payload = {
      user_id: input.user_id,
      email: input.email ?? null,
      full_name: input.full_name ?? null,
      role: input.role ?? null,
      user_agent: input.user_agent ?? null,
      browser: input.browser ?? null,
      operating_system: input.operating_system ?? null,
      language: input.language ?? null,
      timezone: input.timezone ?? null,
      referrer: input.referrer ?? null,
      page_url: input.page_url ?? null,
      status: input.status ?? "success",
      event_type: input.event_type ?? "admin_panel_access",
      accessed_at: new Date().toISOString(),
    };

    const { error } = await client.from("admin_access_logs").insert(payload);
    if (error) throw error;
  } catch (error) {
    console.warn("No se pudo registrar el acceso administrativo.", error);
  }
}

export async function getArticleCommentsForAdmin(
  articleId: string,
): Promise<AdminArticleComment[]> {
  const client = requireSupabaseClient();

  const { data, error } = await client
    .from("comments")
    .select("id, article_id, user_id, parent_id, body, like_count, created_at")
    .eq("article_id", articleId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const commentRows = (data ?? []) as Array<{
    id: number;
    article_id: string;
    user_id: string;
    parent_id: number | null;
    body: string;
    like_count: number;
    created_at: string;
  }>;

  const userIds = [...new Set(commentRows.map((comment) => comment.user_id))];
  let profilesById: Record<string, { full_name: string | null; avatar_url: string | null }> = {};

  if (userIds.length > 0) {
    const { data: profiles, error: profilesError } = await client
      .from("public_profiles")
      .select("id, full_name, avatar_url")
      .in("id", userIds);

    if (profilesError) throw profilesError;

    profilesById = (profiles ?? []).reduce<
      Record<string, { full_name: string | null; avatar_url: string | null }>
    >((acc, profile) => {
      if (!profile.id) return acc;
      acc[profile.id] = {
        full_name: profile.full_name,
        avatar_url: profile.avatar_url,
      };
      return acc;
    }, {});
  }

  return commentRows.map((comment) => ({
    id: Number(comment.id),
    article_id: String(comment.article_id),
    user_id: comment.user_id,
    parent_id: comment.parent_id !== null ? Number(comment.parent_id) : null,
    body: comment.body ?? "",
    like_count: Number(comment.like_count ?? 0),
    created_at: comment.created_at ?? new Date().toISOString(),
    author_name: profilesById[comment.user_id]?.full_name ?? "Usuario",
    author_avatar: profilesById[comment.user_id]?.avatar_url ?? null,
  }));
}

export async function deleteCommentForAdmin(commentId: number): Promise<void> {
  await expectRemoved(
    requireSupabaseClient().from("comments").delete().eq("id", commentId).select("id"),
  );
}

type CategoryInput = { name: string; slug?: string; color: string | null; sort_order: number };

const cleanCategory = (input: CategoryInput) => {
  const name = input.name.trim();
  if (!name) throw new Error("El nombre de la categoría es obligatorio.");
  return {
    name,
    slug: input.slug?.trim() || createSlug(name),
    color: input.color?.trim() || null,
    sort_order: Number(input.sort_order),
  };
};

export async function createCategory(input: CategoryInput): Promise<AdminCategory> {
  const client = requireSupabaseClient();
  const { data, error } = await client
    .from("categories")
    .insert(cleanCategory(input))
    .select("id, name, slug, color, sort_order")
    .single();
  if (error) throw error;

  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    color: data.color ?? null,
    sort_order: Number(data.sort_order ?? 0),
  };
}

export async function updateCategory(id: string, updates: CategoryInput): Promise<AdminCategory> {
  const client = requireSupabaseClient();

  const { data, error } = await client
    .from("categories")
    .update(cleanCategory(updates))
    .eq("id", id)
    .select("id, name, slug, color, sort_order")
    .single();
  if (error) throw error;

  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    color: data.color ?? null,
    sort_order: Number(data.sort_order ?? 0),
  };
}

export async function deleteCategory(id: string): Promise<void> {
  await expectRemoved(
    requireSupabaseClient().from("categories").delete().eq("id", id).select("id"),
  );
}

type TagInput = { name: string; slug?: string };

const cleanTag = (input: TagInput) => {
  const name = input.name.trim();
  if (!name) throw new Error("El nombre de la etiqueta es obligatorio.");
  return { name, slug: input.slug?.trim() || createSlug(name) };
};

export async function createTag(input: TagInput): Promise<AdminTag> {
  const client = requireSupabaseClient();
  const { data, error } = await client
    .from("tags")
    .insert(cleanTag(input))
    .select("id, name, slug")
    .single();
  if (error) throw error;

  return { id: data.id, name: data.name, slug: data.slug };
}

export async function updateTag(id: string, updates: TagInput): Promise<AdminTag> {
  const client = requireSupabaseClient();
  const { data, error } = await client
    .from("tags")
    .update(cleanTag(updates))
    .eq("id", id)
    .select("id, name, slug")
    .single();
  if (error) throw error;

  return { id: data.id, name: data.name, slug: data.slug };
}

export async function deleteTag(id: string): Promise<void> {
  await expectRemoved(requireSupabaseClient().from("tags").delete().eq("id", id).select("id"));
}

async function prepareWebpFile(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) {
    return file;
  }

  const isAlreadyWebp = file.type.toLowerCase() === "image/webp";
  if (isAlreadyWebp) {
    return file;
  }

  try {
    const imageUrl = URL.createObjectURL(file);
    const image = new Image();

    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("No se pudo leer la imagen."));
      image.src = imageUrl;
    });

    const maxSide = 1600;
    const sourceWidth = image.naturalWidth;
    const sourceHeight = image.naturalHeight;
    const scale = Math.min(1, maxSide / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      URL.revokeObjectURL(imageUrl);
      return file;
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/webp", 0.82);
    });

    URL.revokeObjectURL(imageUrl);

    if (!blob) {
      return file;
    }

    const webpName = file.name.replace(/\.[^.]+$/, "") + ".webp";
    return new File([blob], webpName, { type: "image/webp", lastModified: Date.now() });
  } catch {
    return file;
  }
}

export async function uploadArticleCover(file: File): Promise<string> {
  const client = requireSupabaseClient();
  const optimizedFile = await prepareWebpFile(file);

  const baseName = (optimizedFile.name || "article-cover").trim();
  const safeName = baseName.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
  const fileName = `article-covers/${Date.now()}-${safeName}`;

  const { error } = await client.storage.from("article-covers").upload(fileName, optimizedFile, {
    cacheControl: "3600",
    upsert: true,
    contentType: optimizedFile.type || "image/webp",
  });

  if (error) {
    const message = String(error.message ?? "").toLowerCase();
    if (
      message.includes("bucket") ||
      message.includes("not found") ||
      message.includes("does not exist")
    ) {
      throw new Error(
        "El bucket de imágenes no existe en Supabase Storage. Creá el bucket `article-covers` y dejalo público.",
      );
    }
    throw error;
  }

  const { data } = client.storage.from("article-covers").getPublicUrl(fileName);
  if (!data?.publicUrl) {
    throw new Error("No se pudo generar la URL pública de la imagen.");
  }

  return data.publicUrl;
}

export async function uploadArticleMedia(file: File): Promise<string> {
  const client = requireSupabaseClient();
  const fileType = file.type || "application/octet-stream";
  const isImage = fileType.startsWith("image/");
  const optimizedFile = isImage ? await prepareWebpFile(file) : file;

  const baseName = (optimizedFile.name || `article-media-${Date.now()}`).trim();
  const safeName = baseName.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
  const fileName = `article-media/${Date.now()}-${safeName}`;

  const { error } = await client.storage.from("article-media").upload(fileName, optimizedFile, {
    cacheControl: "3600",
    upsert: true,
    contentType: optimizedFile.type || fileType,
  });

  if (error) {
    const message = String(error.message ?? "").toLowerCase();
    if (
      message.includes("bucket") ||
      message.includes("not found") ||
      message.includes("does not exist")
    ) {
      throw new Error(
        "El bucket `article-media` no existe en Supabase Storage. Creá el bucket y dejalo público para poder subir imágenes o videos dentro de los artículos.",
      );
    }
    throw error;
  }

  const { data } = client.storage.from("article-media").getPublicUrl(fileName);
  if (!data?.publicUrl) {
    throw new Error("No se pudo generar la URL pública del archivo multimedia.");
  }

  return data.publicUrl;
}

export async function deleteArticle(id: string): Promise<void> {
  await expectRemoved(requireSupabaseClient().from("articles").delete().eq("id", id).select("id"));
}

const profileChangeError = (error: { code?: string; message: string }) =>
  new Error(
    error.code === "QC403"
      ? "No podés modificar esta cuenta: las cuentas protegidas y la tuya no se cambian desde el panel."
      : error.message,
  );

const mapAdminProfile = (data: Database["public"]["Tables"]["profiles"]["Row"]): AdminAuthor => ({
  id: data.id,
  full_name: data.full_name,
  avatar_url: data.avatar_url ?? null,
  role: data.role ?? "reader",
  is_blocked: Boolean(data.is_blocked),
  blocked_reason: data.blocked_reason ?? null,
});

export async function updateAuthorRole(
  id: string,
  role: AdminAuthor["role"],
): Promise<AdminAuthor> {
  const client = requireSupabaseClient();
  const { data, error } = await client.rpc("admin_set_user_role", { p_user_id: id, p_role: role });
  if (error) throw profileChangeError(error);
  return mapAdminProfile(data);
}

export async function updateUserAccess(
  id: string,
  payload: { is_blocked: boolean; blocked_reason: string | null },
): Promise<AdminAuthor> {
  const client = requireSupabaseClient();
  const { data, error } = await client.rpc("admin_set_user_block", {
    p_user_id: id,
    p_blocked: payload.is_blocked,
    // Ignored by the database when unblocking.
    p_reason: payload.blocked_reason ?? "",
  });
  if (error) throw profileChangeError(error);
  return mapAdminProfile(data);
}

export async function createArticle(payload: ArticlePayload): Promise<AdminArticle> {
  const client = requireSupabaseClient();
  const { data, error } = await client
    .from("articles")
    .insert(payload)
    .select(selectArticleQuery)
    .single();
  if (error) throw error;
  return mapArticleRow(data);
}

export async function updateArticle(
  id: string,
  updates: Partial<ArticlePayload>,
): Promise<AdminArticle> {
  const client = requireSupabaseClient();
  const { data, error } = await client
    .from("articles")
    .update(updates)
    .eq("id", id)
    .select(selectArticleQuery)
    .single();
  if (error) throw error;
  return mapArticleRow(data);
}
