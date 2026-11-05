import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/hooks/use-news";
import { cn } from "@/lib/utils";
import {
  listAccess,
  listActivity,
  listAiUsage,
  PAGE_SIZE,
  restoreDeletedNote,
  summarizeAiUsage,
  type AccessFilters,
  type ActivityRow,
} from "../lib/manage";
import { useSession } from "../lib/session";
import { Select, Skeleton } from "../ui/Field";
import { LoadError, Pager } from "../ui/Pager";

export const Route = createFileRoute("/actividad")({ component: ActivityPage });

const when = new Intl.DateTimeFormat("es-PY", {
  timeZone: "America/Asuncion",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const ACTIONS: Record<string, string> = {
  created: "creó",
  edited: "editó",
  published: "publicó",
  unpublished: "despublicó",
  archived: "archivó",
  scheduled: "programó",
  status_changed: "cambió el estado de",
  deleted: "borró",
  role_changed: "cambió el rol de",
  blocked: "bloqueó a",
  unblocked: "desbloqueó a",
  homepage_changed: "cambió la portada",
};

const ENTITIES: Record<string, string> = {
  article: "la nota",
  comment: "un comentario:",
  category: "la categoría",
  tag: "la etiqueta",
};

const sentence = (row: ActivityRow) =>
  row.entity === "homepage"
    ? ACTIONS["homepage_changed"]
    : `${ACTIONS[row.action] ?? row.action} ${ENTITIES[row.entity] ?? ""} ${row.summary}`;

function ActivityList() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["admin", "activity", page],
    queryFn: () => listActivity(page),
    placeholderData: keepPreviousData,
  });

  const restore = useMutation({
    mutationFn: (articleId: string) => restoreDeletedNote(articleId),
    onSuccess: () => {
      toast.success("Nota restaurada como borrador.");
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (error) => toast.error(error.message),
  });

  if (isError) return <LoadError what="la actividad" onRetry={() => void refetch()} />;
  if (isPending) return <Skeleton className="m-5 h-64" />;
  if (data.rows.length === 0) {
    return (
      <p className="p-10 text-center text-muted-foreground">
        Todavía no hay actividad. Lo que haga el equipo queda anotado acá.
      </p>
    );
  }

  return (
    <>
      <ul>
        {data.rows.map((row) => (
          <li
            key={row.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b p-4 last:border-b-0"
          >
            <p className="min-w-0 flex-1">
              <span className="font-medium">{row.actor?.full_name ?? "Sistema"}</span>{" "}
              {sentence(row)}
            </p>
            <span className="text-[0.8125rem] text-muted-foreground">
              {when.format(new Date(row.created_at))}
            </span>
            {row.entity === "article" && row.action === "deleted" && row.entity_id && (
              <Button
                variant="outline"
                size="sm"
                disabled={restore.isPending}
                onClick={() => restore.mutate(row.entity_id as string)}
              >
                Restaurar
              </Button>
            )}
          </li>
        ))}
      </ul>
      <Pager page={page} total={data.total} size={PAGE_SIZE} onChange={setPage} />
    </>
  );
}

function AccessList() {
  const [page, setPage] = useState(1);
  const [term, setTerm] = useState("");
  const q = useDebouncedValue(term, 300);
  const [filters, setFilters] = useState<Omit<AccessFilters, "q">>({
    status: "",
    role: "",
    days: null,
    device: "",
  });
  const change = (next: Partial<Omit<AccessFilters, "q">>) => {
    setFilters((value) => ({ ...value, ...next }));
    setPage(1);
  };

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["admin", "access", page, q, filters],
    queryFn: () => listAccess(page, { ...filters, q }),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 border-b p-4">
        <Input
          type="search"
          aria-label="Buscar accesos"
          value={term}
          onChange={(event) => {
            setTerm(event.target.value);
            setPage(1);
          }}
          placeholder="Buscar por nombre o correo"
          className="h-10 max-w-xs rounded-lg"
        />
        <Select
          aria-label="Filtrar por estado"
          value={filters.status}
          onChange={(event) => change({ status: event.target.value })}
        >
          <option value="">Todos los estados</option>
          <option value="success">Exitoso</option>
          <option value="failed">Fallido</option>
          <option value="blocked">Bloqueado</option>
        </Select>
        <Select
          aria-label="Filtrar por rol"
          value={filters.role}
          onChange={(event) => change({ role: event.target.value })}
        >
          <option value="">Todos los roles</option>
          <option value="admin">Administrador</option>
          <option value="editor">Editor</option>
          <option value="reader">Lector</option>
        </Select>
        <Select
          aria-label="Filtrar por fecha"
          value={filters.days ?? ""}
          onChange={(event) => change({ days: Number(event.target.value) || null })}
        >
          <option value="">Todas las fechas</option>
          <option value="1">Últimas 24 horas</option>
          <option value="7">Últimos 7 días</option>
          <option value="30">Últimos 30 días</option>
        </Select>
        <Select
          aria-label="Filtrar por dispositivo"
          value={filters.device}
          onChange={(event) => change({ device: event.target.value as AccessFilters["device"] })}
        >
          <option value="">Todos los dispositivos</option>
          <option value="desktop">Computadora</option>
          <option value="mobile">Celular</option>
        </Select>
      </div>
      {isError ? (
        <LoadError what="los accesos" onRetry={() => void refetch()} />
      ) : isPending ? (
        <Skeleton className="m-5 h-64" />
      ) : data.rows.length === 0 ? (
        <p className="p-10 text-center text-muted-foreground">
          Ningún acceso coincide con esos filtros.
        </p>
      ) : (
        <div className="relative overflow-x-auto">
          <table className="w-full text-left">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b">
                <th scope="col" className="px-4 py-3 font-normal">
                  Persona
                </th>
                <th scope="col" className="py-3 pr-4 font-normal">
                  Fecha
                </th>
                <th scope="col" className="py-3 pr-4 font-normal">
                  Estado
                </th>
                <th scope="col" className="hidden py-3 pr-4 font-normal md:table-cell">
                  Equipo
                </th>
                <th scope="col" className="hidden py-3 pr-4 font-normal lg:table-cell">
                  IP
                </th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.id} className="border-b last:border-b-0">
                  <td className="px-4 py-2.5">
                    <p className="font-medium">{row.full_name ?? "Sin nombre"}</p>
                    <p className="text-[0.8125rem] text-muted-foreground">{row.email}</p>
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-4 text-muted-foreground">
                    {when.format(new Date(row.accessed_at))}
                  </td>
                  <td className="py-2.5 pr-4">
                    {row.status === "success"
                      ? "Exitoso"
                      : row.status === "blocked"
                        ? "Bloqueado"
                        : "Fallido"}
                  </td>
                  <td className="hidden py-2.5 pr-4 text-muted-foreground md:table-cell">
                    {[row.browser, row.operating_system].filter(Boolean).join(" · ")}
                  </td>
                  <td className="hidden py-2.5 pr-4 text-muted-foreground lg:table-cell">
                    {row.ip_address}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} total={data?.total ?? 0} size={PAGE_SIZE} onChange={setPage} />
    </>
  );
}

function AiUsage() {
  const { data } = useQuery({ queryKey: ["admin", "ai-usage"], queryFn: () => listAiUsage(30) });
  if (!data) return null;
  const { uses, dollars } = summarizeAiUsage(data);
  return (
    <p className="mb-4 text-muted-foreground">
      Asistente de IA, últimos 30 días: <span className="font-medium text-foreground">{uses}</span>{" "}
      {uses === 1 ? "uso" : "usos"}, cerca de{" "}
      <span className="font-medium text-foreground">US$ {dollars.toFixed(2)}</span>.
    </p>
  );
}

function ActivityPage() {
  const { profile } = useSession();
  const [tab, setTab] = useState<"activity" | "access">("activity");

  if (profile?.role !== "admin") {
    return <p className="py-16 text-center text-lg">Esta pantalla es solo para administradores.</p>;
  }

  return (
    <>
      <h1 className="mb-3 text-2xl font-semibold">Actividad</h1>
      <AiUsage />
      <section className="rounded-2xl border bg-card">
        <div role="tablist" aria-label="Registros" className="flex gap-1 border-b p-2">
          {(
            [
              ["activity", "Actividad"],
              ["access", "Control de acceso"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={cn(
                "rounded-lg px-3 py-1.5 font-medium transition-colors duration-150",
                tab === id ? "bg-accent text-accent-foreground" : "hover:bg-muted",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === "activity" ? <ActivityList /> : <AccessList />}
      </section>
    </>
  );
}
