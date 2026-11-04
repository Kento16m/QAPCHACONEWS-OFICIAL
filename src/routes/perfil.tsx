import { createFileRoute, Link } from "@tanstack/react-router";
import { LogOut, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/perfil")({
  component: ProfilePage,
});

function ProfilePage() {
  const { user, profile, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-4xl items-center justify-center px-4 text-sm text-muted-foreground">
        Cargando perfil…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-3xl font-black text-foreground">Iniciá sesión para ver tu perfil</h1>
        <p className="text-muted-foreground">Tu información personal aparecerá aquí.</p>
        <Link
          to="/"
          className="rounded-full bg-primary px-5 py-2.5 font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Volver al inicio
        </Link>
      </div>
    );
  }

  const handleSignOut = async () => {
    await signOut();
    toast.success("Cerraste sesión.");
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Cuenta</p>
          <h1 className="text-3xl font-black text-foreground">Mi perfil</h1>
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              className="gap-2 border-input bg-background text-foreground hover:bg-accent"
            >
              <LogOut className="h-4 w-4" />
              Cerrar sesión
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="max-w-md rounded-3xl border border-border bg-card p-0 shadow-soft">
            <AlertDialogHeader className="px-6 pb-0 pt-6">
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <AlertDialogTitle className="text-xl font-black text-foreground">
                ¿Cerrar sesión?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-sm text-muted-foreground">
                Si aceptás, saldrás de tu cuenta y tendrás que volver a iniciar sesión para
                continuar.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex flex-row justify-end gap-2 border-t border-border bg-muted/20 px-6 py-4">
              <AlertDialogCancel asChild>
                <Button variant="outline" size="sm">
                  Cancelar
                </Button>
              </AlertDialogCancel>
              <AlertDialogAction asChild>
                <Button variant="destructive" size="sm" onClick={handleSignOut}>
                  Aceptar
                </Button>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="grid gap-6 md:grid-cols-[180px_minmax(0,1fr)]">
        <div className="flex items-center justify-center rounded-3xl border bg-card p-4 shadow-sm">
          {user.avatar_url ? (
            <img
              src={user.avatar_url}
              alt={user.full_name}
              className="h-24 w-24 rounded-full object-cover"
            />
          ) : (
            <div className="grid h-24 w-24 place-items-center rounded-full bg-primary text-2xl font-black text-primary-foreground">
              {user.full_name.slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>

        <div className="rounded-3xl border bg-card p-5 shadow-sm sm:p-6">
          <div className="space-y-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Nombre</p>
              <p className="mt-1 text-xl font-bold text-foreground">{user.full_name}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Correo</p>
              <p className="mt-1 text-lg text-foreground">{user.email}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Rol</p>
              <p className="mt-1 text-lg capitalize text-foreground">
                {profile?.role ?? user.role}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
