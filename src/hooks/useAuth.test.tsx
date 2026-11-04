import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({
  profile: null as Record<string, unknown> | null,
  profileQueries: 0,
  session: null as { user: { id: string; email: string } } | null,
  signUpResult: { user: null as unknown, session: null as unknown },
  signOutCalls: 0,
  listener: undefined as undefined | ((event: string, session: unknown) => void),
}));

vi.mock("@/lib/supabase", () => {
  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            fake.profileQueries += 1;
            return { data: fake.profile, error: null };
          },
        }),
      }),
    }),
    auth: {
      onAuthStateChange: (callback: (event: string, session: unknown) => void) => {
        fake.listener = callback;
        queueMicrotask(() => callback("INITIAL_SESSION", fake.session));
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
      signInWithPassword: async () => {
        const session = { user: { id: "u1", email: "ana@test.invalid" } };
        // Supabase notifies listeners while the sign-in call is still resolving.
        fake.listener?.("SIGNED_IN", session);
        return { data: { user: session.user, session }, error: null };
      },
      signUp: async () => ({ data: fake.signUpResult, error: null }),
      signOut: async () => {
        fake.signOutCalls += 1;
        return { error: null };
      },
    },
  };
  return { supabase: client, requireSupabaseClient: () => client };
});

import { AuthProvider, useAuth } from "@/hooks/useAuth";

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;
const renderAuth = async () => {
  const hook = renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
};

beforeEach(() => {
  fake.profile = { id: "u1", full_name: "Ana", avatar_url: null, role: "reader", is_blocked: false, blocked_reason: null };
  fake.profileQueries = 0;
  fake.session = null;
  fake.signUpResult = { user: null, session: null };
  fake.signOutCalls = 0;
  fake.listener = undefined;
});

describe("AuthProvider", () => {
  it("loads the profile once for one sign-in", async () => {
    const { result } = await renderAuth();

    await act(async () => {
      await result.current.signInWithEmail("ana@test.invalid", "password");
      await new Promise((resolve) => setTimeout(resolve, 5));
    });

    expect(result.current.user?.full_name).toBe("Ana");
    expect(fake.profileQueries).toBe(1);
  });

  it("loads the profile once on startup with an existing session", async () => {
    fake.session = { user: { id: "u1", email: "ana@test.invalid" } };
    const { result } = await renderAuth();

    // A token refresh or returning to the tab repeats the event.
    await act(async () => {
      fake.listener?.("TOKEN_REFRESHED", fake.session);
      await new Promise((resolve) => setTimeout(resolve, 5));
    });

    expect(result.current.user?.full_name).toBe("Ana");
    expect(fake.profileQueries).toBe(1);
  });

  it("rejects a blocked account at sign-in and closes its session", async () => {
    fake.profile = { ...fake.profile, is_blocked: true, blocked_reason: "Spam" };
    const { result } = await renderAuth();

    await act(async () => {
      await expect(result.current.signInWithEmail("ana@test.invalid", "password")).rejects.toThrow("Spam");
    });

    expect(fake.signOutCalls).toBeGreaterThan(0);
    expect(result.current.user).toBeNull();
  });

  it("does not show a person as connected while email confirmation is pending", async () => {
    fake.signUpResult = { user: { id: "u1", email: "ana@test.invalid" }, session: null };
    const { result } = await renderAuth();

    let returned: unknown = "unset";
    await act(async () => {
      returned = await result.current.signUpWithEmail("ana@test.invalid", "password1", "Ana");
    });

    expect(returned).toBeNull();
    expect(result.current.user).toBeNull();
  });

  it("connects the person when no confirmation is required", async () => {
    const user = { id: "u1", email: "ana@test.invalid" };
    fake.signUpResult = { user, session: { user } };
    const { result } = await renderAuth();

    await act(async () => {
      await result.current.signUpWithEmail("ana@test.invalid", "password1", "Ana");
    });

    expect(result.current.user?.id).toBe("u1");
  });
});
