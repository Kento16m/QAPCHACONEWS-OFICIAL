import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { requireSupabaseClient } from "@/lib/supabase";
import { panelAccess } from "./access";
import { SessionContext, type SessionState, type SessionValue } from "./session";

const readState = async (): Promise<SessionState> => {
  const client = requireSupabaseClient();
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  const session = data.session;
  if (!session) {
    return { status: "ready", session: null, profile: null, aal: "aal1", factorCount: 0 };
  }

  const [profile, level, factors] = await Promise.all([
    client
      .from("profiles")
      .select("full_name, avatar_url, role, is_blocked, blocked_reason")
      .eq("id", session.user.id)
      .maybeSingle(),
    client.auth.mfa.getAuthenticatorAssuranceLevel(),
    client.auth.mfa.listFactors(),
  ]);
  if (profile.error) throw profile.error;
  if (level.error) throw level.error;
  if (factors.error) throw factors.error;

  return {
    status: "ready",
    session,
    profile: profile.data,
    aal: level.data.currentLevel === "aal2" ? "aal2" : "aal1",
    factorCount: factors.data.totp.length,
  };
};

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({
    status: "loading",
    session: null,
    profile: null,
    aal: "aal1",
    factorCount: 0,
  });

  const refresh = useCallback(async () => {
    try {
      setState(await readState());
    } catch (error) {
      console.error("No se pudo leer la sesión:", error);
      // Only the first read can block the panel: later, a network blip must not hide what is open.
      setState((previous) =>
        previous.status === "loading" ? { ...previous, status: "error" } : previous,
      );
    }
  }, []);

  useEffect(() => {
    void refresh();
    const client = requireSupabaseClient();
    // Supabase blocks if this callback calls it directly, so the read waits for the next tick.
    const { data } = client.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "MFA_CHALLENGE_VERIFIED") {
        setTimeout(() => void refresh(), 0);
      }
    });
    return () => data.subscription.unsubscribe();
  }, [refresh]);

  const signOut = useCallback(async () => {
    await requireSupabaseClient().auth.signOut();
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      ...state,
      refresh,
      signOut,
      access: panelAccess({
        hasSession: Boolean(state.session),
        role: state.profile?.role ?? null,
        isBlocked: Boolean(state.profile?.is_blocked),
        aal: state.aal,
        factorCount: state.factorCount,
        requireMfa: import.meta.env.VITE_ADMIN_REQUIRE_MFA === "true",
      }),
    }),
    [state, refresh, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
