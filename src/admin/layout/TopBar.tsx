import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, LogOut, Menu, Moon, PanelLeft, ShieldCheck, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDashboard } from "../features/today/api";
import { attentionItems } from "../lib/attention";
import { isReady } from "../lib/nav";
import { useSession } from "../lib/session";
import { currentTheme, saveTheme, type Theme } from "../lib/theme";

const iconButton = "size-10 rounded-lg text-muted-foreground";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");

function ThemeButton() {
  const [theme, setTheme] = useState<Theme>(currentTheme);
  const next = theme === "dark" ? "light" : "dark";
  return (
    <Button
      variant="outline"
      size="icon"
      className={iconButton}
      aria-label={next === "dark" ? "Cambiar a modo oscuro" : "Cambiar a modo claro"}
      onClick={() => {
        saveTheme(next);
        setTheme(next);
      }}
    >
      {theme === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </Button>
  );
}

function Notifications() {
  const { data: stats } = useDashboard();
  const items = stats ? attentionItems(stats) : [];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className={`${iconButton} relative`}
          aria-label={items.length ? `Avisos: ${items.length}` : "Avisos"}
        >
          <Bell className="size-5" />
          {items.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-warning" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Requiere atención</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <p className="px-2 py-3 text-muted-foreground">Nada pendiente por ahora.</p>
        ) : (
          items.map((item) =>
            isReady(item.to) ? (
              <DropdownMenuItem key={item.id} asChild>
                <Link to={item.to}>
                  {item.count} · {item.title}
                </Link>
              </DropdownMenuItem>
            ) : (
              <p key={item.id} className="px-2 py-1.5">
                {item.count} · {item.title}
              </p>
            ),
          )
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu() {
  const { profile, session, signOut } = useSession();
  const name = profile?.full_name || session?.user.email || "Tu cuenta";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-lg p-1 font-medium hover:bg-muted"
        >
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="size-9 rounded-full object-cover" />
          ) : (
            <span className="flex size-9 items-center justify-center rounded-full bg-muted font-semibold">
              {initials(name)}
            </span>
          )}
          <span className="hidden max-w-40 truncate sm:block">{name}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal text-muted-foreground">
          {profile?.role === "admin" ? "Administrador" : "Editor"}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/seguridad">
            <ShieldCheck className="size-4" aria-hidden />
            Seguridad
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void signOut()}>
          <LogOut className="size-4" aria-hidden />
          Salir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TopBar({
  onToggleSidebar,
  onOpenMobile,
}: {
  onToggleSidebar: () => void;
  onOpenMobile: () => void;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-card px-4 lg:px-6">
      <Button
        variant="outline"
        size="icon"
        className={`${iconButton} lg:hidden`}
        aria-label="Abrir menú"
        onClick={onOpenMobile}
      >
        <Menu className="size-5" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className={`${iconButton} hidden lg:inline-flex`}
        aria-label="Colapsar o expandir menú"
        onClick={onToggleSidebar}
      >
        <PanelLeft className="size-5" />
      </Button>
      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <ThemeButton />
        <Notifications />
        <UserMenu />
      </div>
    </header>
  );
}
