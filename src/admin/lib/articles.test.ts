import { beforeEach, describe, expect, it, vi } from "vitest";

// Records the query the panel builds, and answers with a fixed page.
const calls: [string, ...unknown[]][] = [];
let answer: { data: unknown[] | null; error: unknown; count: number | null };

const query = new Proxy(
  {},
  {
    get(_target, name: string) {
      if (name === "then") {
        return (resolve: (value: unknown) => void) => resolve(answer);
      }
      return (...args: unknown[]) => {
        calls.push([name, ...args]);
        return query;
      };
    },
  },
);

vi.mock("@/lib/supabase", () => ({
  requireSupabaseClient: () => ({ from: (table: string) => (calls.push(["from", table]), query) }),
}));

const { PAGE_SIZE, deleteArticles, listArticles, setArticlesStatus } = await import("./articles");

const called = (name: string) => calls.filter(([call]) => call === name).map(([, ...args]) => args);

beforeEach(() => {
  calls.length = 0;
  answer = { data: [], error: null, count: 0 };
});

describe("listArticles", () => {
  it("orders by publication date, with what is not published yet on top", async () => {
    await listArticles({ page: 1 });
    expect(calls.filter(([name]) => name === "order").map(([, ...args]) => args)).toEqual([
      ["published_at", { ascending: false, nullsFirst: true }],
      ["updated_at", { ascending: false }],
    ]);
  });

  it("asks the database for one page and the total", async () => {
    answer = { data: [], error: null, count: 60 };
    const result = await listArticles({ page: 3 });
    expect(called("range")).toEqual([[2 * PAGE_SIZE, 3 * PAGE_SIZE - 1]]);
    expect(called("select")[0]?.[1]).toEqual({ count: "exact" });
    expect(result.total).toBe(60);
    expect(called("eq")).toEqual([]);
    expect(called("or")).toEqual([]);
  });

  it("applies only the filters it receives", async () => {
    await listArticles({ page: 1, status: "draft", categoryId: "c1", authorId: "a1" });
    expect(called("eq")).toEqual([
      ["status", "draft"],
      ["category_id", "c1"],
      ["author_id", "a1"],
    ]);
  });

  it("searches title, subtitle and summary, safely", async () => {
    await listArticles({ page: 1, q: "dólar, 100%" });
    const [[filter]] = called("or") as [[string]];
    expect(filter).toContain("title.ilike.");
    expect(filter).toContain("excerpt.ilike.");
    expect(filter).toContain("100\\\\%");
  });

  it("ignores a search of only spaces", async () => {
    await listArticles({ page: 1, q: "   " });
    expect(called("or")).toEqual([]);
  });

  it("passes database errors on", async () => {
    answer = { data: null, error: new Error("sin permiso"), count: null };
    await expect(listArticles({ page: 1 })).rejects.toThrow("sin permiso");
  });
});

describe("bulk actions", () => {
  it("changes the status of the chosen notes", async () => {
    answer = { data: [{ id: "1" }, { id: "2" }], error: null, count: null };
    await setArticlesStatus(["1", "2"], "archived");
    expect(called("update")).toEqual([[{ status: "archived" }]]);
    expect(called("in")).toEqual([["id", ["1", "2"]]]);
  });

  it("reports when the database changed fewer notes than requested", async () => {
    answer = { data: [{ id: "1" }], error: null, count: null };
    await expect(setArticlesStatus(["1", "2"], "published")).rejects.toThrow(/1 de 2/);
  });

  it("reports when a delete removed nothing, which is what a refused delete looks like", async () => {
    answer = { data: [], error: null, count: null };
    await expect(deleteArticles(["1"])).rejects.toThrow(/0 de 1/);
  });
});
