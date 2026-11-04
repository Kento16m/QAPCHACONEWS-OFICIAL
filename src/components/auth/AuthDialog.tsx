import { Bell, Bookmark, MessageSquare } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Logo } from "@/components/news/primitives";
import { useAuth } from "@/hooks/useAuth";
import { ForgotPasswordForm, LoginForm, RegisterForm } from "./forms";

const benefits = [
  {
    icon: Bell,
    title: "Alertas de última hora",
    text: "Enterate primero de lo que pasa en el Chaco.",
  },
  { icon: Bookmark, title: "Guardá tus notas", text: "Armá tu lista de lectura para más tarde." },
  { icon: MessageSquare, title: "Participá", text: "Comentá y sumá tu mirada a cada historia." },
];

const titles = {
  login: "Iniciar sesión",
  register: "Crear cuenta",
  forgot: "Recuperar contraseña",
};

export function AuthDialog() {
  const { dialogOpen, setDialogOpen, dialogView } = useAuth();
  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent className="h-[100dvh] max-h-[100dvh] w-full max-w-full gap-0 overflow-y-auto rounded-none border-0 p-0 sm:h-auto sm:max-h-[92vh] sm:max-w-4xl sm:rounded-3xl md:grid md:grid-cols-[0.9fr_1.1fr] md:overflow-hidden">
        <DialogTitle className="sr-only">{titles[dialogView]}</DialogTitle>
        <DialogDescription className="sr-only">
          Accedé a tu cuenta de QAP ChacoNews
        </DialogDescription>
        <aside className="bg-auth-panel hidden flex-col justify-between p-10 text-navy-foreground md:flex">
          <Logo className="h-14 self-start" />
          <div>
            <h2 className="font-display text-4xl font-bold leading-tight">
              Tu voz cuenta en el Chaco
            </h2>
            <p className="mt-3 text-sm text-navy-muted">
              Sumate a la comunidad de lectores de QAP ChacoNews.
            </p>
            <ul className="mt-8 space-y-5">
              {benefits.map(({ icon: I, title, text }) => (
                <li key={title} className="flex gap-4">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary">
                    <I className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-bold">{title}</p>
                    <p className="text-sm text-navy-muted">{text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-navy-muted">© 2026 QAP ChacoNews</p>
        </aside>
        <div className="p-6 pt-12 sm:p-10 md:max-h-[92vh] md:overflow-y-auto">
          <div key={dialogView} className="animate-in fade-in slide-in-from-right-4 duration-300">
            {dialogView === "login" && <LoginForm />}
            {dialogView === "register" && <RegisterForm />}
            {dialogView === "forgot" && <ForgotPasswordForm />}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
