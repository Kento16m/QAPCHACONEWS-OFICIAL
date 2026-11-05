import { createContext, useContext } from "react";
import type { Session } from "@supabase/supabase-js";
import type { PanelAccess } from "./access";

export type PanelProfile = {
  full_name: string | null;
  avatar_url: string | null;
  role: "reader" | "editor" | "admin";
  is_blocked: boolean;
  blocked_reason: string | null;
};

export type SessionState = {
  status: "loading" | "error" | "ready";
  session: Session | null;
  profile: PanelProfile | null;
  aal: "aal1" | "aal2";
  factorCount: number;
};

export type SessionValue = SessionState & {
  access: PanelAccess;
  /** Reads session, profile and factors again: after signing in or changing a factor. */
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

export const SessionContext = createContext<SessionValue | null>(null);

export const useSession = () => {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession necesita SessionProvider.");
  return value;
};
