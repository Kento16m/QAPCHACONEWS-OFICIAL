import { beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({
  result: { data: [] as unknown, error: null as unknown },
  calls: [] as Array<{ method: string; args: unknown[] }>,
}));

vi.mock("@/lib/supabase", () => {
  const chain: unknown = new Proxy(
    {},
    {
      get(_target, method: string) {
        if (method === "then") return (resolve: (value: unknown) => void) => resolve(fake.result);
        if (method === "maybeSingle") return async () => ({ data: { role: "admin" }, error: null });
        return (...args: unknown[]) => {
          fake.calls.push({ method, args });
          return chain;
        };
      },
    },
  );
  const client = {
    from: () => chain,
    auth: { getUser: async () => ({ data: { user: { id: "u1" } }, error: null }) },
  };
  return { requireSupabaseClient: () => client };
});

import { deleteArticle, deleteCategory, deleteCommentForAdmin, deleteTag, getAdminAccessLogs } from "@/lib/admin";

beforeEach(() => {
  fake.result = { data: [], error: null };
  fake.calls.length = 0;
});

describe("getAdminAccessLogs", () => {
  it("shows a permission error instead of an empty list", async () => {
    fake.result = { data: null, error: { message: "permission denied for table admin_access_logs" } };
    await expect(getAdminAccessLogs()).rejects.toMatchObject({ message: expect.stringContaining("permission denied") });
  });

  it("limits how many entries it downloads", async () => {
    await getAdminAccessLogs();
    expect(fake.calls.find((call) => call.method === "limit")?.args[0]).toBe(500);
  });
});

describe("deleting", () => {
  it.each([
    ["article", () => deleteArticle("a1")],
    ["category", () => deleteCategory("c1")],
    ["tag", () => deleteTag("t1")],
    ["comment", () => deleteCommentForAdmin(1)],
  ])("reports it when the database removes no %s", async (_name, remove) => {
    fake.result = { data: [], error: null };
    await expect(remove()).rejects.toThrow("No se pudo eliminar");
  });

  it.each([
    ["article", () => deleteArticle("a1")],
    ["category", () => deleteCategory("c1")],
    ["tag", () => deleteTag("t1")],
    ["comment", () => deleteCommentForAdmin(1)],
  ])("succeeds when the %s was removed", async (_name, remove) => {
    fake.result = { data: [{ id: "x" }], error: null };
    await expect(remove()).resolves.toBeUndefined();
  });
});
