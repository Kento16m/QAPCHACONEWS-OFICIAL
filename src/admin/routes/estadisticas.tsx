import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ReadsCard } from "../features/today/ReadsCard";
import {
  comparedToPrevious,
  fetchRanking,
  fetchSeries,
  previousRange,
  rangeFor,
} from "../lib/series";
import { Skeleton } from "../ui/Field";
import { LoadError } from "../ui/Pager";

export const Route = createFileRoute("/estadisticas")({ component: StatsPage });

const number = new Intl.NumberFormat("es-PY");

function Ranking({
  title,
  dimension,
  range,
}: {
  title: string;
  dimension: "article" | "category" | "author";
  range: { from: string; to: string };
}) {
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["admin", "ranking", dimension, range.from, range.to],
    queryFn: () => fetchRanking(dimension, range.from, range.to),
  });
  const top = Math.max(1, ...(data?.map((row) => row.reads) ?? []));

  return (
    <section className="min-w-0 rounded-2xl border bg-card p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mb-3 text-[0.8125rem] text-muted-foreground">Últimos 30 días</p>
      {isError ? (
        <LoadError what="esta lista" onRetry={() => void refetch()} />
      ) : isPending ? (
        <Skeleton className="h-48" />
      ) : data.length === 0 ? (
        <p className="text-muted-foreground">Sin lecturas en los últimos 30 días.</p>
      ) : (
        <ul className="space-y-3">
          {data.map((row) => (
            <li key={row.id ?? row.label}>
              <div className="flex justify-between gap-3">
                {dimension === "article" ? (
                  <Link
                    to="/articulos/$id"
                    params={{ id: row.id }}
                    className="min-w-0 truncate hover:text-link hover:underline"
                  >
                    {row.label}
                  </Link>
                ) : (
                  <span className="min-w-0 truncate">{row.label}</span>
                )}
                <span className="font-medium">{number.format(row.reads)}</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-muted" aria-hidden>
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${(row.reads / top) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function StatsPage() {
  const range = useMemo(() => rangeFor(30), []);
  const before = useMemo(() => previousRange(range), [range]);
  const current = useQuery({
    queryKey: ["admin", "series", range.from, range.to],
    queryFn: () => fetchSeries(range.from, range.to),
  });
  const previous = useQuery({
    queryKey: ["admin", "series", before.from, before.to],
    queryFn: () => fetchSeries(before.from, before.to),
  });

  const now = current.data?.reduce((total, row) => total + row.reads, 0);
  const delta =
    current.data && previous.data ? comparedToPrevious(current.data, previous.data) : null;

  return (
    <>
      <header className="mb-5 flex min-h-10 flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Estadísticas</h1>
        {now !== undefined && (
          <p className="text-muted-foreground">
            {number.format(now)} lecturas en 30 días
            {delta !== null && ` (${delta > 0 ? "+" : ""}${delta}% frente a los 30 anteriores)`}
          </p>
        )}
      </header>
      <ReadsCard />
      <div className="mt-4 grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        <Ranking title="Notas más leídas" dimension="article" range={range} />
        <Ranking title="Por sección" dimension="category" range={range} />
        <Ranking title="Por autor" dimension="author" range={range} />
      </div>
      <p className="mt-4 text-[0.8125rem] text-muted-foreground">
        Se cuentan lecturas de notas, no visitantes únicos.
      </p>
    </>
  );
}
