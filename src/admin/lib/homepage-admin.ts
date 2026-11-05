import { fromDateTimeLocal, toDateTimeLocal } from "@/lib/article-form";
import { buildSearchFilter } from "@/lib/api";
import { requireSupabaseClient } from "@/lib/supabase";

export const SLOT_COUNT = 6;

export type SlotNote = { id: string; title: string; cover_image_url: string | null };
export type BreakingNote = SlotNote & { breaking_until: string | null };

const NOTE_FIELDS = "id, title, cover_image_url";

/** Moves a note to another place. Whatever was there takes the place it left. */
export const moveSlot = <T>(slots: T[], from: number, to: number): T[] => {
  if (from === to || from < 0 || to < 0 || from >= slots.length || to >= slots.length) return slots;
  const next = [...slots];
  [next[from], next[to]] = [next[to]!, next[from]!];
  return next;
};

export const inHours = (hours: number, now = new Date()) =>
  new Date(now.getTime() + hours * 3_600_000).toISOString();

export const toLocalInput = (iso: string | null) => toDateTimeLocal(iso);
export const fromLocalInput = (value: string) => fromDateTimeLocal(value);

export const fetchSlots = async (): Promise<(SlotNote | null)[]> => {
  const { data, error } = await requireSupabaseClient()
    .from("homepage_slots")
    .select(`position, article:articles(${NOTE_FIELDS}, status)`);
  if (error) throw error;

  const slots: (SlotNote | null)[] = Array(SLOT_COUNT).fill(null);
  for (const row of (data ?? []) as unknown as {
    position: number;
    article: (SlotNote & { status: string }) | null;
  }[]) {
    if (row.article?.status === "published") slots[row.position - 1] = row.article;
  }
  return slots;
};

export const saveSlots = async (slots: (SlotNote | null)[]) => {
  const { error } = await requireSupabaseClient().rpc("replace_homepage_slots", {
    p_article_ids: slots.map((note) => note?.id ?? null) as string[],
  });
  if (error) {
    throw new Error(error.code === "QC400" ? error.message : "No pudimos guardar la portada.");
  }
};

export const searchPublished = async (term: string): Promise<SlotNote[]> => {
  let query = requireSupabaseClient()
    .from("articles")
    .select(NOTE_FIELDS)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(30);
  const clean = term.trim();
  if (clean) query = query.or(buildSearchFilter(clean, []));
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
};

export const fetchBreaking = async (): Promise<BreakingNote[]> => {
  const { data, error } = await requireSupabaseClient()
    .from("articles")
    .select(`${NOTE_FIELDS}, breaking_until`)
    .eq("status", "published")
    .eq("is_breaking", true)
    .order("published_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
};

/** A date marks a note as breaking until then. Null takes it out. */
export const setBreaking = async (id: string, until: string | null) => {
  const { data, error } = await requireSupabaseClient()
    .from("articles")
    .update({ is_breaking: until !== null, breaking_until: until })
    .eq("id", id)
    .select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("No pudimos cambiar la última hora de esa nota.");
};
