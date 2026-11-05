import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  listener: null as null | ((event: string) => void),
}));

vi.mock("@/lib/supabase", () => ({
  requireSupabaseClient: () => ({
    auth: {
      getSession: auth.getSession,
      signOut: vi.fn(),
      onAuthStateChange: (callback: (event: string) => void) => {
        auth.listener = callback;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
      mfa: {
        getAuthenticatorAssuranceLevel: async () => ({
          data: { currentLevel: "aal1" },
          error: null,
        }),
        listFactors: async () => ({ data: { totp: [] }, error: null }),
      },
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { role: "editor", is_blocked: false, full_name: "E", avatar_url: null },
            error: null,
          }),
        }),
      }),
    }),
  }),
}));

const { SessionProvider } = await import("./SessionProvider");
const { useSession } = await import("./session");

const Show = () => {
  const { status, access } = useSession();
  return <p>{`${status}:${access}`}</p>;
};

const flush = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });

describe("SessionProvider", () => {
  beforeEach(() => {
    auth.getSession.mockReset();
    auth.getSession.mockResolvedValue({
      data: { session: { user: { id: "u1" } } },
      error: null,
    });
  });

  it("reports an error when the first read fails", async () => {
    auth.getSession.mockRejectedValue(new Error("sin red"));
    render(
      <SessionProvider>
        <Show />
      </SessionProvider>,
    );
    await flush();
    expect(screen.getByText(/^error:/)).toBeInTheDocument();
  });

  it("keeps the panel open when a later check fails, so nobody loses the screen they write in", async () => {
    render(
      <SessionProvider>
        <Show />
      </SessionProvider>,
    );
    await flush();
    expect(screen.getByText("ready:ok")).toBeInTheDocument();

    auth.getSession.mockRejectedValue(new Error("sin red"));
    auth.listener?.("SIGNED_IN");
    await flush();
    expect(screen.getByText("ready:ok")).toBeInTheDocument();
  });
});
