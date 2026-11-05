// Copies production into the new project, replacing what the new project holds.
// Production is only ever read, through Supabase's read-only endpoint. Rows stay in memory: nothing
// is written to disk and no personal data is printed, because this includes emails and password hashes.
// Usage: SOURCE_TOKEN=... TARGET_TOKEN=... node scripts/migrate/import-prod.mjs [--dry-run]
// After the switch, once: TARGET_TOKEN=... node scripts/migrate/import-prod.mjs --lock
import {
  LIVE_ONLY_TRIGGERS,
  assertNotCutOver,
  assertTargets,
  dollarQuote,
  planMigration,
  summarize,
} from "./transform.mjs";

const PRODUCTION = "nkkgwjvmdxggvyzehlzp";
const SOURCE = PRODUCTION;
const TARGET = "ooswoucakxnymtdblrzd";
const OWNER_EMAIL = "kentoterakawa@gmail.com";
const API = "https://api.supabase.com/v1/projects";

const { SOURCE_TOKEN, TARGET_TOKEN } = process.env;
const LOCK = process.argv.includes("--lock");
if (!TARGET_TOKEN || (!LOCK && !SOURCE_TOKEN))
  throw new Error("Definí SOURCE_TOKEN y TARGET_TOKEN.");
assertTargets({ source: SOURCE, target: TARGET, production: PRODUCTION });

// Database errors can quote the failing row or query, so only the summary is printed.
const safeMessage = (text) =>
  text
    .split(/LINE \d+:|DETAIL:|Failing row/)[0]
    .replace(/[^\s"'(),=]+@[^\s"'(),=]+/g, "<email>")
    .slice(0, 400);

const readSource = async (query) => {
  if (!/^\s*(select|with)\b/i.test(query))
    throw new Error("Solo se permiten lecturas en el origen.");
  const response = await fetch(`${API}/${SOURCE}/database/query/read-only`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SOURCE_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Lectura ${response.status}: ${safeMessage(body)}`);
  return JSON.parse(body);
};

const runTarget = async (query) => {
  const response = await fetch(`${API}/${TARGET}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TARGET_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Escritura ${response.status}: ${safeMessage(body)}`);
  return JSON.parse(body);
};

const PUBLIC_TABLES = [
  "profiles",
  "categories",
  "tags",
  "articles",
  "article_tags",
  "comments",
  "comment_likes",
  "newsletter_subscribers",
  "admin_access_logs",
  "comment_moderation_events",
  "comment_moderation_jobs",
  "comment_rate_log",
  "comment_rate_limits",
  "article_views",
  "site_settings",
  "homepage_sections",
];

const COLUMNS = {
  categories: ["id", "name", "slug", "color", "sort_order", "created_at"],
  tags: ["id", "name", "slug", "created_at"],
  articles: [
    "id",
    "title",
    "slug",
    "subtitle",
    "excerpt",
    "content",
    "cover_image_url",
    "category_id",
    "author_id",
    "status",
    "is_featured",
    "is_breaking",
    "reading_time_minutes",
    "seo_title",
    "seo_description",
    "views_count",
    "published_at",
    "scheduled_at",
    "created_at",
    "updated_at",
  ],
  article_tags: ["article_id", "tag_id", "created_at"],
  comments: [
    "id",
    "article_id",
    "user_id",
    "parent_id",
    "body",
    "like_count",
    "created_at",
    "updated_at",
  ],
  comment_likes: ["comment_id", "user_id", "created_at"],
  newsletter_subscribers: ["id", "email", "confirmed", "subscribed_at", "unsubscribed_at"],
  admin_access_logs: [
    "id",
    "user_id",
    "email",
    "full_name",
    "role",
    "user_agent",
    "browser",
    "operating_system",
    "language",
    "timezone",
    "referrer",
    "page_url",
    "session_id",
    "ip_address",
    "accessed_at",
    "status",
    "event_type",
  ],
};
const PROFILE_COLUMNS = [
  "id",
  "full_name",
  "avatar_url",
  "profile_color",
  "role",
  "is_blocked",
  "blocked_reason",
  "created_at",
  "updated_at",
];

const insertRows = (table, columns, rows) => {
  if (rows.length === 0) return "";
  const list = columns.map((column) => `"${column}"`).join(", ");
  return `insert into ${table} (${list}) select ${list} from jsonb_populate_recordset(null::${table}, ${dollarQuote(JSON.stringify(rows))}::jsonb);`;
};

// auth tables change between Supabase versions; copy what both projects share and can be written.
const writableAuthColumns = async (table) => {
  const query = `select column_name from information_schema.columns where table_schema = 'auth' and table_name = '${table}' and is_generated = 'NEVER'`;
  const target = new Set((await runTarget(query)).map((row) => row.column_name));
  const source = await readSource(query);
  return source.map((row) => row.column_name).filter((column) => target.has(column));
};

if (LOCK) {
  await runTarget("insert into private.cutover (done_at) values (now());");
  console.log("Copia bloqueada: ya no puede volver a correr.");
  process.exit(0);
}
assertNotCutOver(await runTarget("select done_at from private.cutover"));

console.log("Leyendo producción (solo lectura)...");
const source = {};
for (const table of PUBLIC_TABLES)
  source[table] = await readSource(`select * from public.${table}`);
const userColumns = await writableAuthColumns("users");
const identityColumns = await writableAuthColumns("identities");
const users = await readSource(
  `select ${userColumns.map((c) => `"${c}"`).join(", ")} from auth.users`,
);
const identities = await readSource(
  `select ${identityColumns.map((c) => `"${c}"`).join(", ")} from auth.identities`,
);

const plan = planMigration(source);
const expected = {
  users: users.length,
  identities: identities.length,
  profiles: new Set([...users.map((user) => user.id)]).size,
  categories: source.categories.length,
  tags: source.tags.length,
  articles: source.articles.length,
  article_tags: source.article_tags.length,
  comments: plan.comments.length,
  comment_likes: plan.comment_likes.length,
  newsletter_subscribers: source.newsletter_subscribers.length,
  admin_access_logs: source.admin_access_logs.length,
  archive: plan.archive.length,
};
console.log("Plan:", JSON.stringify({ ...expected, detail: summarize(plan).archived }));

if (process.argv.includes("--dry-run")) {
  console.log("Prueba en seco: no se escribió nada.");
  process.exit(0);
}

const statements = [
  "begin;",
  "truncate public.article_tags, public.comment_likes, public.comments, public.articles, public.categories, public.tags, public.newsletter_subscribers, public.admin_access_logs, public.profiles, public.activity_log, public.article_revisions, private.legacy_data restart identity cascade;",
  "delete from auth.users;",
  ...LIVE_ONLY_TRIGGERS.map(
    ([table, trigger]) => `alter table public.${table} disable trigger ${trigger};`,
  ),
  insertRows("auth.users", userColumns, users),
  insertRows("auth.identities", identityColumns, identities),
  // The signup trigger gave every user a profile, including any production lacked. Real data replaces it.
  `insert into public.profiles (${PROFILE_COLUMNS.join(", ")})
     select ${PROFILE_COLUMNS.join(", ")} from jsonb_populate_recordset(null::public.profiles, ${dollarQuote(JSON.stringify(source.profiles))}::jsonb)
     on conflict (id) do update set ${PROFILE_COLUMNS.filter((c) => c !== "id")
       .map((c) => `${c} = excluded.${c}`)
       .join(", ")};`,
  `update public.profiles set role = 'admin', is_protected = true, is_blocked = false, blocked_reason = null
     where id = (select id from auth.users where lower(email) = lower(${dollarQuote(OWNER_EMAIL)}));`,
  insertRows("public.categories", COLUMNS.categories, source.categories),
  insertRows("public.tags", COLUMNS.tags, source.tags),
  insertRows("public.articles", COLUMNS.articles, source.articles),
  insertRows("public.article_tags", COLUMNS.article_tags, source.article_tags),
  insertRows("public.comments", COLUMNS.comments, plan.comments),
  insertRows("public.comment_likes", COLUMNS.comment_likes, plan.comment_likes),
  insertRows(
    "public.newsletter_subscribers",
    COLUMNS.newsletter_subscribers,
    source.newsletter_subscribers,
  ),
  insertRows("public.admin_access_logs", COLUMNS.admin_access_logs, source.admin_access_logs),
  insertRows("private.legacy_data", ["source_table", "source_id", "reason", "row"], plan.archive),
  "insert into public.media_assets (url, source, uploaded_by) select distinct cover_image_url, 'url', null::uuid from public.articles where cover_image_url like 'https://%' on conflict (url) do nothing;",
  ...LIVE_ONLY_TRIGGERS.map(
    ([table, trigger]) => `alter table public.${table} enable trigger ${trigger};`,
  ),
  // New rows must continue after the imported ids.
  "select setval(pg_get_serial_sequence('public.comments', 'id'), greatest((select max(id) from public.comments), 1));",
  "select setval(pg_get_serial_sequence('public.admin_access_logs', 'id'), greatest((select max(id) from public.admin_access_logs), 1));",
  "commit;",
];

console.log("Escribiendo en el proyecto nuevo (todo o nada)...");
await runTarget(statements.filter(Boolean).join("\n"));

console.log("Verificando...");
const COUNTS = `select
  (select count(*) from auth.users) users, (select count(*) from auth.identities) identities,
  (select count(*) from public.profiles) profiles, (select count(*) from public.categories) categories,
  (select count(*) from public.tags) tags, (select count(*) from public.articles) articles,
  (select count(*) from public.article_tags) article_tags, (select count(*) from public.comments) comments,
  (select count(*) from public.comment_likes) comment_likes,
  (select count(*) from public.newsletter_subscribers) newsletter_subscribers,
  (select count(*) from public.admin_access_logs) admin_access_logs,
  (select count(*) from private.legacy_data) archive,
  (select coalesce(sum(like_count), 0) from public.comments) like_total,
  (select count(*) from public.profiles where is_protected) protected`;
const [counts] = await runTarget(COUNTS);

// Fingerprints prove equality without moving or printing the values.
const FINGERPRINTS = {
  passwords: `select md5(string_agg(id::text || coalesce(encrypted_password, ''), ',' order by id)) f from auth.users`,
  articles: `select md5(string_agg(id::text || title || slug || coalesce(content, '') || coalesce(cover_image_url, '') || status::text || views_count::text || coalesce(published_at::text, '') || created_at::text || updated_at::text, ',' order by id)) f from public.articles`,
  // Only profiles production has, and not the owner's, which is set on purpose.
  roles: `select md5(string_agg(id::text || role::text || is_blocked::text || updated_at::text, ',' order by id)) f from public.profiles where id in (${source.profiles.map((p) => `'${p.id}'`).join(",")}) and id <> (select id from auth.users where lower(email) = '${OWNER_EMAIL}')`,
  newsletter: `select md5(string_agg(email || confirmed::text, ',' order by id)) f from public.newsletter_subscribers`,
};

const failures = [];
for (const [key, value] of Object.entries(expected)) {
  if (Number(counts[key]) !== value) failures.push(`${key}: ${counts[key]} en lugar de ${value}`);
}
if (Number(counts.like_total) !== plan.comment_likes.length)
  failures.push("el contador de likes no coincide");
if (Number(counts.protected) !== 1) failures.push(`cuentas protegidas: ${counts.protected}`);
for (const [name, query] of Object.entries(FINGERPRINTS)) {
  const [[{ f: from }], [{ f: to }]] = [await readSource(query), await runTarget(query)];
  if (from !== to) failures.push(`diferencias en ${name}`);
  else console.log(`  ${name}: idénticos`);
}
const [{ leftovers }] = await runTarget(
  `select count(*) leftovers from public.articles where content like '%${PRODUCTION}%' or coalesce(cover_image_url, '') like '%${PRODUCTION}%'`,
);
if (Number(leftovers) !== 0) failures.push(`${leftovers} artículos apuntan a la base vieja`);

console.log("Resultado:", JSON.stringify(counts));
if (failures.length) {
  console.error("FALLÓ:\n- " + failures.join("\n- "));
  process.exit(1);
}
console.log("Migración completa y verificada.");
