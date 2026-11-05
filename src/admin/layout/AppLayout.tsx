import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useSession } from "../lib/session";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

const COLLAPSED_KEY = "qap_admin_sidebar_collapsed";

/** Until the old panel retires, the second factor is optional, so administrators get a reminder. */
function SecurityReminder() {
  const { profile, factorCount } = useSession();
  if (profile?.role !== "admin" || factorCount >= 2) return null;
  return (
    <p className="mb-5 rounded-xl bg-warning-soft px-4 py-3 text-warning">
      {factorCount === 0
        ? "Pronto vas a necesitar un código además de tu contraseña."
        : "Registrá un segundo dispositivo por si perdés el primero."}{" "}
      <Link to="/seguridad" className="font-semibold underline">
        {factorCount === 0 ? "Activar ahora" : "Registrar"}
      </Link>
    </p>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSED_KEY) === "true");
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggle = () => {
    localStorage.setItem(COLLAPSED_KEY, String(!collapsed));
    setCollapsed(!collapsed);
  };

  return (
    <div className="flex min-h-svh">
      <aside
        className={cn(
          "sticky top-0 hidden h-svh shrink-0 border-r bg-card transition-[width] duration-200 lg:block",
          collapsed ? "w-20" : "w-[264px]",
        )}
      >
        <Sidebar collapsed={collapsed} />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[280px] bg-card p-0">
          <SheetTitle className="sr-only">Menú</SheetTitle>
          <Sidebar onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onToggleSidebar={toggle} onOpenMobile={() => setMobileOpen(true)} />
        <main className="mx-auto w-full max-w-[1536px] flex-1 p-4 lg:p-6">
          <SecurityReminder />
          {children}
        </main>
      </div>
    </div>
  );
}
