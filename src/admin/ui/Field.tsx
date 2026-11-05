import { useState, type ComponentProps } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

export function Select({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "panel-select h-10 rounded-lg border border-input bg-card pl-3 pr-8 text-sm text-foreground transition-colors duration-150 hover:border-muted-foreground disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

/** A picture hosted elsewhere can disappear: this says so instead of showing a torn page icon. */
export function Thumb({
  src,
  alt = "",
  className,
}: {
  src: string;
  alt?: string;
  className?: string;
}) {
  const [broken, setBroken] = useState<string | null>(null);
  if (broken === src) {
    return (
      <div
        role="img"
        aria-label="Imagen no disponible"
        className={cn("flex items-center justify-center bg-muted text-muted-foreground", className)}
      >
        <ImageOff className="size-5" aria-hidden />
      </div>
    );
  }
  return (
    <img src={src} alt={alt} loading="lazy" onError={() => setBroken(src)} className={className} />
  );
}

export function Card({ className, ...props }: ComponentProps<"section">) {
  return <section className={cn("rounded-2xl border bg-card p-5", className)} {...props} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-muted", className)} />;
}

const STATUS = {
  published: { label: "Publicada", className: "bg-success-soft text-success" },
  scheduled: { label: "Programada", className: "bg-accent text-accent-foreground" },
  draft: { label: "Borrador", className: "bg-muted text-foreground" },
  archived: { label: "Archivada", className: "bg-muted text-muted-foreground" },
} as const;

export const STATUS_OPTIONS = Object.entries(STATUS).map(([value, { label }]) => ({
  value,
  label,
}));

export function StatusBadge({ status }: { status: keyof typeof STATUS }) {
  const { label, className } = STATUS[status];
  return (
    <span className={cn("inline-block rounded-full px-2.5 py-0.5 text-xs font-medium", className)}>
      {label}
    </span>
  );
}
