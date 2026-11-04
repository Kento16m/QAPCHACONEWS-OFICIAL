import { Link } from "@tanstack/react-router";
import { useBreakingArticles } from "@/hooks/use-news";

export function Ticker() {
  const { data, isLoading } = useBreakingArticles();
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
      <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-extrabold tracking-wider text-primary-foreground">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary-foreground" /> ÚLTIMA
        HORA
      </span>
      <div className="relative min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_6%,black_94%,transparent)]">
        {isLoading ? (
          <span className="text-xs text-navy-muted">Cargando…</span>
        ) : !data?.length ? (
          <span className="text-xs text-navy-muted">Sin novedades por ahora</span>
        ) : (
          <div className="animate-ticker flex w-max gap-10">
            {[...data, ...data].map((a, i) => (
              <Link
                key={i}
                to="/noticia/$slug"
                params={{ slug: a.slug }}
                className="whitespace-nowrap text-xs font-medium hover:text-primary"
                tabIndex={i >= data.length ? -1 : 0}
              >
                {a.title}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
