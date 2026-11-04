import { LogOut, LayoutDashboard, ShieldAlert, User as UserIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { getProfileColor } from "@/lib/profile-colors";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const initials = (n: string) =>
  n
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

export function UserAvatar({ className }: { className?: string }) {
  const { user } = useAuth();
  if (!user) return null;

  const fallbackColor = user.profile_color ?? getProfileColor(user.full_name);

  return user.avatar_url ? (
    <img
      src={user.avatar_url}
      alt=""
      className={cn("h-10 w-10 rounded-full object-cover", className)}
    />
  ) : (
    <span
      className={cn(
        "grid h-10 w-10 place-items-center rounded-full text-sm font-bold text-white",
        className,
      )}
      style={{ backgroundColor: fallbackColor }}
    >
      {initials(user.full_name)}
    </span>
  );
}

export function UserMenu() {
  const { user, profile, signOut } = useAuth();
  if (!user) return null;

  const canAccessAdmin = Boolean(
    (profile && (profile.role === "admin" || profile.role === "editor")) ||
    user.email?.trim().toLowerCase() === "kentoterakawa@gmail.com",
  );

  const handleSignOut = async () => {
    await signOut();
    toast.success("Cerraste sesión.");
  };

  return (
    <AlertDialog>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Menú de usuario"
          className="shrink-0 rounded-full ring-offset-2 ring-offset-background transition hover:ring-2 hover:ring-primary"
        >
          <UserAvatar />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60 rounded-2xl p-2">
          <DropdownMenuLabel className="flex items-center gap-3">
            <UserAvatar className="h-9 w-9" />
            <div className="min-w-0">
              <p className="truncate font-bold">{user.full_name}</p>
              <p className="truncate text-xs font-normal text-muted-foreground">{user.email}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild className="rounded-lg">
            <Link to="/perfil" className="flex items-center gap-2">
              <UserIcon className="h-4 w-4" /> Mi perfil
            </Link>
          </DropdownMenuItem>
          {canAccessAdmin && (
            <DropdownMenuItem asChild className="rounded-lg">
              <Link to="/admin" className="flex items-center gap-2">
                <LayoutDashboard className="h-4 w-4" /> Panel de administración
              </Link>
            </DropdownMenuItem>
          )}
          <AlertDialogTrigger asChild>
            <DropdownMenuItem
              onSelect={(event) => event.preventDefault()}
              className="rounded-lg text-destructive focus:text-destructive"
            >
              <LogOut className="h-4 w-4" /> Cerrar sesión
            </DropdownMenuItem>
          </AlertDialogTrigger>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialogContent className="max-w-md rounded-3xl border border-border bg-card p-0 shadow-soft">
        <AlertDialogHeader className="px-6 pb-0 pt-6">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <AlertDialogTitle className="text-xl font-black text-foreground">
            ¿Cerrar sesión?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-muted-foreground">
            Si aceptás, saldrás de tu cuenta y tendrás que volver a iniciar sesión para continuar.
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
  );
}
