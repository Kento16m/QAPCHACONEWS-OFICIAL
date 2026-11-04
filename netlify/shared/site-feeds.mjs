// Sitemap and RSS built from what is published right now.
const PAGE_SIZE = 1000;
const RSS_ITEMS = 30;
const FIXED_PAGES = [
  "/",
  "/quienes-somos",
  "/clima",
  "/cookies",
  "/politica-de-privacidad",
  "/terminos-y-condiciones",
  "/aviso-legal",
];

const escapeXml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const urlEntry = (location, lastModified) =>
  `  <url><loc>${escapeXml(location)}</loc>${lastModified ? `<lastmod>${escapeXml(lastModified)}</lastmod>` : ""}</url>`;

export const buildSitemap = ({ articles, categories, tags }, site) => {
  const inSection = (section, rows) =>
    rows.map((row) => urlEntry(`${site}/${section}/${encodeURIComponent(row.slug)}`));

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...FIXED_PAGES.map((path) => urlEntry(`${site}${path}`)),
    ...inSection("categoria", categories),
    ...inSection("etiqueta", tags),
    ...articles.map((article) =>
      urlEntry(
        `${site}/noticia/${encodeURIComponent(article.slug)}`,
        article.updated_at ?? article.published_at,
      ),
    ),
    "</urlset>",
    "",
  ].join("\n");
};

export const buildRss = (articles, site) =>
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "<channel>",
    "  <title>QAP ChacoNews</title>",
    `  <link>${site}/</link>`,
    "  <description>Noticias y actualidad del Chaco paraguayo.</description>",
    "  <language>es-PY</language>",
    `  <atom:link href="${site}/rss.xml" rel="self" type="application/rss+xml" />`,
    ...articles.slice(0, RSS_ITEMS).map((article) => {
      const link = `${site}/noticia/${encodeURIComponent(article.slug)}`;
      return [
        "  <item>",
        `    <title>${escapeXml(article.title)}</title>`,
        `    <link>${escapeXml(link)}</link>`,
        `    <guid isPermaLink="true">${escapeXml(link)}</guid>`,
        `    <pubDate>${new Date(article.published_at).toUTCString()}</pubDate>`,
        `    <description>${escapeXml(article.excerpt ?? "")}</description>`,
        "  </item>",
      ].join("\n");
    }),
    "</channel>",
    "</rss>",
    "",
  ].join("\n");

// Supabase caps each answer at 1000 rows, so a long archive needs several requests.
export const fetchAllRows = async (path, { supabaseUrl, anonKey }, http = fetch) => {
  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const response = await http(
      `${supabaseUrl}/rest/v1/${path}&limit=${PAGE_SIZE}&offset=${offset}`,
      {
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!response.ok) throw new Error(`Supabase respondió ${response.status}.`);

    const page = await response.json();
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
};

export const fetchPublishedArticles = (columns, config, http) =>
  fetchAllRows(
    `articles?select=${columns}&status=eq.published&order=published_at.desc`,
    config,
    http,
  );

export const feedConfig = () => ({
  supabaseUrl: process.env.VITE_SUPABASE_URL ?? "",
  anonKey: process.env.VITE_SUPABASE_ANON_KEY ?? "",
});

export const SITE_URL = "https://qapchaconews.com";

// An error instead of an empty feed: crawlers retry errors, but would drop every page from an empty list.
export const xmlResponse = async (contentType, build) => {
  try {
    return new Response(await build(), {
      headers: {
        "content-type": `${contentType}; charset=utf-8`,
        "cache-control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Feed error:", error);
    return new Response("Temporalmente no disponible.", {
      status: 503,
      headers: { "retry-after": "3600" },
    });
  }
};
