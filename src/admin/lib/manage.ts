import { requireSupabaseClient } from "@/lib/supabase";

export const PAGE_SIZE = 25;
const range = (page: number) => [(page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1] as const;
const escapeLike = (term: string) => term.replace(/[%_\\]/g, "\\$&");

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

export type CommentRow = {
  id: number;
  body: string;
  user_id: string;
  like_count: number;
  created_at: string;
  article: { id: string; title: string } | null;
  author: { full_name: string | null } | null;
};

export const listComments = async (page: number, articleId: string | null, days: number | null) => {
  const client = requireSupabaseClient();
  let query = client
    .from("comments")
    .select("id, body, user_id, like_count, created_at, article:articles(id, title)", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(...range(page));
  if (articleId) query = query.eq("article_id", articleId);
  if (days) query = query.gte("created_at", daysAgo(days));
  const { data, error, count } = await query;
  if (error) throw error;

  // Comments point at auth.users, so names cannot come in the same query.
  const rows = (data ?? []) as unknown as Omit<CommentRow, "author">[];
  const ids = [...new Set(rows.map((row) => row.user_id))];
  const { data: people } = ids.length
    ? await client.from("public_profiles").select("id, full_name").in("id", ids)
    : { data: [] };
  const names = new Map((people ?? []).map((person) => [person.id, person.full_name]));

  return {
    rows: rows.map((row) => ({ ...row, author: { full_name: names.get(row.user_id) ?? null } })),
    total: count ?? 0,
  };
};

export type UserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  role: "reader" | "editor" | "admin";
  is_blocked: boolean;
  blocked_reason: string | null;
  is_protected: boolean;
  created_at: string;
  total: number;
};

export const listUsers = async (page: number, q: string) => {
  const { data, error } = await requireSupabaseClient().rpc("admin_list_users", {
    p_page: page,
    p_q: q.trim(),
  });
  if (error) throw error;
  const rows = (data ?? []) as unknown as UserRow[];
  return { rows, total: rows[0]?.total ?? 0 };
};

export type Subscriber = {
  id: string;
  email: string;
  confirmed: boolean;
  subscribed_at: string | null;
  unsubscribed_at: string | null;
};

export const listSubscribers = async (page: number) => {
  const { data, error, count } = await requireSupabaseClient()
    .from("newsletter_subscribers")
    .select("id, email, confirmed, subscribed_at, unsubscribed_at", { count: "exact" })
    .order("subscribed_at", { ascending: false })
    .range(...range(page));
  if (error) throw error;
  return { rows: (data ?? []) as Subscriber[], total: count ?? 0 };
};

export const allSubscribers = async () => {
  const { data, error } = await requireSupabaseClient()
    .from("newsletter_subscribers")
    .select("id, email, confirmed, subscribed_at, unsubscribed_at")
    .order("subscribed_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Subscriber[];
};

export const deleteSubscriber = async (id: string) => {
  const { data, error } = await requireSupabaseClient()
    .from("newsletter_subscribers")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("No pudimos quitarlo: ya no existe o no tenés permiso.");
};

export type ActivityRow = {
  id: number;
  action: string;
  entity: string;
  entity_id: string | null;
  summary: string;
  created_at: string;
  actor: { full_name: string | null } | null;
};

export const listActivity = async (page: number) => {
  const { data, error, count } = await requireSupabaseClient()
    .from("activity_log")
    .select(
      "id, action, entity, entity_id, summary, created_at, actor:public_profiles(full_name)",
      {
        count: "exact",
      },
    )
    .order("id", { ascending: false })
    .range(...range(page));
  if (error) throw error;
  return { rows: (data ?? []) as unknown as ActivityRow[], total: count ?? 0 };
};

/** Brings a deleted note back as a draft, from the copy kept when it was deleted. */
export const restoreDeletedNote = async (articleId: string) => {
  const client = requireSupabaseClient();
  const { data: revision, error } = await client
    .from("article_revisions")
    .select("id")
    .eq("article_id", articleId)
    .eq("is_deletion", true)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!revision) throw new Error("No quedó copia de esa nota.");
  const { error: restoreError } = await client.rpc("admin_restore_article", {
    p_revision_id: revision.id,
  });
  if (restoreError) throw new Error("No pudimos restaurar la nota.");
};

export type AccessFilters = {
  q: string;
  status: string;
  role: string;
  days: number | null;
  device: "" | "mobile" | "desktop";
};

export type AccessRow = {
  id: number;
  email: string | null;
  full_name: string | null;
  role: string | null;
  browser: string | null;
  operating_system: string | null;
  ip_address: string | null;
  accessed_at: string;
  status: string | null;
  user_agent: string | null;
};

const MOBILE = "user_agent.ilike.*Mobile*,user_agent.ilike.*Android*,user_agent.ilike.*iPhone*";

export const listAccess = async (page: number, filters: AccessFilters) => {
  let query = requireSupabaseClient()
    .from("admin_access_logs")
    .select(
      "id, email, full_name, role, browser, operating_system, ip_address, accessed_at, status, user_agent",
      { count: "exact" },
    )
    .order("accessed_at", { ascending: false })
    .range(...range(page));

  const term = escapeLike(filters.q.trim());
  if (term) {
    const pattern = `"%${term.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}%"`;
    query = query.or(`email.ilike.${pattern},full_name.ilike.${pattern}`);
  }
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.role) query = query.eq("role", filters.role);
  if (filters.days) query = query.gte("accessed_at", daysAgo(filters.days));
  if (filters.device === "mobile") query = query.or(MOBILE);
  if (filters.device === "desktop") {
    query = query
      .not("user_agent", "ilike", "*Mobile*")
      .not("user_agent", "ilike", "*Android*")
      .not("user_agent", "ilike", "*iPhone*");
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { rows: (data ?? []) as AccessRow[], total: count ?? 0 };
};

export type UsageRow = {
  user_id: string;
  uses: number;
  input_tokens: number;
  output_tokens: number;
};

export const listAiUsage = async (days: number) => {
  const { data, error } = await requireSupabaseClient()
    .from("ai_usage")
    .select("user_id, uses, input_tokens, output_tokens")
    .gte("day", daysAgo(days).slice(0, 10));
  if (error) throw error;
  return (data ?? []) as UsageRow[];
};

// claude-opus-5-5, in dollars per million tokens. Only an estimate for the owner's eyes.
const INPUT_PRICE = 4;
const OUTPUT_PRICE = 20;

export const summarizeAiUsage = (rows: UsageRow[]) => {
  const uses = rows.reduce((sum, row) => sum + row.uses, 0);
  const input = rows.reduce((sum, row) => sum + Number(row.input_tokens), 0);
  const output = rows.reduce((sum, row) => sum + Number(row.output_tokens), 0);
  return { uses, dollars: (input * INPUT_PRICE + output * OUTPUT_PRICE) / 1_000_000 };
};
