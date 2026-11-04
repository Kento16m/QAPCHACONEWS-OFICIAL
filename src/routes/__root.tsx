import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useLocation,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { trackPageView } from "@/lib/analytics";
import { SiteHeader } from "@/components/news/SiteHeader";
import { CookieBanner } from "@/components/news/CookieBanner";
import { SiteFooter } from "@/components/news/SiteFooter";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/hooks/useAuth";
import { AuthDialog } from "@/components/auth/AuthDialog";

function NotFoundComponent() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página no encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          La página que buscás no existe o fue movida.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Esta página no pudo cargarse
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ocurrió un problema en nuestro lado. Podés intentar nuevamente o volver a la portada.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Reintentar
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Volver al inicio
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      {
        name: "description",
        content:
          "QAP ChacoNews: noticias, análisis y actualidad del Chaco paraguayo, con enfoque local, institucional y de profundo impacto regional.",
      },
      { name: "theme-color", content: "#0B1220" },
      { name: "application-name", content: "QAP ChacoNews" },
      { name: "robots", content: "index,follow" },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "QAP ChacoNews" },
      { property: "og:title", content: "QAP ChacoNews — Noticias del Chaco paraguayo" },
      {
        property: "og:description",
        content:
          "Cobertura local, análisis y actualidad del Chaco paraguayo con rigor editorial y mirada regional.",
      },
      { property: "og:image", content: "https://qapchaconews.com/og-image.png" },
      { property: "og:image:alt", content: "QAP ChacoNews" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "QAP ChacoNews — Noticias del Chaco paraguayo" },
      {
        name: "twitter:description",
        content: "Cobertura local, análisis y actualidad del Chaco paraguayo con rigor editorial.",
      },
      { name: "twitter:image", content: "https://qapchaconews.com/og-image.png" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/logo%201.png", sizes: "180x180" },
      { rel: "manifest", href: "/site.webmanifest" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Playfair+Display:wght@600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <>
      <HeadContent />
      {children}
      <Scripts />
    </>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith("/admin");

  useEffect(() => {
    trackPageView(location.pathname, location.search, document.title || "QAP ChacoNews");
  }, [location.pathname, location.search]);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <AuthProvider>
        {!isAdminRoute && <SiteHeader />}
        <main className={isAdminRoute ? "min-h-screen bg-slate-100" : undefined}>
          <Outlet />
        </main>
        {!isAdminRoute && <SiteFooter />}
        {!isAdminRoute && <CookieBanner />}
        <AuthDialog />
      </AuthProvider>
      <Toaster position="top-center" />
    </QueryClientProvider>
  );
}
