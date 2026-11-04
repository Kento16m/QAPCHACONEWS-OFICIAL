import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2 } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";
import { readBlockedAccountMessage } from "@/lib/auth";
import { Field, SubmitButton, TextLink } from "./fields";
import { SocialButtons } from "./SocialButtons";

const email = z.string().trim().min(1, "Ingresá tu correo electrónico").email("Ingresá un correo electrónico válido").max(255);
const password = z.string().min(8, "La contraseña debe tener al menos 8 caracteres").max(72);

const loginSchema = z.object({ email, password });
const registerSchema = z
  .object({
    full_name: z.string().trim().min(2, "Ingresá tu nombre completo").max(100),
    email,
    password,
    confirm: z.string(),
    terms: z.boolean().refine((v) => v, "Debés aceptar los Términos y la Política de privacidad"),
  })
  .refine((d) => d.password === d.confirm, { path: ["confirm"], message: "Las contraseñas no coinciden" });
const forgotSchema = z.object({ email });

const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Ocurrió un error inesperado.");

export function LoginForm() {
  const { signInWithEmail, setDialogOpen, setDialogView } = useAuth();
  const [blockedNotice, setBlockedNotice] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof loginSchema>>({ resolver: zodResolver(loginSchema) });

  useEffect(() => {
    setBlockedNotice(readBlockedAccountMessage());
  }, []);

  const onSubmit = handleSubmit(async (d) => {
    try {
      const u = await signInWithEmail(d.email, d.password);
      toast.success(`¡Hola de nuevo, ${u.full_name}!`);
      setDialogOpen(false);
    } catch (e) { toast.error(errMsg(e)); }
  });
  return (
    <div>
      <h2 className="font-display text-3xl font-bold">Iniciar sesión</h2>
      <p className="mt-1 text-center text-sm text-muted-foreground">
        No tenés una cuenta?{' '}
        <TextLink onClick={() => setDialogView("register")}>Registrate</TextLink>
      </p>
      {blockedNotice && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {blockedNotice}
        </div>
      )}
      <div className="mt-6"><SocialButtons /></div>
      <form onSubmit={onSubmit} noValidate className="mt-3 space-y-4">
        <Field label="Correo electrónico" type="email" autoComplete="email" autoFocus placeholder="tu@correo.com" error={errors.email?.message} {...register("email")} />
        <Field label="Contraseña" type="password" autoComplete="current-password" placeholder="••••••••" error={errors.password?.message}
          aside={<button type="button" onClick={() => setDialogView("forgot")} className="text-xs font-semibold text-primary hover:underline">¿Olvidaste tu contraseña?</button>}
          {...register("password")} />
        <SubmitButton loading={isSubmitting}>Iniciar sesión</SubmitButton>
      </form>
    </div>
  );
}

export function RegisterForm() {
  const { signUpWithEmail, setDialogOpen, setDialogView } = useAuth();
  const { register, control, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { terms: false },
  });
  const onSubmit = handleSubmit(async (d) => {
    try {
      const u = await signUpWithEmail(d.email, d.password, d.full_name);
      if (!u) {
        toast.success("Te enviamos un correo para confirmar tu cuenta. Confirmalo para iniciar sesión.");
        setDialogOpen(false);
        return;
      }

      toast.success(`¡Bienvenido a QAP ChacoNews, ${u.full_name}!`);
      setDialogOpen(false);
    } catch (e) { toast.error(errMsg(e)); }
  });
  return (
    <div>
      <h2 className="font-display text-3xl font-bold">Crear cuenta</h2>
      <p className="mt-1 text-sm text-muted-foreground">¿Ya tenés cuenta? <TextLink onClick={() => setDialogView("login")}>Iniciá sesión</TextLink></p>
      <div className="mt-6"><SocialButtons /></div>
      <form onSubmit={onSubmit} noValidate className="mt-3 space-y-4">
        <Field label="Nombre completo" autoComplete="name" autoFocus placeholder="Tu nombre completo" error={errors.full_name?.message} {...register("full_name")} />
        <Field label="Correo electrónico" type="email" autoComplete="email" placeholder="tu@correo.com" error={errors.email?.message} {...register("email")} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Contraseña" type="password" autoComplete="new-password" placeholder="Mín. 8 caracteres" error={errors.password?.message} {...register("password")} />
          <Field label="Confirmar contraseña" type="password" autoComplete="new-password" placeholder="Repetila" error={errors.confirm?.message} {...register("confirm")} />
        </div>
        <div>
          <Controller control={control} name="terms" render={({ field }) => (
            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} aria-invalid={!!errors.terms} className="mt-0.5" />
              <span className="text-muted-foreground">
                Acepto los{' '}
                <a
                  href="/terminos-y-condiciones"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="font-semibold text-primary hover:underline"
                >
                  Términos de uso
                </a>{' '}
                y la{' '}
                <a
                  href="/politica-de-privacidad"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="font-semibold text-primary hover:underline"
                >
                  Política de privacidad
                </a>
                .
              </span>
            </label>
          )} />
          {errors.terms && <p role="alert" className="mt-1.5 text-xs font-medium text-destructive">{errors.terms.message}</p>}
        </div>
        <SubmitButton loading={isSubmitting}>Crear cuenta</SubmitButton>
      </form>
    </div>
  );
}

export function ForgotPasswordForm() {
  const { sendRecoveryCode, verifyRecoveryCode, updatePassword, setDialogView } = useAuth();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [verificationStep, setVerificationStep] = useState<"email" | "otp" | "password" | "success">("email");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof forgotSchema>>({ resolver: zodResolver(forgotSchema) });

  const onEmailSubmit = handleSubmit(async (d) => {
    try {
      await sendRecoveryCode(d.email);
      setSentTo(d.email);
      setVerificationStep("otp");
      toast.success("Te enviamos un código de verificación a tu correo.");
    } catch (e) { toast.error(errMsg(e)); }
  });

  const onOtpSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!sentTo) return;

    try {
      setIsVerifying(true);
      const user = await verifyRecoveryCode(sentTo, code);
      if (!user) throw new Error("No se pudo verificar el código.");
      setVerificationStep("password");
      toast.success("Código verificado. Ahora podés crear una nueva contraseña.");
    } catch (e) { toast.error(errMsg(e)); }
    finally { setIsVerifying(false); }
  };

  const onPasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (newPassword.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Las contraseñas no coinciden.");
      return;
    }

    try {
      await updatePassword(newPassword);
      setVerificationStep("success");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Tu contraseña fue actualizada correctamente.");
    } catch (e) { toast.error(errMsg(e)); }
  };

  if (verificationStep === "success") {
    return (
      <div className="text-center">
        <CheckCircle2 className="mx-auto h-14 w-14 text-primary" />
        <h2 className="mt-4 font-display text-3xl font-bold">Contraseña actualizada</h2>
        <p className="mt-2 text-sm text-muted-foreground">Ya podés iniciar sesión con tu nueva contraseña.</p>
        <p className="mt-6 text-sm"><TextLink onClick={() => setDialogView("login")}>Volver a iniciar sesión</TextLink></p>
      </div>
    );
  }

  if (verificationStep === "password") {
    return (
      <div>
        <h2 className="font-display text-3xl font-bold">Cambiar contraseña</h2>
        <p className="mt-1 text-sm text-muted-foreground">Elegí una nueva contraseña para tu cuenta.</p>
        <form onSubmit={onPasswordSubmit} className="mt-6 space-y-4">
          <Field label="Nueva contraseña" type="password" autoComplete="new-password" autoFocus placeholder="Mínimo 8 caracteres" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          <Field label="Confirmar contraseña" type="password" autoComplete="new-password" placeholder="Repetí la contraseña" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          <SubmitButton>Guardar nueva contraseña</SubmitButton>
        </form>
        <p className="mt-6 text-center text-sm"><TextLink onClick={() => setDialogView("login")}>Volver a iniciar sesión</TextLink></p>
      </div>
    );
  }

  if (verificationStep === "otp") {
    return (
      <div>
        <h2 className="font-display text-3xl font-bold">Verificar código</h2>
        <p className="mt-1 text-sm text-muted-foreground">Ingresá el código que te enviamos a <strong className="text-foreground">{sentTo}</strong>.</p>
        <form onSubmit={onOtpSubmit} className="mt-6 space-y-4">
          <Field label="Código de verificación" type="text" autoComplete="one-time-code" autoFocus placeholder="Ej: 123456" value={code} onChange={(e) => setCode(e.target.value)} />
          <SubmitButton loading={isVerifying}>Verificar código</SubmitButton>
        </form>
        <div className="mt-4 space-y-2 text-center text-sm text-muted-foreground">
          <p>¿No recibiste el código? <TextLink onClick={() => setVerificationStep("email")}>Pedir otro</TextLink></p>
          <p><TextLink onClick={() => setDialogView("login")}>Volver a iniciar sesión</TextLink></p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="font-display text-3xl font-bold">Recuperar contraseña</h2>
      <p className="mt-1 text-sm text-muted-foreground">Ingresá tu correo y te enviaremos un código para verificar tu identidad.</p>
      <form onSubmit={onEmailSubmit} noValidate className="mt-6 space-y-4">
        <Field label="Correo electrónico" type="email" autoComplete="email" autoFocus placeholder="tu@correo.com" error={errors.email?.message} {...register("email")} />
        <SubmitButton loading={isSubmitting}>Enviar código</SubmitButton>
      </form>
      <p className="mt-6 text-center text-sm"><TextLink onClick={() => setDialogView("login")}>← Volver a iniciar sesión</TextLink></p>
    </div>
  );
}
