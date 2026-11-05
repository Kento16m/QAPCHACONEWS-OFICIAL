export type PanelAccess = "signin" | "denied" | "blocked" | "enroll" | "verify" | "ok";

export const panelAccess = (input: {
  hasSession: boolean;
  role: "reader" | "editor" | "admin" | null;
  isBlocked: boolean;
  aal: "aal1" | "aal2";
  factorCount: number;
  requireMfa: boolean;
}): PanelAccess => {
  if (!input.hasSession) return "signin";
  if (input.isBlocked) return "blocked";
  if (input.role !== "editor" && input.role !== "admin") return "denied";
  if (input.factorCount > 0 && input.aal !== "aal2") return "verify";
  if (input.role === "admin" && input.requireMfa && input.factorCount === 0) return "enroll";
  return "ok";
};
