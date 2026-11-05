import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { trackCategoryView } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import type { Category } from "@/types";

export function Logo({
  className,
  variant = "auto",
}: {
  className?: string;
  variant?: "auto" | "dark" | "light";
}) {
  const [failed, setFailed] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(
    () => typeof document !== "undefined" && document.documentElement.classList.contains("dark"),
  );

  useEffect(() => {
    if (typeof document === "undefined") return;

    const updateTheme = () => {
      setIsDarkMode(document.documentElement.classList.contains("dark"));
    };

    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => observer.disconnect();
  }, []);

  const resolvedVariant = variant === "auto" ? (isDarkMode ? "dark" : "light") : variant;

  const isDark = resolvedVariant === "dark";
  const src = isDark ? "/logo-dark.webp" : "/logo-light.webp";

  if (failed) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-md bg-transparent px-1 py-1 text-sm font-black tracking-[0.2em] text-primary",
          className,
        )}
      >
        QAP
      </div>
    );
  }

  return (
    <img
      src={src}
      alt="QAP ChacoNews"
      width={isDark ? 204 : 200}
      height={128}
      loading="eager"
      onError={() => setFailed(true)}
      className={cn("h-11 w-auto object-contain", className)}
    />
  );
}

export function timeAgo(iso: string) {
  const m = Math.round((Date.now() - +new Date(iso)) / 60000);
  if (m < 60) return `Hace ${Math.max(m, 1)} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `Hace ${h} ${h === 1 ? "hora" : "horas"}`;
  const d = Math.round(h / 24);
  return `Hace ${d} ${d === 1 ? "día" : "días"}`;
}

export function CategoryBadge({
  category,
  className,
}: {
  category: Category | null;
  className?: string;
}) {
  if (!category) return null;
  return (
    <Link
      to="/categoria/$slug"
      params={{ slug: category.slug }}
      onClick={() => trackCategoryView(category.name, "article_badge")}
      style={{ backgroundColor: category.color ?? undefined }}
      className={cn(
        "relative z-10 inline-flex items-center rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-foreground",
        className,
      )}
    >
      {category.name}
    </Link>
  );
}

export function CoverImage({
  src,
  alt,
  className,
  fit = "cover",
}: {
  src: string | null;
  alt: string;
  className?: string;
  fit?: "cover" | "contain";
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div
        className={cn(
          "grid h-full w-full place-items-center bg-transparent text-muted-foreground",
          className,
        )}
        role="img"
        aria-label={alt}
      >
        <Logo className="h-1/3 max-h-16 opacity-60" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      style={{ objectPosition: "center center" }}
      className={cn(
        "h-full w-full bg-transparent object-cover object-center",
        fit === "contain" ? "object-contain" : "object-cover",
        className,
      )}
    />
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <h2 className="flex items-center gap-3 text-xl font-extrabold tracking-tight sm:text-2xl">
        <span className="h-6 w-1.5 rounded-full bg-primary" />
        {children}
      </h2>
      {action}
    </div>
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn("rounded-2xl", className)} />;
}

export function StateMessage({ children, error }: { children: ReactNode; error?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-dashed p-8 text-center text-sm",
        error ? "text-destructive" : "text-muted-foreground",
      )}
    >
      {children}
    </div>
  );
}
