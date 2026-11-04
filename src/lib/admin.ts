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
  category: { id: string; name: string; slug: string } | null;
  author: { id: string; full_name: string | null } | null;
}

export const PROTECTED_ADMIN_EMAILS = ["kentoterakawa@gmail.com"];

export const isProtectedAdminEmail = (email?: string | null) => {
  if (!email) return false;
  return PROTECTED_ADMIN_EMAILS.includes(email.trim().toLowerCase());
};

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

const selectArticleQuery = `
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
  category:categories(id,name,slug),
  author:public_profiles(id,full_name,avatar_url)
`;

const mapArticleRow = (row: any): AdminArticle => ({
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
  category: row.category ? { id: row.category.id, name: row.category.name, slug: row.category.slug } : null,
  author: row.author ? { id: row.author.id, full_name: row.author.full_name ?? "Redacción" } : null,
});

async function ensureAdminAccess(): Promise<void> {
  const client = requireSupabaseClient();

  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();

  if (userError || !user) {
    throw new Error("Necesitás iniciar sesión para realizar esta acción.");
  }

  const { data, error } = await client.from("profiles").select("role").eq("id", user.id).maybeSingle();

  if (error) {
    throw error;
  }

  if (data?.role !== "admin") {
    throw new Error("Esta acción solo está permitida para administradores.");
  }
}

export async function getAdminArticles(): Promise<AdminArticle[]> {
  const client = requireSupabaseClient();

  const { data, error } = await client.from("articles").select(selectArticleQuery).order("published_at", { ascending: false });

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

  return (data ?? []).map((row: any) => ({
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

  const { data, error } = await client.from("categories").select("id, name, slug, color, sort_order").order("sort_order", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    color: row.color ?? null,
    sort_order: Number(row.sort_order ?? 0),
  }));
}

export async function getAdminTags(): Promise<AdminTag[]> {
  const client = requireSupabaseClient();

  const { data, error } = await client.from("tags").select("id, name, slug").order("name", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
  }));
}

export async function getArticleTagIds(articleId: string): Promise<string[]> {
  const client = requireSupabaseClient();

  const { data, error } = await client.from("article_tags").select("tag_id").eq("article_id", articleId);

  if (error) throw error;

  return (data ?? []).map((row: any) => row.tag_id).filter(Boolean);
}

export async function syncArticleTags(articleId: string, tagIds: string[]): Promise<void> {
  const client = requireSupabaseClient();
  const normalizedTagIds = [...new Set((tagIds ?? []).filter(Boolean))];

  const { error: deleteError } = await client.from("article_tags").delete().eq("article_id", articleId);
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

  return (data ?? []).map((row: any) => ({
    id: row.id,
    email: row.email ?? "",
    confirmed: Boolean(row.confirmed),
    subscribed_at: row.subscribed_at ?? null,
    unsubscribed_at: row.unsubscribed_at ?? null,
  }));
}

export async function getAdminAccessLogs(): Promise<AdminAccessLog[]> {
  const client = requireSupabaseClient();

  try {
    const { data, error } = await client
      .from("admin_access_logs")
      .select(
        "id, user_id, email, full_name, role, user_agent, browser, operating_system, language, timezone, referrer, page_url, session_id, ip_address, accessed_at, status, event_type"
      )
      .order("accessed_at", { ascending: false });

    if (error) throw error;

    return (data ?? []).map((row: any) => ({
      id: Number(row.id),
      user_id: row.user_id ?? null,
      email: row.email ?? null,
      full_name: row.full_name ?? null,
      role: row.role ?? null,
      user_agent: row.user_agent ?? null,
      browser: row.browser ?? null,
      operating_system: row.operating_system ?? null,
      language: row.language ?? null,
      timezone: row.timezone ?? null,
      referrer: row.referrer ?? null,
      page_url: row.page_url ?? null,
      session_id: row.session_id ?? null,
      ip_address: row.ip_address ?? null,
      accessed_at: row.accessed_at ?? new Date().toISOString(),
      status: row.status ?? "success",
      event_type: row.event_type ?? "admin_panel_access",
    }));
  } catch (error: any) {
    const message = String(error?.message ?? "").toLowerCase();
    if (message.includes("does not exist") || message.includes("relation") || message.includes("admin_access_logs")) {
      return [];
    }
    throw error;
  }
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
  session_id?: string | null;
  ip_address?: string | null;
  status?: string | null;
  event_type?: string | null;
}): Promise<void> {
  const client = requireSupabaseClient();

  const resolveIpAddress = () => {
    if (input.ip_address) return input.ip_address;

    if (typeof document !== "undefined") {
      const referrer = document.referrer || "";
      if (referrer) return `referrer:${referrer}`;
    }

    if (input.user_id) return `auth:${input.user_id.slice(0, 8)}`;

    return null;
  };

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
      session_id: input.session_id ?? null,
      ip_address: resolveIpAddress(),
      status: input.status ?? "success",
      event_type: input.event_type ?? "admin_panel_access",
      accessed_at: new Date().toISOString(),
    };

    const { error } = await client.from("admin_access_logs").insert(payload);
    if (error) {
      const message = String(error.message ?? "").toLowerCase();
      if (message.includes("does not exist") || message.includes("relation") || message.includes("admin_access_logs")) {
        return;
      }
      throw error;
    }
  } catch (error) {
    console.warn("No se pudo registrar el acceso administrativo.", error);
  }
}

export async function getArticleCommentsForAdmin(articleId: string): Promise<AdminArticleComment[]> {
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

    profilesById = (profiles ?? []).reduce<Record<string, { full_name: string | null; avatar_url: string | null }>>((acc, profile) => {
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
  await ensureAdminAccess();
  const client = requireSupabaseClient();

  const { error } = await client.from("comments").delete().eq("id", commentId);
  if (error) throw error;
}

export async function createCategory(input: Partial<{ name: string; slug: string; color: string | null; sort_order: number }>): Promise<AdminCategory> {
  await ensureAdminAccess();
  const client = requireSupabaseClient();
  const name = (input.name ?? "").trim();
  if (!name) throw new Error("El nombre de la categoría es obligatorio.");

  const payload = {
    name,
    slug: (input.slug ?? createSlug(name)).trim() || createSlug(name),
    color: input.color?.trim() || null,
    sort_order: Number(input.sort_order ?? 0),
  };

  const { data, error } = await client.from("categories").insert(payload).select("id, name, slug, color, sort_order").single();
  if (error) throw error;

  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    color: data.color ?? null,
    sort_order: Number(data.sort_order ?? 0),
  };
}

export async function updateCategory(
  id: string,
  updates: Partial<{ name: string; slug: string; color: string | null; sort_order: number }>
): Promise<AdminCategory> {
  await ensureAdminAccess();
  const client = requireSupabaseClient();

  const nextUpdates: Record<string, any> = { ...updates };
  if (nextUpdates.name !== undefined) nextUpdates.name = nextUpdates.name.trim();
  if (nextUpdates.slug !== undefined) nextUpdates.slug = nextUpdates.slug.trim();
  if (nextUpdates.color !== undefined) nextUpdates.color = nextUpdates.color?.trim() || null;
  if (nextUpdates.sort_order !== undefined) nextUpdates.sort_order = Number(nextUpdates.sort_order ?? 0);

  if (!nextUpdates.name) throw new Error("El nombre de la categoría es obligatorio.");
  if (!nextUpdates.slug) nextUpdates.slug = createSlug(nextUpdates.name);

  const { data, error } = await client.from("categories").update(nextUpdates).eq("id", id).select("id, name, slug, color, sort_order").single();
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
  await ensureAdminAccess();
  const client = requireSupabaseClient();
  const { error } = await client.from("categories").delete().eq("id", id);
  if (error) throw error;
}

export async function createTag(input: Partial<{ name: string; slug: string }>): Promise<AdminTag> {
  await ensureAdminAccess();
  const client = requireSupabaseClient();
  const name = (input.name ?? "").trim();
  if (!name) throw new Error("El nombre de la etiqueta es obligatorio.");

  const payload = {
    name,
    slug: (input.slug ?? createSlug(name)).trim() || createSlug(name),
  };

  const { data, error } = await client.from("tags").insert(payload).select("id, name, slug").single();
  if (error) throw error;

  return { id: data.id, name: data.name, slug: data.slug };
}

export async function updateTag(id: string, updates: Partial<{ name: string; slug: string }>): Promise<AdminTag> {
  await ensureAdminAccess();
  const client = requireSupabaseClient();
  const nextUpdates: Record<string, any> = { ...updates };

  if (nextUpdates.name !== undefined) nextUpdates.name = nextUpdates.name.trim();
  if (nextUpdates.slug !== undefined) nextUpdates.slug = nextUpdates.slug.trim();

  if (!nextUpdates.name) throw new Error("El nombre de la etiqueta es obligatorio.");
  if (!nextUpdates.slug) nextUpdates.slug = createSlug(nextUpdates.name);

  const { data, error } = await client.from("tags").update(nextUpdates).eq("id", id).select("id, name, slug").single();
  if (error) throw error;

  return { id: data.id, name: data.name, slug: data.slug };
}

export async function deleteTag(id: string): Promise<void> {
  await ensureAdminAccess();
  const client = requireSupabaseClient();
  const { error } = await client.from("tags").delete().eq("id", id);
  if (error) throw error;
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
    if (message.includes("bucket") || message.includes("not found") || message.includes("does not exist")) {
      throw new Error("El bucket de imágenes no existe en Supabase Storage. Creá el bucket `article-covers` y dejalo público.");
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
    if (message.includes("bucket") || message.includes("not found") || message.includes("does not exist")) {
      throw new Error("El bucket `article-media` no existe en Supabase Storage. Creá el bucket y dejalo público para poder subir imágenes o videos dentro de los artículos.");
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
  await ensureAdminAccess();
  const client = requireSupabaseClient();
  const { error } = await client.from("articles").delete().eq("id", id);
  if (error) throw error;
}

const profileChangeError = (error: { code?: string; message: string }) =>
  new Error(
    error.code === "QC403"
      ? "No podés modificar esta cuenta: las cuentas protegidas y la tuya no se cambian desde el panel."
      : error.message,
  );

const mapAdminProfile = (data: any): AdminAuthor => ({
  id: data.id,
  full_name: data.full_name,
  avatar_url: data.avatar_url ?? null,
  role: data.role ?? "reader",
  is_blocked: Boolean(data.is_blocked),
  blocked_reason: data.blocked_reason ?? null,
});

export async function updateAuthorRole(id: string, role: AdminAuthor["role"]): Promise<AdminAuthor> {
  const client = requireSupabaseClient();
  const { data, error } = await client.rpc("admin_set_user_role", { p_user_id: id, p_role: role });
  if (error) throw profileChangeError(error);
  return mapAdminProfile(data);
}

export async function updateUserAccess(id: string, payload: { is_blocked: boolean; blocked_reason: string | null }): Promise<AdminAuthor> {
  const client = requireSupabaseClient();
  const { data, error } = await client.rpc("admin_set_user_block", {
    p_user_id: id,
    p_blocked: payload.is_blocked,
    p_reason: payload.blocked_reason,
  });
  if (error) throw profileChangeError(error);
  return mapAdminProfile(data);
}

export async function createArticle(
  input: Partial<{
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
    category_id: string | null;
    author_id: string | null;
    seo_title: string | null;
    seo_description: string | null;
  }>
): Promise<AdminArticle> {
  const client = requireSupabaseClient();

  const payload = {
    title: input.title?.trim() ?? "",
    slug: (input.slug ?? createSlug(input.title ?? "")).trim() || createSlug(input.title ?? "") || `articulo-${Date.now()}`,
    status: input.status ?? "draft",
    excerpt: input.excerpt?.trim() || null,
    content: input.content ?? "",
    cover_image_url: input.cover_image_url?.trim() || null,
    published_at: input.status === "published" ? (input.published_at ?? new Date().toISOString()) : null,
    scheduled_at: input.status === "scheduled" ? (input.scheduled_at ?? new Date().toISOString()) : null,
    is_featured: Boolean(input.is_featured),
    is_breaking: Boolean(input.is_breaking),
    category_id: input.category_id ?? null,
    author_id: input.author_id ?? null,
    seo_title: input.seo_title?.trim() || null,
    seo_description: input.seo_description?.trim() || null,
  };

  if (!payload.title) throw new Error("El título es obligatorio.");

  const { data, error } = await client.from("articles").insert(payload).select(selectArticleQuery).single();

  if (error) throw error;

  return mapArticleRow(data);
}

export async function updateArticle(
  id: string,
  updates: Partial<{
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
    category_id: string | null;
    author_id: string | null;
    seo_title: string | null;
    seo_description: string | null;
  }>
): Promise<AdminArticle> {
  const client = requireSupabaseClient();

  const nextUpdates: Record<string, any> = { ...updates };
  if (nextUpdates.title) nextUpdates.title = nextUpdates.title.trim();
  if (nextUpdates.slug) nextUpdates.slug = nextUpdates.slug.trim();
  if (nextUpdates.excerpt !== undefined) nextUpdates.excerpt = nextUpdates.excerpt?.trim() || null;
  if (nextUpdates.content !== undefined) nextUpdates.content = nextUpdates.content ?? "";
  if (nextUpdates.cover_image_url !== undefined) nextUpdates.cover_image_url = nextUpdates.cover_image_url?.trim() || null;
  if (nextUpdates.seo_title !== undefined) nextUpdates.seo_title = nextUpdates.seo_title?.trim() || null;
  if (nextUpdates.seo_description !== undefined) nextUpdates.seo_description = nextUpdates.seo_description?.trim() || null;

  if (nextUpdates.slug === "" && nextUpdates.title) {
    nextUpdates.slug = createSlug(nextUpdates.title);
  }

  if (nextUpdates.status === "published") {
    nextUpdates.published_at = nextUpdates.published_at ?? new Date().toISOString();
    nextUpdates.scheduled_at = null;
  }

  if (nextUpdates.status === "scheduled") {
    nextUpdates.scheduled_at = nextUpdates.scheduled_at ?? new Date().toISOString();
    nextUpdates.published_at = nextUpdates.published_at ?? null;
  }

  if (nextUpdates.status && nextUpdates.status !== "published" && nextUpdates.status !== "scheduled") {
    nextUpdates.published_at = nextUpdates.published_at ?? null;
    nextUpdates.scheduled_at = nextUpdates.scheduled_at ?? null;
  }

  const { data, error } = await client.from("articles").update(nextUpdates).eq("id", id).select(selectArticleQuery).single();

  if (error) throw error;

  return mapArticleRow(data);
}
