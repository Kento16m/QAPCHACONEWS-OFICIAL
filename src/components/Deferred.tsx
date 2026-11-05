import { CatchBoundary } from "@tanstack/react-router";
import { Suspense, type ReactNode } from "react";
import { toast } from "sonner";

// A failed download must only cost this piece, never the page around it.
export function Deferred({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <CatchBoundary
      getResetKey={() => "deferred"}
      onCatch={() => toast.error("No se pudo cargar. Recargá la página.")}
      errorComponent={() => null}
    >
      <Suspense fallback={fallback}>{children}</Suspense>
    </CatchBoundary>
  );
}
