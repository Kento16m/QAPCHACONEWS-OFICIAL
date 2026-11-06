// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  ARTICLE_NOT_FOUND,
  fetchArticleForMeta,
  handleArticleRequest,
  injectArticleMeta,
} from "./article-meta.mjs";

const SITE = "https://qapchaconews.com";
const HTML = `<!doctype html><html><head>
  <meta name="description" content="Genérica" />
  <meta property="og:title" content="Genérico" />
  <meta property="og:image" content="${SITE}/og-image.png" />
  <meta name="twitter:title" content="Genérico" />
  <title>QAP ChacoNews</title>
</head><body><div id="root"></div></body></html>`;

const article = {
  title: "Lluvias en Filadelfia",
  slug: "lluvias",
  seo_title: null,
  seo_description: null,
  excerpt: "Resumen de la nota",
  subtitle: null,
  cover_image_url: "https://x.supabase.co/storage/v1/object/public/article-covers/a.webp",
  published_at: "2026-11-01T12:00:00.000Z",
  updated_at: "2026-11-02T12:00:00.000Z",
  author: { full_name: "Ana Pérez" },
  category: { name: "Sociedad" },
};

const inject = (overrides = {}) => injectArticleMeta(HTML, { ...article, ...overrides }, SITE);

describe("injectArticleMeta", () => {
  it("gives crawlers the article's title, description, image and address", () => {
    const html = inject();
    expect(html).toContain("<title>Lluvias en Filadelfia — QAP ChacoNews</title>");
    expect(html).toContain('<meta name="description" content="Resumen de la nota"');
    expect(html).toContain('<meta property="og:title" content="Lluvias en Filadelfia"');
    expect(html).toContain('<meta property="og:type" content="article"');
    expect(html).toContain(`<meta property="og:image" content="${article.cover_image_url}"`);
    expect(html).toContain(`<meta property="og:url" content="${SITE}/noticia/lluvias"`);
    expect(html).toContain(`<link rel="canonical" href="${SITE}/noticia/lluvias"`);
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image"');
  });

  it("replaces the generic tags instead of adding a second set", () => {
    const html = inject();
    expect(html).not.toContain("Genérico");
    expect(html).not.toContain("Genérica");
    expect(html.match(/property="og:image"/g)).toHaveLength(1);
    expect(html.match(/<title>/g)).toHaveLength(1);
  });

  it("prefers the SEO fields", () => {
    const html = inject({ seo_title: "Título SEO", seo_description: "Descripción SEO" });
    expect(html).toContain('<meta property="og:title" content="Título SEO"');
    expect(html).toContain('<meta name="description" content="Descripción SEO"');
  });

  it("falls back to the site image without a cover", () => {
    expect(inject({ cover_image_url: null })).toContain(`content="${SITE}/og-image.png"`);
  });

  it("makes a relative cover absolute", () => {
    expect(inject({ cover_image_url: "/portada.webp" })).toContain(
      `<meta property="og:image" content="${SITE}/portada.webp"`,
    );
  });

  it("ignores a cover that is not a usable address", () => {
    expect(inject({ cover_image_url: "data:image/png;base64,AAAA" })).toContain(
      `content="${SITE}/og-image.png"`,
    );
  });

  it("escapes text so a title cannot break out of the tags", () => {
    const html = inject({ title: `"><script>alert(1)</script>`, excerpt: "A & B < C" });
    expect(html).not.toContain("<script>alert(1)");
    expect(html).toContain("&quot;&gt;&lt;script&gt;");
    expect(html).toContain("A &amp; B &lt; C");
  });

  it("adds structured data that cannot close its script tag", () => {
    const html = inject({ title: "</script><script>alert(1)</script>" });
    const data = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)?.[1] ?? "";
    expect(data).not.toContain("</script>");

    const parsed = JSON.parse(data);
    expect(parsed["@type"]).toBe("NewsArticle");
    expect(parsed.headline).toBe("</script><script>alert(1)</script>");
    expect(parsed.datePublished).toBe(article.published_at);
    expect(parsed.dateModified).toBe(article.updated_at);
    expect(parsed.author.name).toBe("Ana Pérez");
  });

  it("does not break on replacement patterns in the text", () => {
    expect(inject({ title: "Sube $& baja $1" })).toContain(
      "<title>Sube $&amp; baja $1 — QAP ChacoNews</title>",
    );
  });

  it("shortens a long description", () => {
    const html = inject({ excerpt: "palabra ".repeat(100) });
    const description = html.match(/name="description" content="([^"]*)"/)?.[1] ?? "";
    expect(description.length).toBeLessThanOrEqual(200);
  });

  it("gives crawlers without JavaScript the article's text", () => {
    const html = inject({
      content: "<p>Primer <strong>párrafo</strong>.</p><h2>Título</h2><p>Otro.</p>",
    });
    const noscript = /<noscript>([\s\S]*)<\/noscript>/.exec(html)?.[1] ?? "";

    expect(noscript).toContain("<h1>Lluvias en Filadelfia</h1>");
    expect(noscript).toContain("<p>Primer párrafo.</p>");
    expect(noscript).toContain("<p>Título</p>");
    expect(noscript).toContain("<p>Otro.</p>");
    expect(noscript).not.toContain("<strong>");
    expect(html.indexOf("<noscript>")).toBeGreaterThan(html.indexOf('<div id="root">'));
    expect(html.indexOf("</noscript>")).toBeLessThan(html.indexOf("</div>"));
  });

  it("does not let article text break out of the noscript block", () => {
    const html = inject({
      title: "</noscript><script>alert(1)</script>",
      content: "<p>a</noscript><script>alert(2)</script>b < c</p>",
    });
    expect(html.match(/<\/noscript>/g)).toHaveLength(1);
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("b &lt; c");
  });

  it("adds no noscript block for an article without text", () => {
    expect(inject({ content: null })).not.toContain("<noscript>");
  });

  it("removes markup and extra spaces from the description", () => {
    expect(inject({ excerpt: "<p>Hola\n\n  mundo</p>" })).toContain(
      'name="description" content="Hola mundo"',
    );
  });
});

describe("fetchArticleForMeta", () => {
  const config = { supabaseUrl: "https://x.supabase.co", anonKey: "anon" };

  it("asks only for a published article by its exact slug", async () => {
    const http = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify([article]), { status: 200 }));

    expect(await fetchArticleForMeta("a b&c=d", config, http)).toEqual(article);

    const [url, init] = http.mock.calls[0];
    const parsed = new URL(url);
    expect(parsed.searchParams.get("slug")).toBe("eq.a b&c=d");
    expect(parsed.searchParams.get("status")).toBe("eq.published");
    expect(init.headers.apikey).toBe("anon");
  });

  it("says so when the slug is confirmed not to exist", async () => {
    const http = vi.fn().mockResolvedValue(new Response("[]", { status: 200 }));
    expect(await fetchArticleForMeta("x", config, http)).toBe(ARTICLE_NOT_FOUND);
  });

  it.each([
    ["a server error", () => Promise.resolve(new Response("{}", { status: 500 }))],
    ["a network failure", () => Promise.reject(new Error("down"))],
    ["an invalid answer", () => Promise.resolve(new Response("<html>", { status: 200 }))],
  ])("returns nothing after %s, so the page still loads", async (_name, http) => {
    expect(await fetchArticleForMeta("x", config, http)).toBeNull();
  });

  it("returns nothing when not configured", async () => {
    const http = vi.fn();
    expect(await fetchArticleForMeta("x", { supabaseUrl: "", anonKey: "" }, http)).toBeNull();
    expect(http).not.toHaveBeenCalled();
  });
});

describe("handleArticleRequest", () => {
  const config = { site: SITE, supabaseUrl: "https://x.supabase.co", anonKey: "anon" };
  const request = (path) => new Request(`${SITE}${path}`);
  const page = () =>
    new Response(HTML, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "content-length": "10",
        etag: '"abc"',
        "x-kept": "yes",
      },
    });
  const found = () =>
    vi.fn().mockResolvedValue(new Response(JSON.stringify([article]), { status: 200 }));

  it("adds the tags to the page and keeps its headers", async () => {
    const response = await handleArticleRequest(
      request("/noticia/lluvias"),
      async () => page(),
      config,
      found(),
    );

    expect(await response.text()).toContain('content="Lluvias en Filadelfia"');
    expect(response.status).toBe(200);
    expect(response.headers.get("x-kept")).toBe("yes");
    // The body changed size; a stale length would cut the page off.
    expect(response.headers.get("content-length")).toBeNull();
  });

  it("lets the CDN reuse the page briefly, so most visitors skip the database query", async () => {
    const response = await handleArticleRequest(
      request("/noticia/lluvias"),
      async () => page(),
      config,
      found(),
    );

    expect(response.headers.get("netlify-cdn-cache-control")).toBe(
      "public, durable, s-maxage=60, stale-while-revalidate=600",
    );
    expect(response.headers.get("cache-control")).toBe("public, max-age=0, must-revalidate");
    // The body changed, so the original validator no longer describes it.
    expect(response.headers.get("etag")).toBeNull();
  });

  it("never caches a page without its tags", async () => {
    const http = vi.fn().mockRejectedValue(new Error("down"));
    const response = await handleArticleRequest(
      request("/noticia/x"),
      async () => page(),
      config,
      http,
    );
    expect(response.headers.get("netlify-cdn-cache-control")).toBeNull();
  });

  it("answers a real 404, without caching, when the article does not exist", async () => {
    const http = vi.fn().mockResolvedValue(new Response("[]", { status: 200 }));
    const response = await handleArticleRequest(
      request("/noticia/no-existe"),
      async () => page(),
      config,
      http,
    );

    expect(response.status).toBe(404);
    expect(await response.text()).toContain('<div id="root">');
    expect(response.headers.get("netlify-cdn-cache-control")).toBeNull();
    expect(response.headers.get("etag")).toBeNull();
  });

  // A 404 here would make Google drop real articles during a database outage.
  it("never answers 404 when Supabase fails", async () => {
    const http = vi.fn().mockRejectedValue(new Error("down"));
    const original = page();

    expect(
      await handleArticleRequest(request("/noticia/x"), async () => original, config, http),
    ).toBe(original);
  });

  it("does not touch files that are not pages", async () => {
    const file = new Response("{}", { headers: { "content-type": "application/json" } });
    const http = vi.fn();

    expect(await handleArticleRequest(request("/noticia/x"), async () => file, config, http)).toBe(
      file,
    );
    expect(http).not.toHaveBeenCalled();
  });

  it("survives a malformed address", async () => {
    const original = page();
    const http = vi.fn();

    expect(
      await handleArticleRequest(request("/noticia/%E0%A4%A"), async () => original, config, http),
    ).toBe(original);
    expect(http).not.toHaveBeenCalled();
  });

  it("looks up accented slugs decoded", async () => {
    const http = found();
    await handleArticleRequest(
      request("/noticia/producci%C3%B3n/"),
      async () => page(),
      config,
      http,
    );
    expect(new URL(http.mock.calls[0][0]).searchParams.get("slug")).toBe("eq.producción");
  });
});
