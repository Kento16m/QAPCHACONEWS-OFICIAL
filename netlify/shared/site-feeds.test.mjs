// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { buildRss, buildSitemap, fetchAllRows } from "./site-feeds.mjs";

const SITE = "https://qapchaconews.com";
const articles = [
  {
    title: "Lluvias & tormentas <hoy>",
    slug: "lluvias",
    excerpt: "Resumen",
    published_at: "2026-11-01T12:00:00.000Z",
    updated_at: "2026-11-02T12:00:00.000Z",
  },
];
const categories = [{ slug: "producción" }, { slug: "politica" }];

describe("buildSitemap", () => {
  const xml = buildSitemap({ articles, categories, tags: [{ slug: "chaco" }] }, SITE);
  const locations = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);

  it("lists the home, fixed pages, categories, tags and articles", () => {
    expect(locations).toContain(`${SITE}/`);
    expect(locations).toContain(`${SITE}/quienes-somos`);
    expect(locations).toContain(`${SITE}/categoria/politica`);
    expect(locations).toContain(`${SITE}/etiqueta/chaco`);
    expect(locations).toContain(`${SITE}/noticia/lluvias`);
  });

  it("only uses the canonical domain", () => {
    expect(locations.every((location) => location.startsWith(`${SITE}/`))).toBe(true);
    expect(xml).not.toContain("www.qapchaconews");
  });

  it("encodes accented slugs", () => {
    expect(locations).toContain(`${SITE}/categoria/producci%C3%B3n`);
  });

  it("gives an article its last change", () => {
    expect(xml).toContain("<lastmod>2026-11-02T12:00:00.000Z</lastmod>");
  });

  it("leaves out private and utility pages", () => {
    for (const path of ["/admin", "/perfil", "/buscar", "/restablecer-contrasena"]) {
      expect(locations).not.toContain(`${SITE}${path}`);
    }
  });
});

describe("buildRss", () => {
  const xml = buildRss(articles, SITE);

  it("describes each article", () => {
    expect(xml).toContain(`<link>${SITE}/noticia/lluvias</link>`);
    expect(xml).toContain("<pubDate>Sun, 01 Nov 2026 12:00:00 GMT</pubDate>");
    expect(xml).toContain("<description>Resumen</description>");
  });

  it("escapes text", () => {
    expect(xml).toContain("<title>Lluvias &amp; tormentas &lt;hoy&gt;</title>");
    expect(xml).not.toContain("<hoy>");
  });

  it("is still valid with no articles", () => {
    expect(buildRss([], SITE)).toContain("</channel>");
  });
});

describe("fetchAllRows", () => {
  const config = { supabaseUrl: "https://x.supabase.co", anonKey: "anon" };
  const page = (count, start = 0) =>
    new Response(
      JSON.stringify(Array.from({ length: count }, (_, index) => ({ slug: `s${start + index}` }))),
      { status: 200 },
    );

  it("keeps reading while pages come back full", async () => {
    const http = vi.fn().mockResolvedValueOnce(page(1000)).mockResolvedValueOnce(page(5, 1000));

    const rows = await fetchAllRows("articles?select=slug", config, http);

    expect(rows).toHaveLength(1005);
    expect(http).toHaveBeenCalledTimes(2);
    expect(http.mock.calls[1][0]).toContain("offset=1000");
  });

  it("fails loudly so crawlers never receive an empty list", async () => {
    const http = vi.fn().mockResolvedValue(new Response("{}", { status: 500 }));
    await expect(fetchAllRows("articles?select=slug", config, http)).rejects.toThrow();
  });
});
