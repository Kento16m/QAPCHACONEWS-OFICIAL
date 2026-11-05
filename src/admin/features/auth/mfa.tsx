import { useEffect, useState, type FormEvent } from "react";
import { requireSupabaseClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSession } from "../../lib/session";
import { AuthScreen } from "./AuthScreen";

const WRONG_CODE = "El código no es correcto o ya venció. Probá con el siguiente.";

function CodeInput({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  return (
    <label className="block font-medium">
      Código de 6 dígitos
      <Input
        required
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, ""))}
        className="mt-1.5 text-lg tracking-widest"
      />
    </label>
  );
}

export function VerifyMfa() {
  const { signOut, refresh } = useSession();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const client = requireSupabaseClient();
    const { data } = await client.auth.mfa.listFactors();
    // The app that made the code is unknown, so any registered device may match it.
    let verified = false;
    for (const factor of data?.totp ?? []) {
      const result = await client.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
      if (!result.error) {
        verified = true;
        break;
      }
    }
    if (verified) await refresh();
    else setError(WRONG_CODE);
    setBusy(false);
  };

  return (
    <AuthScreen
      title="Confirmá que sos vos"
      description="Abrí tu aplicación de autenticación y escribí el código."
    >
      <form onSubmit={(event) => void submit(event)} className="space-y-4">
        <CodeInput value={code} onChange={setCode} />
        {error && (
          <p role="alert" className="text-destructive-text">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" disabled={busy || code.length !== 6}>
          {busy ? "Comprobando…" : "Continuar"}
        </Button>
      </form>
      <Button variant="ghost" className="mt-2 w-full" onClick={() => void signOut()}>
        Salir
      </Button>
    </AuthScreen>
  );
}

type Enrollment = { factorId: string; qr: string; secret: string };

/** Registers one device. A device left half-registered is removed, so a retry starts clean. */
export function EnrollFactor({ deviceName, onDone }: { deviceName: string; onDone: () => void }) {
  const { refresh } = useSession();
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const start = async () => {
      const client = requireSupabaseClient();
      const { data: existing } = await client.auth.mfa.listFactors();
      const pending = (existing?.all ?? []).filter((factor) => factor.status === "unverified");
      await Promise.all(pending.map((factor) => client.auth.mfa.unenroll({ factorId: factor.id })));

      const { data, error: enrollError } = await client.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `${deviceName} ${Date.now()}`,
      });
      if (!active) return;
      if (enrollError || !data) {
        setError("No pudimos preparar el registro. Recargá la página e intentá de nuevo.");
        return;
      }
      setEnrollment({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    };
    void start();
    return () => {
      active = false;
    };
  }, [deviceName]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!enrollment) return;
    setBusy(true);
    setError(null);
    const { error: verifyError } = await requireSupabaseClient().auth.mfa.challengeAndVerify({
      factorId: enrollment.factorId,
      code,
    });
    setBusy(false);
    if (verifyError) {
      setError(WRONG_CODE);
      return;
    }
    await refresh();
    onDone();
  };

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-4">
      <p>Escaneá este código con Google Authenticator u otra aplicación similar.</p>
      {enrollment ? (
        <>
          <img
            src={enrollment.qr}
            alt="Código QR para registrar el dispositivo"
            className="size-44 rounded-lg bg-white p-2"
          />
          <p className="text-muted-foreground">
            Si no podés escanearlo, escribí esta clave:{" "}
            <code data-testid="totp-secret" className="break-all font-medium text-foreground">
              {enrollment.secret}
            </code>
          </p>
          <CodeInput value={code} onChange={setCode} />
        </>
      ) : (
        !error && <div className="size-44 animate-pulse rounded-lg bg-muted" />
      )}
      {error && (
        <p role="alert" className="text-destructive-text">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy || !enrollment || code.length !== 6}>
        {busy ? "Comprobando…" : "Registrar dispositivo"}
      </Button>
    </form>
  );
}

export function RequiredEnrollment() {
  const { signOut } = useSession();
  return (
    <AuthScreen
      title="Activá la doble verificación"
      description="Como administrador, tu cuenta puede borrar y publicar todo. Por eso pedimos un código además de tu contraseña."
    >
      <EnrollFactor deviceName="Dispositivo" onDone={() => undefined} />
      <Button variant="ghost" className="mt-2" onClick={() => void signOut()}>
        Salir
      </Button>
    </AuthScreen>
  );
}
