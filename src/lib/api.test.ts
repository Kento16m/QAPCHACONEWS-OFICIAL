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

import { buildSearchFilter, searchArticles } from "@/lib/api";

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
