import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { Gate } from "../features/auth/Gate";
import { AppLayout } from "../layout/AppLayout";
import { SessionProvider } from "../lib/SessionProvider";

export const Route = createRootRoute({
  component: () => (
    <SessionProvider>
      <Gate>
        <AppLayout>
          <Outlet />
        </AppLayout>
      </Gate>
      <Toaster position="bottom-right" />
    </SessionProvider>
  ),
  notFoundComponent: () => (
    <div className="py-16 text-center">
      <h1 className="text-2xl font-semibold">Esta pantalla no existe</h1>
      <Link to="/" className="mt-3 inline-block text-link underline">
        Volver a Hoy
      </Link>
    </div>
  ),
});
