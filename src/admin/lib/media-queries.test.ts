import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: [string, ...unknown[]][] = [];
const query = new Proxy(
  {},
  {
    get(_target, name: string) {
      if (name === "then") {
        return (resolve: (value: unknown) => void) => resolve({ data: [], error: null, count: 0 });
      }
      return (...args: unknown[]) => {
        calls.push([name, ...args]);
        return query;
      };
    },
  },
);

vi.mock("@/lib/supabase", () => ({ requireSupabaseClient: () => ({ from: () => query }) }));

const { imageUsage, listMedia } = await import("./media");
const called = (name: string) => calls.filter(([call]) => call === name).map(([, ...args]) => args);

beforeEach(() => {
  calls.length = 0;
});

describe("imageUsage", () => {
  it("cannot be broken by a quote in the address", async () => {
    await imageUsage('https://x.com/a"b.jpg');
    const [[filter]] = called("or") as unknown as [[string]];
    expect(filter).toContain('cover_image_url.eq."https://x.com/a\\"b.jpg"');
  });
});

describe("listMedia", () => {
  it("keeps pages stable when many rows share a date", async () => {
    await listMedia(1, "");
    expect(called("order").map(([column]) => column)).toEqual(["created_at", "id"]);
  });

  it("can leave videos out, for a cover", async () => {
    await listMedia(1, "", { imagesOnly: true });
    expect(called("or")).toEqual([["mime_type.is.null,mime_type.not.like.video/*"]]);
  });

  it("lists everything otherwise", async () => {
    await listMedia(1, "");
    expect(called("or")).toEqual([]);
  });
});
