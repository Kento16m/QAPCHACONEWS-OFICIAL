import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { type CookieConsent, getCookieConsent, onCookieConsentReopen, setCookieConsent } from "@/lib/analytics";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(getCookieConsent() === null);
    return onCookieConsentReopen(() => setVisible(true));
  }, []);

  const saveConsent = (consent: CookieConsent) => {
    setCookieConsent(consent);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div role="region" aria-label="Preferencias de cookies" className="fixed bottom-4 inset-x-4 z-50 md:inset-x-auto md:left-1/2 md:w-[min(680px,calc(100%-2rem))] md:-translate-x-1/2">
      <div className="flex flex-col gap-3 rounded-[22px] border border-border bg-card/95 p-4 shadow-[0_18px_50px_rgba(15,23,42,0.18)] backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1 text-sm leading-5 text-foreground">
          <span className="font-medium">Usamos cookies para mejorar tu experiencia.</span>{" "}
          <span className="text-muted-foreground">
            Consulta nuestra
            <Link to="/cookies" className="ml-1 underline underline-offset-2 hover:text-primary">
              Política de Cookies
            </Link>
            ,
            <Link to="/politica-de-privacidad" className="mx-1 underline underline-offset-2 hover:text-primary">
              Política de Privacidad
            </Link>
            y
            <Link to="/terminos-y-condiciones" className="ml-1 underline underline-offset-2 hover:text-primary">
              Términos y Condiciones
            </Link>
            .
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => saveConsent("rejected")}
            className="inline-flex items-center justify-center rounded-full border border-border bg-secondary px-3 py-2 text-sm font-medium text-foreground transition hover:bg-accent"
          >
            Rechazar
          </button>
          <button
            type="button"
            onClick={() => saveConsent("accepted")}
            className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-95"
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
}
