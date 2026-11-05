import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyForm } from "@/lib/article-form";

const calls: [string, ...unknown[]][] = [];
let answer: { data: unknown; error: unknown };

const query = new Proxy(
  {},
  {
    get(_target, name: string) {
      if (name === "then") return (resolve: (value: unknown) => void) => resolve(answer);
      return (...args: unknown[]) => {
        calls.push([name, ...args]);
        return query;
      };
    },
  },
);

vi.mock("@/lib/supabase", () => ({ requireSupabaseClient: () => ({ from: () => query }) }));

const { ArticleConflictError, explainFailedSave, prePublishIssues, saveArticle, shareCard } =
  await import("./save-article");

const payload = { title: "T" } as never;
const row = { id: "a1", title: "T", updated_at: "2026-11-05T10:00:00+00:00" };

const called = (name: string) => calls.filter(([call]) => call === name).map(([, ...args]) => args);

beforeEach(() => {
  calls.length = 0;
  answer = { data: row, error: null };
});

describe("saveArticle", () => {
  it("creates a new note", async () => {
    const saved = await saveArticle(null, payload, null);
    expect(called("insert")).toHaveLength(1);
    expect(saved.id).toBe("a1");
  });

  it("only updates the version it opened", async () => {
    await saveArticle("a1", payload, "2026-11-05T09:00:00+00:00");
    expect(called("eq")).toEqual([
      ["id", "a1"],
      ["updated_at", "2026-11-05T09:00:00+00:00"],
    ]);
  });

  it("reports a conflict when someone else saved first", async () => {
    answer = { data: null, error: null };
    await expect(saveArticle("a1", payload, "2026-11-05T09:00:00+00:00")).rejects.toBeInstanceOf(
      ArticleConflictError,
    );
  });

  it("explains a repeated address", async () => {
    answer = { data: null, error: { code: "23505", message: "duplicate key" } };
    await expect(saveArticle(null, payload, null)).rejects.toThrow(/dirección/);
  });

  it("passes other database errors on", async () => {
    answer = { data: null, error: new Error("sin conexión") };
    await expect(saveArticle(null, payload, null)).rejects.toThrow("sin conexión");
  });
});

describe("prePublishIssues", () => {
  const ready = {
    ...emptyForm(),
    title: "T",
    content: "<p>texto</p>",
    cover_image_url: "https://x.com/a.webp",
    category_id: "c1",
    excerpt: "Resumen",
    seo_title: "SEO",
    seo_description: "Descripción",
  };

  it("has nothing to say about a complete note", () => {
    expect(prePublishIssues(ready)).toEqual([]);
  });

  it.each([
    ["cover", { cover_image_url: "" }],
    ["category", { category_id: null }],
    ["excerpt", { excerpt: "  " }],
    ["seo", { seo_title: "", seo_description: "" }],
    ["alt", { content: `<p>a</p><img src="https://x.com/a.webp">` }],
    ["alt", { content: `<img src="https://x.com/a.webp" alt="">` }],
  ])("warns about %s", (id, change) => {
    expect(prePublishIssues({ ...ready, ...change }).map((issue) => issue.id)).toEqual([id]);
  });

  it("accepts an image that has a description", () => {
    expect(prePublishIssues({ ...ready, content: `<img src="x" alt="Foto">` })).toEqual([]);
  });
});

describe("shareCard", () => {
  const SITE = "https://qapchaconews.com";
  const form = { ...emptyForm(), title: "Título", excerpt: "Resumen" };

  it("uses the SEO text first, as the public page does", () => {
    const card = shareCard({ ...form, seo_title: "SEO", seo_description: "Desc" }, SITE);
    expect(card.title).toBe("SEO");
    expect(card.description).toBe("Desc");
  });

  it("falls back to the title and summary", () => {
    const card = shareCard(form, SITE);
    expect(card.title).toBe("Título");
    expect(card.description).toBe("Resumen");
  });

  it("uses the cover, or the site's image when there is none", () => {
    expect(shareCard({ ...form, cover_image_url: "https://x.com/a.webp" }, SITE).image).toBe(
      "https://x.com/a.webp",
    );
    expect(shareCard(form, SITE).image).toBe(`${SITE}/og-image.png`);
  });
});

describe("explainFailedSave", () => {
  it("is a conflict when the note has a newer version", () => {
    expect(explainFailedSave({ updated_at: "v2" }, "v1")).toBe("conflict");
  });

  it("is a lack of permission when nothing changed yet the save was refused", () => {
    expect(explainFailedSave({ updated_at: "v1" }, "v1")).toBe("forbidden");
  });

  it("knows when the note was deleted", () => {
    expect(explainFailedSave(null, "v1")).toBe("deleted");
  });

  it("admits it does not know when it could not check", () => {
    expect(explainFailedSave(undefined, "v1")).toBe("unknown");
  });
});
