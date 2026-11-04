// Social networks and many crawlers do not run JavaScript, so article tags must be in the HTML itself.
const SITE_NAME = "QAP ChacoNews";
const DEFAULT_DESCRIPTION = "Leé la nota completa en QAP ChacoNews.";
const MAX_DESCRIPTION = 200;
const TIMEOUT_MS = 1500;

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const toDescription = (article) => {
  const text = (
    article.seo_description ??
    article.excerpt ??
    article.subtitle ??
    DEFAULT_DESCRIPTION
  )
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length <= MAX_DESCRIPTION ? text : `${text.slice(0, MAX_DESCRIPTION - 1).trimEnd()}…`;
};

const toImage = (cover, site) => {
  if (/^https?:\/\//i.test(cover ?? "")) return cover;
  if (cover?.startsWith("/")) return `${site}${cover}`;
  return `${site}/og-image.png`;
};

export const injectArticleMeta = (html, article, site) => {
  const title = article.seo_title ?? article.title;
  const description = toDescription(article);
  const url = `${site}/noticia/${encodeURIComponent(article.slug)}`;
  const image = toImage(article.cover_image_url, site);

  const structuredData = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: title,
    description,
    image: [image],
    url,
    mainEntityOfPage: url,
    datePublished: article.published_at,
    dateModified: article.updated_at ?? article.published_at,
    ...(article.category?.name ? { articleSection: article.category.name } : {}),
    author: { "@type": "Person", name: article.author?.full_name ?? "Redacción" },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: { "@type": "ImageObject", url: `${site}/favicon.png` },
    },
    // A title containing "</script>" must not be able to close this tag.
  }).replace(/</g, "\\u003c");

  const tags = [
    ["name", "description", description],
    ["property", "og:type", "article"],
    ["property", "og:site_name", SITE_NAME],
    ["property", "og:title", title],
    ["property", "og:description", description],
    ["property", "og:image", image],
    ["property", "og:url", url],
    ["property", "article:published_time", article.published_at],
    ["name", "twitter:card", "summary_large_image"],
    ["name", "twitter:title", title],
    ["name", "twitter:description", description],
    ["name", "twitter:image", image],
  ]
    .filter(([, , content]) => content)
    .map(
      ([attribute, name, content]) =>
        `<meta ${attribute}="${name}" content="${escapeHtml(content)}" />`,
    );

  const head = [
    `<title>${escapeHtml(title)} — ${SITE_NAME}</title>`,
    `<link rel="canonical" href="${escapeHtml(url)}" />`,
    ...tags,
    `<script type="application/ld+json">${structuredData}</script>`,
  ].join("\n    ");

  return (
    html
      .replace(/<title>[\s\S]*?<\/title>\s*/i, "")
      .replace(/<link\s+rel="canonical"[^>]*>\s*/gi, "")
      .replace(
        /<meta\s+(?:property="og:[^"]*"|name="twitter:[^"]*"|name="description")[^>]*>\s*/gi,
        "",
      )
      // A function, so "$&" in a title stays literal text.
      .replace("</head>", () => `${head}\n  </head>`)
  );
};

export const fetchArticleForMeta = async (slug, { supabaseUrl, anonKey }, http = fetch) => {
  if (!supabaseUrl || !anonKey) return null;

  const query = new URLSearchParams({
    select:
      "title,slug,seo_title,seo_description,excerpt,subtitle,cover_image_url,published_at,updated_at,category:categories(name),author:public_profiles(full_name)",
    slug: `eq.${slug}`,
    status: "eq.published",
    limit: "1",
  });

  try {
    const response = await http(`${supabaseUrl}/rest/v1/articles?${query}`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const rows = await response.json();
    return rows[0] ?? null;
  } catch {
    // The tags are an extra: without them the visitor still gets the page.
    return null;
  }
};

export const handleArticleRequest = async (request, next, config, http = fetch) => {
  const response = await next();
  if (!response.headers.get("content-type")?.includes("text/html")) return response;

  let slug;
  try {
    slug = decodeURIComponent(
      new URL(request.url).pathname.replace(/^\/noticia\//, "").replace(/\/$/, ""),
    );
  } catch {
    return response;
  }
  if (!slug) return response;

  const article = await fetchArticleForMeta(slug, config, http);
  if (!article) return response;

  const headers = new Headers(response.headers);
  headers.delete("content-length");
  return new Response(injectArticleMeta(await response.text(), article, config.site), {
    status: response.status,
    headers,
  });
};
