import { requireSupabaseClient } from "@/lib/supabase";

const BUCKET = "article-media";
const MAX_SIDE = 1600;
const WEBP_QUALITY = 0.82;
const CONVERTIBLE = new Set(["image/jpeg", "image/png", "image/webp"]);

export const PAGE_SIZE = 24;
export const IMAGE_TYPES = "image/jpeg,image/png,image/webp,image/gif";
export const MEDIA_TYPES = `${IMAGE_TYPES},video/mp4,video/webm`;

export type MediaAsset = {
  id: string;
  url: string;
  source: "upload" | "url";
  storage_path: string | null;
  mime_type: string | null;
  alt: string;
  width: number | null;
  height: number | null;
  created_at: string;
};

export const validateImageUrl = (url: string) => {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
};

export const canConvert = (type: string) => CONVERTIBLE.has(type);

export const fitWithin = (width: number, height: number, max: number) => {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
};

export const publicFileName = (name: string, stamp: number) =>
  `${stamp}-${name.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-")}`;

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("No pudimos abrir esa imagen."));
    image.src = src;
  });

/** Photos travel smaller and as WebP. If the browser cannot do it, the original goes up instead. */
export const compressImage = async (file: File): Promise<File> => {
  if (!canConvert(file.type)) return file;
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(objectUrl);
    const { width, height } = fitWithin(image.naturalWidth, image.naturalHeight, MAX_SIDE);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", WEBP_QUALITY),
    );
    if (!blob) return file;
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.webp`, { type: "image/webp" });
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

const measure = async (url: string, type: string) => {
  if (!type.startsWith("image/")) return { width: null, height: null };
  try {
    const image = await loadImage(url);
    return { width: image.naturalWidth, height: image.naturalHeight };
  } catch {
    return { width: null, height: null };
  }
};

export const uploadMedia = async (original: File, alt = ""): Promise<MediaAsset> => {
  const client = requireSupabaseClient();
  const file = await compressImage(original);
  const path = publicFileName(file.name || "archivo", Date.now());

  const { error: uploadError } = await client.storage.from(BUCKET).upload(path, file, {
    cacheControl: "31536000",
    contentType: file.type,
  });
  if (uploadError) throw new Error("No pudimos subir el archivo. Probá de nuevo.");

  const { data: urlData } = client.storage.from(BUCKET).getPublicUrl(path);
  const size = await measure(urlData.publicUrl, file.type);
  const { data, error } = await client
    .from("media_assets")
    .insert({
      url: urlData.publicUrl,
      source: "upload",
      storage_path: path,
      mime_type: file.type,
      alt,
      ...size,
    })
    .select()
    .single();
  if (error) throw error;
  return data as MediaAsset;
};

/** Checks that it really loads before keeping it: a broken link would go unnoticed until published. */
export const registerImageUrl = async (url: string, alt = ""): Promise<MediaAsset> => {
  if (!validateImageUrl(url)) throw new Error("La dirección debe empezar con https://");
  const image = await loadImage(url).catch(() => {
    throw new Error("Esa dirección no muestra una imagen. Revisala.");
  });

  const client = requireSupabaseClient();
  const { data: existing } = await client
    .from("media_assets")
    .select()
    .eq("url", url)
    .maybeSingle();
  if (existing) return existing as MediaAsset;

  const { data, error } = await client
    .from("media_assets")
    .insert({
      url,
      source: "url",
      alt,
      width: image.naturalWidth,
      height: image.naturalHeight,
    })
    .select()
    .single();
  if (error) throw error;
  return data as MediaAsset;
};

export const listMedia = async (page: number, q: string) => {
  let query = requireSupabaseClient()
    .from("media_assets")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const term = q.trim().replace(/[%_\\]/g, "\\$&");
  if (term) query = query.ilike("alt", `%${term}%`);
  const { data, error, count } = await query;
  if (error) throw error;
  return { rows: (data ?? []) as MediaAsset[], total: count ?? 0 };
};

export const updateAlt = async (id: string, alt: string) => {
  const { error } = await requireSupabaseClient().from("media_assets").update({ alt }).eq("id", id);
  if (error) throw error;
};

/** Which notes show this image, to warn before removing it. */
export const imageUsage = async (url: string) => {
  const pattern = `%${url.replace(/[%_\\]/g, "\\$&")}%`;
  const value = `"${pattern.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  const { data, error } = await requireSupabaseClient()
    .from("articles")
    .select("id, title")
    .or(`cover_image_url.eq."${url}",content.ilike.${value}`)
    .limit(20);
  if (error) throw error;
  return data ?? [];
};

export const deleteMedia = async (asset: MediaAsset) => {
  const client = requireSupabaseClient();
  const { data, error } = await client
    .from("media_assets")
    .delete()
    .eq("id", asset.id)
    .select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("No pudimos borrarla: ya no existe o no tenés permiso.");
  if (asset.storage_path) {
    const { error: fileError } = await client.storage.from(BUCKET).remove([asset.storage_path]);
    if (fileError) console.error("No se pudo borrar el archivo:", fileError.message);
  }
};
