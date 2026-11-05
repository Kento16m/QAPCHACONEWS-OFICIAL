import { beforeEach, describe, expect, it, vi } from "vitest";

type Call = { table: string; method: string; args: unknown[] };

const fake = vi.hoisted(() => ({
  calls: [] as Call[],
  // Rows returned per table, consumed one query at a time; defaults to no rows.
  rows: {} as Record<string, unknown[][]>,
}));

vi.mock("@/lib/supabase", () => {
  const from = (table: string) => {
    const result = () => {
      const data = fake.rows[table]?.shift() ?? [];
      const single = fake.calls.some((c) => c.table === table && c.method === "maybeSingle");
      return { data: single ? (data[0] ?? null) : data, error: null, count: data.length };
    };
    const chain: unknown = new Proxy(
      {},
      {
        get(_target, method: string) {
          if (method === "then") {
            return (resolve: (value: unknown) => void) => resolve(result());
          }
          return (...args: unknown[]) => {
            fake.calls.push({ table, method, args });
            return chain;
          };
        },
      },
    );
    return chain;
  };
  return { requireSupabaseClient: () => ({ from }), supabase: { from } };
});

import {
  buildSearchFilter,
  getArticleBySlug,
  getBreakingArticles,
  getFeaturedArticle,
  getLatestArticles,
  getMostReadArticles,
  getRelatedArticles,
  searchArticles,
} from "@/lib/api";

const calledWith = (method: string) => fake.calls.filter((c) => c.method === method);

beforeEach(() => {
  fake.calls.length = 0;
  fake.rows = {};
});

describe("buildSearchFilter", () => {
  it("matches text fields or the category in a single OR", () => {
    expect(buildSearchFilter("cultura", ["id-1", "id-2"])).toBe(
      'title.ilike."%cultura%",subtitle.ilike."%cultura%",excerpt.ilike."%cultura%",category_id.in.(id-1,id-2)',
    );
  });

  it("omits the category clause when no category matches", () => {
    expect(buildSearchFilter("chaco", [])).toBe(
      'title.ilike."%chaco%",subtitle.ilike."%chaco%",excerpt.ilike."%chaco%"',
    );
  });

  it("quotes reserved characters so they stay literal text", () => {
    const filter = buildSearchFilter('Chaco (Paraguay), 100% "ya"', []);
    expect(filter.split('",')[0]).toBe('title.ilike."%Chaco (Paraguay), 100\\\\% \\"ya\\"%');
  });

  it("escapes backslashes and underscores", () => {
    expect(buildSearchFilter("a\\b_c", []).split('",')[0]).toBe('title.ilike."%a\\\\\\\\b\\\\_c%');
  });
});

describe("getBreakingArticles", () => {
  it("leaves out breaking news that already expired", async () => {
    await getBreakingArticles();
    const [{ args }] = calledWith("or") as unknown as [{ args: string[] }];
    expect(args[0]).toContain("breaking_until.is.null");
    expect(args[0]).toContain("breaking_until.gt.");
  });
});

describe("getFeaturedArticle", () => {
  it("returns the featured article when there is one", async () => {
    fake.rows = { articles: [[{ id: "f1", title: "Destacada" }]] };
    expect((await getFeaturedArticle())?.title).toBe("Destacada");
  });

  it("falls back to the latest article when none is featured", async () => {
    fake.rows = { articles: [[], [{ id: "l1", title: "Última" }]] };
    expect((await getFeaturedArticle())?.title).toBe("Última");
  });

  it("returns null when nothing is published", async () => {
    expect(await getFeaturedArticle()).toBeNull();
  });
});

describe("list queries", () => {
  const selectedColumns = () => String(calledWith("select").at(-1)?.args[0]);

  it.each([
    ["latest", () => getLatestArticles()],
    ["most read", () => getMostReadArticles()],
    ["breaking", () => getBreakingArticles()],
    ["related", () => getRelatedArticles("a1", "c1")],
    ["featured", () => getFeaturedArticle()],
  ])("%s does not download the article body", async (_name, query) => {
    await query();
    expect(selectedColumns()).not.toMatch(/\bcontent\b/);
  });

  it("the article page does download the body", async () => {
    await getArticleBySlug("nota");
    expect(selectedColumns()).toMatch(/\bcontent\b/);
  });

  // A visitor's clock can be wrong, which would hide fresh articles. The database policy uses its own.
  it.each([
    ["latest", () => getLatestArticles()],
    ["most read", () => getMostReadArticles()],
    ["breaking", () => getBreakingArticles()],
    ["related", () => getRelatedArticles("a1", "c1")],
    ["featured", () => getFeaturedArticle()],
    ["article page", () => getArticleBySlug("nota")],
    ["search", () => searchArticles("chaco")],
  ])("%s does not filter dates with the browser's clock", async (_name, query) => {
    await query();
    expect(calledWith("lte")).toHaveLength(0);
  });

  it("limits breaking news to 10", async () => {
    await getBreakingArticles();
    expect(calledWith("limit")[0]?.args[0]).toBe(10);
  });
});

describe("searchArticles", () => {
  it("sends one OR filter and no separate category restriction", async () => {
    fake.rows = { categories: [[{ id: "cat-1" }]] };

    await searchArticles("cultura");

    expect(calledWith("in")).toHaveLength(0);
    expect(calledWith("or")[0]?.args[0]).toContain("category_id.in.(cat-1)");
  });

  it("does not filter when the term is only spaces", async () => {
    await searchArticles("   ");

    expect(calledWith("or")).toHaveLength(0);
    expect(calledWith("ilike")).toHaveLength(0);
  });
});
