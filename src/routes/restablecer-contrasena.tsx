import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NOINDEX } from "@/lib/page-head";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/restablecer-contrasena")({
  head: () => ({ meta: [{ title: "Restablecer contraseña — QAP ChacoNews" }, NOINDEX] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setCheckingSession(false);
      return;
    }

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error("Error verificando la sesión de restauración:", error);
      }
      setSessionReady(Boolean(data.session));
      setCheckingSession(false);
    });
  }, []);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!supabase) {
      toast.error("La configuración de Supabase no está disponible.");
      return;
    }

    if (password.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Las contraseñas no coinciden.");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Tu contraseña se actualizó correctamente.");
      setPassword("");
      setConfirmPassword("");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudo actualizar la contraseña.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center px-4 py-12">
        <div className="w-full rounded-3xl border bg-card p-6 shadow-sm sm:p-8 text-center text-sm text-muted-foreground">
          Verificando la sesión de recuperación...
        </div>
      </div>
    );
  }

  if (!sessionReady) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center px-4 py-12">
        <div className="w-full rounded-3xl border bg-card p-6 shadow-sm sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Seguridad</p>
          <h1 className="mt-3 font-display text-3xl font-bold">Enlace inválido o vencido</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Volvé al inicio de sesión y pedí un nuevo código de verificación.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center px-4 py-12">
      <div className="w-full rounded-3xl border bg-card p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Seguridad</p>
        <h1 className="mt-3 font-display text-3xl font-bold">Restablecer contraseña</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ingresá tu nueva contraseña para finalizar el cambio.
        </p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="mb-2 block text-sm font-medium">Nueva contraseña</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              autoFocus
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">Confirmar contraseña</label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repetí la contraseña"
            />
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Guardando..." : "Guardar nueva contraseña"}
          </Button>
        </form>
      </div>
    </div>
  );
}
