import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as auth from "@/lib/auth";
import { getProfileColor } from "@/lib/profile-colors";
import { supabase } from "@/lib/supabase";
import type { AuthUser } from "@/types";

type AuthView = "login" | "register" | "forgot";

type ProfileRow = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  profile_color?: string | null;
  role: AuthUser["role"];
  is_blocked?: boolean;
  blocked_reason?: string | null;
};

interface AuthContextValue {
  user: AuthUser | null;
  profile: ProfileRow | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<AuthUser>;
  signUpWithEmail: (email: string, password: string, full_name: string) => Promise<AuthUser | null>;
  signInWithGoogle: () => Promise<unknown>;
  signInWithFacebook: () => Promise<unknown>;
  sendRecoveryCode: (email: string) => Promise<{ ok: true }>;
  verifyRecoveryCode: (email: string, token: string) => Promise<{ id: string } | null>;
  updatePassword: (password: string) => Promise<unknown>;
  resetPassword: (email: string) => Promise<{ ok: true }>;
  signOut: () => Promise<boolean>;
  dialogOpen: boolean;
  dialogView: AuthView;
  openAuthDialog: (view?: AuthView) => void;
  setDialogOpen: (open: boolean) => void;
  setDialogView: (view: AuthView) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const toAuthUser = (sessionUser: { id: string; email?: string | null; user_metadata?: { full_name?: string; name?: string; avatar_url?: string | null; picture?: string | null } } | null, profile?: ProfileRow | null): AuthUser | null => {
  if (!sessionUser) return null;

  const userMetadata = sessionUser.user_metadata ?? {};
  const fallbackName = userMetadata.full_name ?? userMetadata.name ?? sessionUser.email?.split("@")[0] ?? "Lector";
  const fallbackAvatar = userMetadata.avatar_url ?? userMetadata.picture ?? null;

  const resolvedProfileColor = profile?.profile_color ?? getProfileColor(profile?.full_name ?? fallbackName);

  return {
    id: sessionUser.id,
    email: sessionUser.email ?? "",
    full_name: profile?.full_name ?? fallbackName,
    avatar_url: profile?.avatar_url ?? fallbackAvatar,
    profile_color: resolvedProfileColor,
    role: profile?.role ?? "reader",
  };
};

async function loadProfile(userId: string | null): Promise<ProfileRow | null> {
  if (!userId || !supabase) return null;

  const fallbackSelect = "id, full_name, avatar_url, profile_color, role, is_blocked, blocked_reason";

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select(fallbackSelect)
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("No se pudo cargar el perfil:", error);
      return null;
    }

    // The signup trigger creates the row; syncUser retries once if it is not visible yet.
    if (!data) return null;

    return {
      ...data,
      role: data.role ?? "reader",
      is_blocked: Boolean(data.is_blocked),
      blocked_reason: data.blocked_reason ?? null,
    } as ProfileRow;
  } catch (error) {
    console.error("No se pudo cargar el perfil:", error);
    return null;
  }
}

const profileRequests = new Map<string, Promise<ProfileRow | null>>();

// A sign-in and its auth event ask at the same moment: both share one request.
const loadProfileOnce = (userId: string) => {
  const running = profileRequests.get(userId);
  if (running) return running;
  const request = loadProfile(userId).finally(() => profileRequests.delete(userId));
  profileRequests.set(userId, request);
  return request;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogView, setDialogView] = useState<AuthView>("login");
  // Auth events repeat on token refresh and tab focus; the profile only reloads for a different user.
  const loadedUserId = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const syncUser = async (sessionUser: { id: string; email?: string | null; user_metadata?: { full_name?: string; avatar_url?: string | null } } | null) => {
      if (!sessionUser) {
        loadedUserId.current = null;
        if (mounted) {
          setUser(null);
          setProfile(null);
          setLoading(false);
        }
        return;
      }

      if (sessionUser.id === loadedUserId.current) return;

      let nextProfile = await loadProfileOnce(sessionUser.id);
      if (!nextProfile && mounted) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        nextProfile = await loadProfileOnce(sessionUser.id);
      }
      if (sessionUser.id === loadedUserId.current) return;

      if (nextProfile?.is_blocked) {
        const blockedMessage = nextProfile.blocked_reason?.trim() || "Tu cuenta fue suspendida por el administrador.";
        auth.setBlockedAccountMessage(blockedMessage);
        await auth.forceBlockedAccountLogout(blockedMessage);
        if (mounted) {
          setUser(null);
          setProfile(null);
          setLoading(false);
        }
        return;
      }

      if (!nextProfile && mounted) {
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      if (!mounted) return;

      const nextUser = toAuthUser(sessionUser, nextProfile);
      loadedUserId.current = sessionUser.id;
      setProfile(nextProfile);
      setUser(nextUser);
      setLoading(false);
    };

    // Fires once on startup with the stored session, or null if there is none.
    const unsubscribe = auth.onAuthStateChange(async (sessionUser) => {
      await syncUser(sessionUser);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const signInWithEmail = async (email: string, password: string) => {
    const sessionUser = await auth.signInWithPassword(email, password);
    const nextProfile = await loadProfileOnce(sessionUser.id);
    if (nextProfile?.is_blocked) {
      const blockedMessage = nextProfile.blocked_reason?.trim() || "Tu cuenta fue suspendida por el administrador.";
      auth.setBlockedAccountMessage(blockedMessage);
      await auth.forceBlockedAccountLogout(blockedMessage);
      throw new Error(blockedMessage);
    }
    const nextUser = toAuthUser(sessionUser, nextProfile);
    if (!nextUser) throw new Error("No se pudo iniciar sesión.");
    loadedUserId.current = sessionUser.id;
    setUser(nextUser);
    setProfile(nextProfile);
    setLoading(false);
    return nextUser;
  };

  const signUpWithEmail = async (email: string, password: string, full_name: string) => {
    const sessionUser = await auth.signUp(email, password, full_name);
    if (!sessionUser) return null;
    const nextProfile = await loadProfileOnce(sessionUser.id);
    const nextUser = toAuthUser(sessionUser, nextProfile);
    if (!nextUser) throw new Error("No se pudo crear la cuenta.");

    loadedUserId.current = sessionUser.id;
    setUser(nextUser);
    setProfile(nextProfile);
    setLoading(false);
    return nextUser;
  };

  const value = useMemo<AuthContextValue>(() => ({
    user,
    profile,
    loading,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle: () => auth.signInWithOAuth("google"),
    signInWithFacebook: () => auth.signInWithOAuth("facebook"),
    sendRecoveryCode: (email: string) => auth.sendPasswordRecoveryCode(email),
    verifyRecoveryCode: (email: string, token: string) => auth.verifyPasswordRecoveryCode(email, token).then((user) => user ? { id: user.id } : null),
    updatePassword: (password: string) => auth.updatePassword(password),
    resetPassword: (email: string) => auth.resetPasswordForEmail(email),
    signOut: async () => {
      const ok = await auth.signOut();
      loadedUserId.current = null;
      setUser(null);
      setProfile(null);
      return ok;
    },
    dialogOpen,
    dialogView,
    openAuthDialog: (view = "login") => {
      setDialogView(view);
      setDialogOpen(true);
    },
    setDialogOpen,
    setDialogView,
  }), [user, profile, loading, dialogOpen, dialogView]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}

export type { AuthView };
