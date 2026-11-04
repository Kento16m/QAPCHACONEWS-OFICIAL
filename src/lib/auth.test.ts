import { beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({
  queries: 0,
  listener: undefined as undefined | ((event: string, session: unknown) => void),
}));

vi.mock("@/lib/supabase", () => {
  const client = {
    from: () => {
      fake.queries += 1;
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
      };
    },
    auth: {
      onAuthStateChange: (callback: (event: string, session: unknown) => void) => {
        fake.listener = callback;
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
    },
  };
  return { supabase: client, requireSupabaseClient: () => client };
});

import { onAuthStateChange } from "@/lib/auth";

beforeEach(() => {
  fake.queries = 0;
  fake.listener = undefined;
  vi.useFakeTimers();
});

describe("onAuthStateChange", () => {
  it("returns control to Supabase before doing any work", async () => {
    const callback = vi.fn();
    onAuthStateChange(callback);

    const returned = fake.listener?.("SIGNED_IN", { user: { id: "u1" } }) as unknown;

    // Supabase holds its auth lock during this call: awaiting a query here can hang the client.
    expect(returned).toBeUndefined();
    expect(callback).not.toHaveBeenCalled();
    expect(fake.queries).toBe(0);

    await vi.advanceTimersByTimeAsync(0);
    expect(callback).toHaveBeenCalledWith({ id: "u1" });
    vi.useRealTimers();
  });

  it("reports a signed-out session as null", async () => {
    const callback = vi.fn();
    onAuthStateChange(callback);

    fake.listener?.("SIGNED_OUT", null);
    await vi.advanceTimersByTimeAsync(0);

    expect(callback).toHaveBeenCalledWith(null);
    vi.useRealTimers();
  });
});
