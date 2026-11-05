import { describe, expect, it } from "vitest";
import type { AdminArticle } from "@/lib/admin";
import {
  buildArticlePayload,
  emptyForm,
  formFromArticle,
  fromDateTimeLocal,
  isNewlyPublished,
  toDateTimeLocal,
} from "@/lib/article-form";
import { createSlug } from "@/lib/slug";

const NOW = new Date("2026-11-04T15:00:00.000Z");
const OLD_DATE = "2026-10-01T12:00:00.000Z";

const article = (overrides: Partial<AdminArticle> = {}): AdminArticle => ({
  id: "a1",
  title: "Nota",
  slug: "nota",
  status: "draft",
  excerpt: null,
  content: "<p>x</p>",
  cover_image_url: null,
  published_at: null,
  scheduled_at: null,
  is_featured: false,
  is_breaking: false,
  breaking_until: null,
  views_count: 0,
  category_id: null,
  author_id: "u1",
  seo_title: null,
  seo_description: null,
  updated_at: "2026-10-01T12:00:00.000Z",
  category: null,
  author: null,
  ...overrides,
});

const form = (overrides = {}) => ({ ...emptyForm(), title: "Nota", ...overrides });

describe("createSlug", () => {
  it("removes accents, symbols and repeated spaces", () => {
    expect(createSlug("  ¿Qué pasó en  Filadelfia? ")).toBe("que-paso-en-filadelfia");
  });

  it("keeps existing hyphens without doubling them", () => {
    expect(createSlug("Pre - temporada")).toBe("pre-temporada");
  });
});

describe("dates in the editor", () => {
  it("shows a stored instant as Asuncion local time", () => {
    expect(toDateTimeLocal("2026-11-04T15:00:00.000Z")).toBe("2026-11-04T12:00");
  });

  it("stores local time as the matching instant", () => {
    expect(fromDateTimeLocal("2026-11-04T12:00")).toBe("2026-11-04T15:00:00.000Z");
  });

  it("does not move the time across repeated saves", () => {
    const stored = "2026-11-04T15:00:00.000Z";
    const once = fromDateTimeLocal(toDateTimeLocal(stored));
    expect(once).toBe(stored);
    expect(fromDateTimeLocal(toDateTimeLocal(once))).toBe(stored);
  });

  it("treats empty values as no date", () => {
    expect(toDateTimeLocal(null)).toBe("");
    expect(fromDateTimeLocal("")).toBeNull();
  });
});

describe("formFromArticle", () => {
  it("loads SEO fields and tags", () => {
    const loaded = formFromArticle(
      article({ seo_title: "Título SEO", seo_description: "Descripción" }),
      ["t1"],
    );
    expect(loaded.seo_title).toBe("Título SEO");
    expect(loaded.seo_description).toBe("Descripción");
    expect(loaded.tag_ids).toEqual(["t1"]);
  });
});

describe("buildArticlePayload", () => {
  it("keeps SEO fields through an edit", () => {
    const existing = article({ seo_title: "Título SEO", seo_description: "Descripción" });
    const payload = buildArticlePayload(formFromArticle(existing, []), existing, NOW);
    expect(payload.seo_title).toBe("Título SEO");
    expect(payload.seo_description).toBe("Descripción");
  });

  it("keeps the publication date when editing a published article", () => {
    const existing = article({ status: "published", published_at: OLD_DATE });
    const payload = buildArticlePayload(formFromArticle(existing, []), existing, NOW);
    expect(payload.published_at).toBe(OLD_DATE);
  });

  it("uses now when publishing for the first time", () => {
    const payload = buildArticlePayload(form({ status: "published" }), article(), NOW);
    expect(payload.published_at).toBe(NOW.toISOString());
  });

  it("uses now for a brand new published article", () => {
    expect(buildArticlePayload(form({ status: "published" }), null, NOW).published_at).toBe(
      NOW.toISOString(),
    );
  });

  it("requires a date to schedule", () => {
    expect(() => buildArticlePayload(form({ status: "scheduled" }), null, NOW)).toThrow(
      "Elegí la fecha de publicación.",
    );
  });

  it("stores the chosen schedule as an instant", () => {
    const payload = buildArticlePayload(
      form({ status: "scheduled", scheduled_at: "2026-11-05T09:30" }),
      null,
      NOW,
    );
    expect(payload.scheduled_at).toBe("2026-11-05T12:30:00.000Z");
  });

  it("clears the schedule for other statuses", () => {
    expect(
      buildArticlePayload(form({ status: "draft", scheduled_at: "2026-11-05T09:30" }), null, NOW)
        .scheduled_at,
    ).toBeNull();
  });

  it("requires a title", () => {
    expect(() => buildArticlePayload(form({ title: "   " }), null, NOW)).toThrow(
      "El título es obligatorio.",
    );
  });

  it("derives the slug from the title when empty", () => {
    expect(buildArticlePayload(form({ title: "Chaco Hoy" }), null, NOW).slug).toBe("chaco-hoy");
  });

  it("falls back to a unique slug when the title has no usable characters", () => {
    expect(buildArticlePayload(form({ title: "¿¿??" }), null, NOW).slug).toBe(
      `articulo-${NOW.getTime()}`,
    );
  });
});

describe("isNewlyPublished", () => {
  it("is true only when entering the published state", () => {
    expect(isNewlyPublished("draft", "published")).toBe(true);
    expect(isNewlyPublished(undefined, "published")).toBe(true);
    expect(isNewlyPublished("published", "published")).toBe(false);
    expect(isNewlyPublished("draft", "draft")).toBe(false);
  });
});
