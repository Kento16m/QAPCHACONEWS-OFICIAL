import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useDashboard, type DashboardStats } from "../features/today/api";
import { ReadsCard } from "../features/today/ReadsCard";
import { attentionItems, type AttentionItem } from "../lib/attention";
import { isReady } from "../lib/nav";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: Today });

const TIME_ZONE = "America/Asuncion";
const number = new Intl.NumberFormat("es-PY");

const longDate = new Intl.DateTimeFormat("es-PY", {
  timeZone: TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
});
const shortDate = new Intl.DateTimeFormat("es-PY", {
  timeZone: TIME_ZONE,
  day: "numeric",
  month: "short",
});

const Card = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <section className={cn("rounded-2xl border bg-card p-5", className)}>{children}</section>
);

const Skeleton = ({ className }: { className: string }) => (
  <div className={cn("animate-pulse rounded-lg bg-muted", className)} />
);

function Figure({ label, value }: { label: string; value: number | undefined }) {
  return (
    <Card>
      <p className="text-muted-foreground">{label}</p>
      {value === undefined ? (
        <Skeleton className="mt-2 h-8 w-20" />
      ) : (
        <p className="mt-1.5 text-3xl font-semibold">{number.format(value)}</p>
      )}
    </Card>
  );
}

function AttentionRow({ item }: { item: AttentionItem }) {
  return (
    <li className="flex items-center gap-3 border-t py-3 first:border-t-0">
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg font-semibold",
          item.tone === "warning" ? "bg-warning-soft text-warning" : "bg-muted text-foreground",
        )}
      >
        {item.count}
      </span>
      <div className="min-w-0">
        <p className="font-medium">{item.title}</p>
        <p className="text-[0.8125rem] text-muted-foreground">{item.detail}</p>
      </div>
      {isReady(item.to) && (
        <Link to={item.to as "/"} className="ml-auto font-semibold text-link hover:underline">
          {item.action}
        </Link>
      )}
    </li>
  );
}

function Attention({ stats }: { stats: DashboardStats | undefined }) {
  const items = stats ? attentionItems(stats) : [];
  return (
    <Card className="lg:col-span-4">
      <h2 className="mb-2 text-lg font-semibold">Requiere atención</h2>
      {!stats ? (
        <div className="space-y-3 pt-1">
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-muted-foreground">Todo en orden: no hay nada pendiente.</p>
      ) : (
        <ul>
          {items.map((item) => (
            <AttentionRow key={item.id} item={item} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function MostRead({ stats }: { stats: DashboardStats | undefined }) {
  return (
    <Card className="lg:col-span-7">
      <h2 className="mb-3 text-lg font-semibold">Más leídas</h2>
      {!stats ? (
        <Skeleton className="h-48" />
      ) : stats.most_read.length === 0 ? (
        <p className="text-muted-foreground">
          Todavía no hay notas publicadas. Las más leídas aparecen acá.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b">
                <th scope="col" className="py-2 pr-4 font-normal">
                  Nota
                </th>
                <th scope="col" className="hidden py-2 pr-4 font-normal sm:table-cell">
                  Sección
                </th>
                <th scope="col" className="hidden py-2 pr-4 font-normal md:table-cell">
                  Publicada
                </th>
                <th scope="col" className="py-2 text-right font-normal">
                  Lecturas
                </th>
              </tr>
            </thead>
            <tbody>
              {stats.most_read.map((note) => (
                <tr key={note.id} className="border-b last:border-b-0">
                  <td className="py-2.5 pr-4">{note.title}</td>
                  <td className="hidden py-2.5 pr-4 text-muted-foreground sm:table-cell">
                    {note.category ?? "Sin sección"}
                  </td>
                  <td className="hidden whitespace-nowrap py-2.5 pr-4 text-muted-foreground md:table-cell">
                    {note.published_at ? shortDate.format(new Date(note.published_at)) : "—"}
                  </td>
                  <td className="py-2.5 text-right font-medium">{number.format(note.reads)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function BySection({ stats }: { stats: DashboardStats | undefined }) {
  const top = Math.max(1, ...(stats?.by_category.map((section) => section.reads) ?? []));
  return (
    <Card className="lg:col-span-5">
      <h2 className="mb-3 text-lg font-semibold">Lecturas por sección</h2>
      {!stats ? (
        <Skeleton className="h-48" />
      ) : stats.by_category.length === 0 ? (
        <p className="text-muted-foreground">Aparecen cuando haya notas publicadas.</p>
      ) : (
        <ul className="space-y-3">
          {stats.by_category.map((section) => (
            <li key={section.id}>
              <div className="flex justify-between gap-3">
                <span>{section.name}</span>
                <span className="font-medium">{number.format(section.reads)}</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-muted" aria-hidden>
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${(section.reads / top) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Today() {
  const { data: stats, isError, refetch } = useDashboard();

  return (
    <>
      <header className="mb-5 flex flex-wrap items-baseline gap-x-3">
        <h1 className="text-2xl font-semibold">Hoy</h1>
        <p className="text-muted-foreground first-letter:uppercase">
          {longDate.format(new Date())}
        </p>
      </header>

      {isError && (
        <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border p-4">
          <p>No pudimos cargar las cifras. Revisá tu conexión.</p>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            Reintentar
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Figure label="Lecturas totales" value={stats?.total_reads} />
        <Figure label="Notas publicadas" value={stats?.published} />
        <Figure label="Comentarios, 24 h" value={stats?.comments_24h} />
        <Figure label="Suscriptores" value={stats?.subscribers} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-12">
        <ReadsCard className="lg:col-span-8" />
        <Attention stats={stats} />
        <MostRead stats={stats} />
        <BySection stats={stats} />
      </div>
    </>
  );
}
