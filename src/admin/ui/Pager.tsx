import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Pager({
  page,
  total,
  size,
  onChange,
  className,
}: {
  page: number;
  total: number;
  size: number;
  onChange: (page: number) => void;
  className?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / size));
  if (pages <= 1) return null;
  return (
    <nav
      aria-label="Páginas"
      className={cn("flex items-center justify-between gap-3 border-t px-4 py-3", className)}
    >
      <p className="text-muted-foreground">
        Página {page} de {pages}
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          <ChevronLeft className="size-4" aria-hidden />
          Anterior
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
        >
          Siguiente
          <ChevronRight className="size-4" aria-hidden />
        </Button>
      </div>
    </nav>
  );
}

export function LoadError({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 p-5">
      <p>No pudimos cargar {what}. Revisá tu conexión.</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Reintentar
      </Button>
    </div>
  );
}
