import { useState, type FormEvent } from "react";
import { requireSupabaseClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthScreen } from "./AuthScreen";

const SITE = import.meta.env.VITE_APP_URL || "https://qapchaconews.com";

const signInMessage = (message: string) =>
  /invalid login credentials/i.test(message)
    ? "Correo o contraseña incorrectos."
    : /email not confirmed/i.test(message)
      ? "Todavía no confirmaste tu correo. Revisá tu bandeja de entrada."
      : "No pudimos iniciar sesión. Revisá tu conexión e intentá de nuevo.";

export function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const google = async () => {
    setError(null);
    const { error: oauthError } = await requireSupabaseClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (oauthError) setError(signInMessage(oauthError.message));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { error: authError } = await requireSupabaseClient().auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (authError) setError(signInMessage(authError.message));
    setBusy(false);
  };

  return (
    <AuthScreen title="Entrá al panel" description="Para el equipo de QAP Chaco News.">
      <Button variant="outline" size="lg" className="w-full" onClick={() => void google()}>
        Entrar con Google
      </Button>

      <div className="my-5 flex items-center gap-3 text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        o con tu correo
        <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={(event) => void submit(event)} className="space-y-4">
        <label className="block font-medium">
          Correo
          <Input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1.5"
          />
        </label>
        <label className="block font-medium">
          Contraseña
          <Input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1.5"
          />
        </label>
        {error && (
          <p role="alert" className="text-destructive-text">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? "Entrando…" : "Entrar"}
        </Button>
      </form>

      <a
        href={`${SITE}/restablecer-contrasena`}
        className="mt-4 inline-block text-link underline-offset-4 hover:underline"
      >
        ¿Olvidaste tu contraseña?
      </a>
    </AuthScreen>
  );
}
