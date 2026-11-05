import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useDashboard } from "../features/today/api";
import { downloadCsv, toCsv } from "../lib/csv";
import {
  allSubscribers,
  deleteSubscriber,
  listSubscribers,
  PAGE_SIZE,
  type Subscriber,
} from "../lib/manage";
import { useSession } from "../lib/session";
import { Skeleton } from "../ui/Field";
import { LoadError, Pager } from "../ui/Pager";

export const Route = createFileRoute("/newsletter")({ component: NewsletterPage });

const day = new Intl.DateTimeFormat("es-PY", {
  timeZone: "America/Asuncion",
  day: "numeric",
  month: "short",
  year: "numeric",
});

const stateOf = (subscriber: Subscriber) =>
  subscriber.unsubscribed_at
    ? "Dado de baja"
    : subscriber.confirmed
      ? "Confirmado"
      : "Sin confirmar";

function NewsletterPage() {
  const queryClient = useQueryClient();
  const { profile } = useSession();
  const [page, setPage] = useState(1);
  const [removing, setRemoving] = useState<Subscriber | null>(null);
  const { data: stats } = useDashboard();

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["admin", "subscribers", page],
    queryFn: () => listSubscribers(page),
    placeholderData: keepPreviousData,
    enabled: profile?.role === "admin",
  });

  const remove = useMutation({
    mutationFn: (subscriber: Subscriber) => deleteSubscriber(subscriber.id),
    onSuccess: () => toast.success("Suscriptor quitado."),
    onError: (error) => toast.error(error.message),
    onSettled: () => {
      setRemoving(null);
      void queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
      return queryClient.invalidateQueries({ queryKey: ["admin", "subscribers"] });
    },
  });

  const exportAll = useMutation({
    mutationFn: async () => {
      const rows = await allSubscribers();
      downloadCsv(
        "suscriptores-qap.csv",
        toCsv(
          ["Correo", "Estado", "Suscripción"],
          rows.map((row) => [
            row.email,
            stateOf(row),
            row.subscribed_at ? day.format(new Date(row.subscribed_at)) : "",
          ]),
        ),
      );
    },
    onError: () => toast.error("No pudimos exportar la lista."),
  });

  if (profile?.role !== "admin") {
    return <p className="py-16 text-center text-lg">Esta pantalla es solo para administradores.</p>;
  }

  return (
    <>
      <header className="mb-5 flex min-h-10 flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Newsletter</h1>
        {data && (
          <p className="text-muted-foreground">
            {data.total} {data.total === 1 ? "suscriptor" : "suscriptores"}
            {stats &&
              `, ${stats.subscribers} ${stats.subscribers === 1 ? "confirmado" : "confirmados"}`}
          </p>
        )}
        <Button
          variant="outline"
          size="lg"
          className="ml-auto rounded-lg px-4"
          disabled={exportAll.isPending || !data?.total}
          onClick={() => exportAll.mutate()}
        >
          <Download className="size-4" aria-hidden />
          Exportar CSV
        </Button>
      </header>

      <p className="mb-4 rounded-xl bg-accent px-4 py-3 text-accent-foreground">
        Enviar correos desde el panel se activa cuando se elija un servicio de correo. Mientras
        tanto, podés exportar la lista.
      </p>

      <section className="rounded-2xl border bg-card">
        {isError ? (
          <LoadError what="los suscriptores" onRetry={() => void refetch()} />
        ) : isPending ? (
          <div className="space-y-3 p-5">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : data.rows.length === 0 ? (
          <p className="p-10 text-center text-lg font-medium">Todavía no hay suscriptores</p>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full text-left">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th scope="col" className="px-4 py-3 font-normal">
                    Correo
                  </th>
                  <th scope="col" className="hidden py-3 pr-4 font-normal sm:table-cell">
                    Estado
                  </th>
                  <th scope="col" className="hidden py-3 pr-4 font-normal sm:table-cell">
                    Suscripción
                  </th>
                  <th scope="col" className="py-3 pr-4 font-normal">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.id} className="border-b last:border-b-0">
                    <td className="px-4 py-3 [overflow-wrap:anywhere]">
                      <span className="font-medium">{row.email}</span>
                      <span className="block text-[0.8125rem] text-muted-foreground sm:hidden">
                        {stateOf(row)}
                      </span>
                    </td>
                    <td className="hidden py-3 pr-4 text-muted-foreground sm:table-cell">
                      {stateOf(row)}
                    </td>
                    <td className="hidden py-3 pr-4 text-muted-foreground sm:table-cell">
                      {row.subscribed_at ? day.format(new Date(row.subscribed_at)) : "—"}
                    </td>
                    <td className="py-3 pr-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Quitar ${row.email}`}
                        onClick={() => setRemoving(row)}
                      >
                        Quitar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={page} total={data?.total ?? 0} size={PAGE_SIZE} onChange={setPage} />
      </section>

      <AlertDialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Quitar a {removing?.email}?</AlertDialogTitle>
            <AlertDialogDescription>
              Sale de la lista. Para volver, tendría que suscribirse de nuevo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => removing && remove.mutate(removing)}
            >
              Quitar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
