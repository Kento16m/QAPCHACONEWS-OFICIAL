import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { GoogleIcon } from "./GoogleIcon";

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
