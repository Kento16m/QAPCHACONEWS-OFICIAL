import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fetchSeries, groupByMonth, hasEnoughHistory, rangeFor } from "../../lib/series";
import { AreaChart } from "../../ui/AreaChart";
import { Skeleton } from "../../ui/Field";

const PERIODS = [
  { days: 365, label: "12 meses" },
  { days: 30, label: "30 días" },
  { days: 7, label: "7 días" },
];

const shortDay = new Intl.DateTimeFormat("es-PY", {
  timeZone: "UTC",
  day: "numeric",
  month: "short",
});
const shortMonth = new Intl.DateTimeFormat("es-PY", {
  timeZone: "UTC",
  month: "short",
  year: "2-digit",
});

const labelFor = (day: string) =>
  day.length === 7
    ? shortMonth.format(new Date(`${day}-01T00:00:00Z`))
    : shortDay.format(new Date(`${day}T00:00:00Z`));

export function ReadsCard({ className }: { className?: string }) {
  const [days, setDays] = useState(30);
  const range = useMemo(() => rangeFor(days), [days]);
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["admin", "series", range.from, range.to],
    queryFn: () => fetchSeries(range.from, range.to),
  });

  const rows = useMemo(
    () => (data && days === 365 ? groupByMonth(data) : (data ?? [])),
    [data, days],
  );
  const total = rows.reduce((sum, row) => sum + row.reads, 0);

  return (
    <section className={cn("rounded-2xl border bg-card p-5", className)}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Lecturas por día</h2>
          <p className="text-[0.8125rem] text-muted-foreground">
            {total.toLocaleString("es-PY")} en este período
          </p>
        </div>
        <div role="group" aria-label="Período" className="flex rounded-lg bg-muted p-1">
          {PERIODS.map((period) => (
            <button
              key={period.days}
              type="button"
              aria-pressed={days === period.days}
              onClick={() => setDays(period.days)}
              className={cn(
                "rounded-md px-3 py-1 text-[0.8125rem] font-medium transition-colors duration-150",
                days === period.days ? "bg-card shadow-sm" : "text-muted-foreground",
              )}
            >
              {period.label}
            </button>
          ))}
        </div>
      </div>

      {isError ? (
        <div role="alert" className="flex flex-wrap items-center gap-3">
          <p>No pudimos cargar las lecturas.</p>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            Reintentar
          </Button>
        </div>
      ) : isPending ? (
        <Skeleton className="h-60" />
      ) : !hasEnoughHistory(data) ? (
        <p className="max-w-prose text-muted-foreground">
          El gráfico se completa solo: necesita al menos 3 días con lecturas. El sitio empieza a
          contarlas por día cuando usa esta base. Mientras tanto, mirá las lecturas por sección y
          las notas más leídas.
        </p>
      ) : (
        <AreaChart
          rows={rows}
          formatLabel={labelFor}
          summary={`Lecturas por ${days === 365 ? "mes" : "día"}: ${total} en total.`}
        />
      )}
    </section>
  );
}
