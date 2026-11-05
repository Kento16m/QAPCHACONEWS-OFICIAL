import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { requireSupabaseClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { EnrollFactor } from "../features/auth/mfa";
import { useSession } from "../lib/session";

export const Route = createFileRoute("/seguridad")({ component: Security });

const FACTORS_KEY = ["admin", "factors"];

function Security() {
  const { factorCount, refresh, profile } = useSession();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const { data: factors } = useQuery({
    queryKey: FACTORS_KEY,
    queryFn: async () => {
      const { data, error } = await requireSupabaseClient().auth.mfa.listFactors();
      if (error) throw error;
      return data.totp;
    },
  });

  const remove = async (factorId: string) => {
    const { error } = await requireSupabaseClient().auth.mfa.unenroll({ factorId });
    if (error) {
      toast.error(
        "No pudimos quitar el dispositivo. Volvé a confirmar tu código e intentá de nuevo.",
      );
      return;
    }
    await queryClient.invalidateQueries({ queryKey: FACTORS_KEY });
    await refresh();
  };

  const enrolled = async () => {
    setAdding(false);
    await queryClient.invalidateQueries({ queryKey: FACTORS_KEY });
  };

  // The last device of an administrator stays: removing it would lock them out once it is required.
  const canRemove = profile?.role !== "admin" || factorCount > 1;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold">Seguridad</h1>
      <p className="mt-1 text-muted-foreground">
        La doble verificación pide un código de tu teléfono además de la contraseña. Registrá dos
        dispositivos: si perdés uno, seguís pudiendo entrar.
      </p>

      <section className="mt-5 rounded-2xl border bg-card p-5">
        <h2 className="text-lg font-semibold">Dispositivos registrados</h2>
        {factors && factors.length === 0 && (
          <p className="mt-2 text-muted-foreground">Todavía no registraste ninguno.</p>
        )}
        <ul className="mt-2">
          {factors?.map((factor, index) => (
            <li key={factor.id} className="flex items-center gap-3 border-t py-3 first:border-t-0">
              <span className="font-medium">Dispositivo {index + 1}</span>
              <span className="text-muted-foreground">
                desde {new Date(factor.created_at).toLocaleDateString("es-PY")}
              </span>
              {canRemove && (
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-auto"
                  onClick={() => void remove(factor.id)}
                >
                  Quitar
                </Button>
              )}
            </li>
          ))}
        </ul>

        {adding ? (
          <div className="mt-4 border-t pt-4">
            <EnrollFactor deviceName="Dispositivo" onDone={() => void enrolled()} />
          </div>
        ) : (
          <Button className="mt-4" onClick={() => setAdding(true)}>
            Registrar un dispositivo
          </Button>
        )}
      </section>
    </div>
  );
}
