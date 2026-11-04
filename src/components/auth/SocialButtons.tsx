import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.11A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.11V7.05H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.95l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}

export function SocialButtons() {
  const { signInWithGoogle } = useAuth();
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      // Google takes over the page here; the session starts when it returns.
      await signInWithGoogle();
    } catch {
      toast.error("No pudimos iniciar sesión. Intentá de nuevo.");
    } finally {
      setBusy(false);
    }
  };
  const cls =
    "flex h-12 w-full items-center justify-center gap-3 rounded-xl border bg-card text-sm font-semibold transition hover:bg-secondary disabled:opacity-60";
  return (
    <div className="space-y-3">
      <button type="button" className={cls} onClick={run} disabled={busy}>
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <GoogleIcon />} Continuar con Google
      </button>
      <div className="flex items-center gap-3 py-1 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> o continúa con tu correo{" "}
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
