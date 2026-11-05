import { useEffect, type ReactNode } from "react";
import { recordAdminAccessLog } from "@/lib/admin";
import { Button } from "@/components/ui/button";
import { useSession } from "../../lib/session";
import { AuthScreen } from "./AuthScreen";
import { RequiredEnrollment, VerifyMfa } from "./mfa";
import { SignIn } from "./SignIn";

const LOGGED_KEY = "qap_admin_access_logged";

const browserName = (agent: string) =>
  agent.includes("Edg")
    ? "Edge"
    : agent.includes("Chrome")
      ? "Chrome"
      : agent.includes("Firefox")
        ? "Firefox"
        : agent.includes("Safari")
          ? "Safari"
          : "Navegador";

const systemName = (agent: string) =>
  agent.includes("Windows")
    ? "Windows"
    : agent.includes("Android")
      ? "Android"
      : /iPhone|iPad/.test(agent)
        ? "iOS"
        : agent.includes("Mac")
          ? "macOS"
          : agent.includes("Linux")
            ? "Linux"
            : "Otro";

function useAccessLog() {
  const { access, session, profile } = useSession();
  const userId = session?.user.id;

  useEffect(() => {
    if (access !== "ok" || !userId || sessionStorage.getItem(LOGGED_KEY) === userId) return;
    sessionStorage.setItem(LOGGED_KEY, userId);
    const agent = navigator.userAgent;
    void recordAdminAccessLog({
      user_id: userId,
      role: profile?.role ?? null,
      user_agent: agent,
      browser: browserName(agent),
      operating_system: systemName(agent),
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      referrer: document.referrer || null,
      page_url: window.location.href,
    });
  }, [access, userId, profile?.role]);
}

/** Shows the screen a person's session allows, at any URL, so a shared link survives signing in. */
export function Gate({ children }: { children: ReactNode }) {
  const { status, access, profile, signOut, refresh } = useSession();
  useAccessLog();

  if (status === "loading") {
    return (
      <div
        role="status"
        aria-label="Cargando"
        className="flex min-h-svh items-center justify-center"
      >
        <div className="h-10 w-40 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  if (status === "error") {
    return (
      <AuthScreen
        title="No pudimos conectarnos"
        description="Revisá tu conexión. Si el problema sigue, avisá al administrador."
      >
        <Button onClick={() => void refresh()}>Reintentar</Button>
      </AuthScreen>
    );
  }

  switch (access) {
    case "signin":
      return <SignIn />;
    case "verify":
      return <VerifyMfa />;
    case "enroll":
      return <RequiredEnrollment />;
    case "denied":
      return (
        <AuthScreen
          title="No tenés acceso al panel"
          description="Esta cuenta no es del equipo. Si debería serlo, pedile a un administrador que te dé permiso."
        >
          <Button variant="outline" onClick={() => void signOut()}>
            Salir
          </Button>
        </AuthScreen>
      );
    case "blocked":
      return (
        <AuthScreen
          title="Tu cuenta está bloqueada"
          description={
            profile?.blocked_reason ?? "Hablá con un administrador para saber el motivo."
          }
        >
          <Button variant="outline" onClick={() => void signOut()}>
            Salir
          </Button>
        </AuthScreen>
      );
    case "ok":
      return <>{children}</>;
  }
}
