import { Check, Facebook, Link2, Twitter } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { parseEmail } from "@/lib/email";
import { Button } from "@/components/ui/button";
import { useSubscribe } from "@/hooks/use-news";
import { trackArticleShare, trackNewsletterSignup } from "@/lib/analytics";
import { cn } from "@/lib/utils";

export function ReadingProgress() {
  const [p, setP] = useState(0);
  const [top, setTop] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      setP(max > 0 ? Math.min(100, (h.scrollTop / max) * 100) : 0);
      const header = document.querySelector("header");
      setTop(header ? Math.max(0, header.getBoundingClientRect().bottom) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);
  return (
    <div
      className="fixed inset-x-0 z-50 h-1 bg-transparent"
      style={{ top }}
      role="progressbar"
      aria-label="Progreso de lectura"
      aria-valuenow={Math.round(p)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full bg-primary transition-[width] duration-150"
        style={{ width: `${p}%` }}
      />
    </div>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.06 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.48.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.75-.72 2-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35M12.05 21.8h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.89-9.88 2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.88 9.88m8.41-18.3A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.68 1.45h.01c6.55 0 11.89-5.34 11.89-11.89 0-3.18-1.24-6.16-3.48-8.41" />
    </svg>
  );
}

export function ShareButtons({ title, vertical }: { title: string; vertical?: boolean }) {
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState("");
  useEffect(() => setUrl(window.location.href), []);
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  const links = [
    { label: "Compartir en WhatsApp", href: `https://wa.me/?text=${t}%20${u}`, icon: WhatsAppIcon },
    {
      label: "Compartir en Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
      icon: Facebook,
    },
    {
      label: "Compartir en X",
      href: `https://twitter.com/intent/tweet?text=${t}&url=${u}`,
      icon: Twitter,
    },
  ];
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      trackArticleShare("copy", title, "");
      setCopied(true);
      toast.success("Enlace copiado al portapapeles");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("No se pudo copiar el enlace");
    }
  };
  const btn =
    "grid h-11 w-11 place-items-center rounded-full border bg-card text-foreground shadow-soft transition hover:-translate-y-0.5 hover:border-primary hover:bg-primary hover:text-primary-foreground";
  return (
    <div className={cn("flex gap-2", vertical ? "flex-col" : "flex-row items-center")}>
      <span
        className={cn(
          "text-[10px] font-bold uppercase tracking-widest text-muted-foreground",
          vertical ? "mb-1 text-center" : "mr-1",
        )}
      >
        Compartir
      </span>
      {links.map(({ label, href, icon: I }) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noreferrer"
          aria-label={label}
          className={btn}
          onClick={() => {
            const platform = label.includes("WhatsApp")
              ? "whatsapp"
              : label.includes("Facebook")
                ? "facebook"
                : "x";
            trackArticleShare(platform, title, "");
          }}
        >
          <I className="h-4 w-4" />
        </a>
      ))}
      <button type="button" onClick={copy} aria-label="Copiar enlace" className={btn}>
        {copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
      </button>
    </div>
  );
}

export function NewsletterCompact() {
  const [email, setEmail] = useState("");
  const sub = useSubscribe();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = parseEmail(email);
    if (!parsed) {
      toast.error("Ingresá un correo electrónico válido.");
      return;
    }
    sub.mutate(parsed, {
      onSuccess: () => {
        trackNewsletterSignup("article_compact");
        toast.success("¡Te suscribiste a QAP ChacoNews!");
        setEmail("");
      },
    });
  };
  return (
    <div className="bg-auth-panel rounded-3xl p-6 text-navy-foreground">
      <h3 className="font-display text-xl font-bold">El Chaco en tu correo</h3>
      <p className="mt-1 text-sm text-navy-muted">Las noticias más importantes, cada mañana.</p>
      <form onSubmit={submit} noValidate className="mt-4 space-y-2">
        <label className="block">
          <span className="sr-only">Correo electrónico</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@correo.com"
            className="h-11 w-full rounded-full bg-card px-4 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
          />
        </label>
        <Button type="submit" className="h-11 w-full rounded-full" disabled={sub.isPending}>
          {sub.isPending ? "Enviando…" : "Suscribirme"}
        </Button>
      </form>
    </div>
  );
}
