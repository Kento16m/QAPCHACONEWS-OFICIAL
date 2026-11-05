import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { deleteCommentForAdmin, updateUserAccess } from "@/lib/admin";
import { requireSupabaseClient } from "@/lib/supabase";
import { NotePicker } from "../features/homepage/NotePicker";
import { listComments, PAGE_SIZE, type CommentRow } from "../lib/manage";
import { useSession } from "../lib/session";
import { Select, Skeleton } from "../ui/Field";
import { LoadError, Pager } from "../ui/Pager";

export const Route = createFileRoute("/comentarios")({ component: CommentsPage });

const when = new Intl.DateTimeFormat("es-PY", {
  timeZone: "America/Asuncion",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const PERIODS = [
  { value: "", label: "Todas las fechas" },
  { value: "1", label: "Últimas 24 horas" },
  { value: "7", label: "Últimos 7 días" },
  { value: "30", label: "Últimos 30 días" },
];

function CommentsPage() {
  const queryClient = useQueryClient();
  const { profile, session } = useSession();
  const isAdmin = profile?.role === "admin";
  const [page, setPage] = useState(1);
  const [days, setDays] = useState("");
  const [note, setNote] = useState<{ id: string; title: string } | null>(null);
  const [picking, setPicking] = useState(false);
  const [removing, setRemoving] = useState<CommentRow | null>(null);
  const [blocking, setBlocking] = useState<CommentRow | null>(null);
  const [reason, setReason] = useState("");

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["admin", "comments", page, days, note?.id ?? null],
    queryFn: () => listComments(page, note?.id ?? null, days ? Number(days) : null),
    placeholderData: keepPreviousData,
  });

  // A new comment appears on its own.
  useEffect(() => {
    const client = requireSupabaseClient();
    const channel = client
      .channel("admin-comments")
      .on("postgres_changes", { event: "*", schema: "public", table: "comments" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["admin", "comments"] });
        void queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
      })
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [queryClient]);

  const remove = useMutation({
    mutationFn: (comment: CommentRow) => deleteCommentForAdmin(comment.id),
    onSuccess: () => toast.success("Comentario borrado."),
    onError: (error) => toast.error(error.message),
    onSettled: () => {
      setRemoving(null);
      return queryClient.invalidateQueries({ queryKey: ["admin", "comments"] });
    },
  });

  const block = useMutation({
    mutationFn: (comment: CommentRow) =>
      updateUserAccess(comment.user_id, {
        is_blocked: true,
        blocked_reason: reason.trim() || null,
      }),
    onSuccess: () => toast.success("Cuenta bloqueada. Ya no puede comentar."),
    onError: (error) => toast.error(error.message),
    onSettled: () => {
      setBlocking(null);
      setReason("");
    },
  });

  return (
    <>
      <header className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Comentarios</h1>
        {data && (
          <p className="text-muted-foreground">
            {data.total} {data.total === 1 ? "comentario" : "comentarios"}
          </p>
        )}
      </header>

      <section className="rounded-2xl border bg-card">
        <div className="flex flex-wrap items-center gap-3 border-b p-4">
          <Select
            aria-label="Filtrar por fecha"
            value={days}
            onChange={(event) => {
              setDays(event.target.value);
              setPage(1);
            }}
          >
            {PERIODS.map((period) => (
              <option key={period.value} value={period.value}>
                {period.label}
              </option>
            ))}
          </Select>
          {note ? (
            <Button
              variant="outline"
              className="h-10 max-w-md rounded-lg"
              onClick={() => {
                setNote(null);
                setPage(1);
              }}
            >
              <span className="truncate">{note.title}</span>
              <X className="size-4" aria-label="Quitar filtro" />
            </Button>
          ) : (
            <Button variant="outline" className="h-10 rounded-lg" onClick={() => setPicking(true)}>
              Filtrar por nota
            </Button>
          )}
          {!isAdmin && (
            <p className="text-muted-foreground">
              Solo un administrador puede borrar comentarios o bloquear cuentas.
            </p>
          )}
        </div>

        {isError ? (
          <LoadError what="los comentarios" onRetry={() => void refetch()} />
        ) : isPending ? (
          <div className="space-y-3 p-5">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        ) : data.rows.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-lg font-medium">No hay comentarios con esos filtros</p>
            <p className="mt-1 text-muted-foreground">
              Los comentarios nuevos aparecen acá solos, sin recargar.
            </p>
          </div>
        ) : (
          <ul>
            {data.rows.map((comment) => (
              <li key={comment.id} className="border-b p-4 last:border-b-0">
                <p className="text-[0.8125rem] text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {comment.author?.full_name ?? "Lector"}
                  </span>
                  {" · "}
                  {when.format(new Date(comment.created_at))}
                  {comment.article && (
                    <>
                      {" · "}
                      <Link
                        to="/articulos/$id"
                        params={{ id: comment.article.id }}
                        className="hover:text-link hover:underline"
                      >
                        {comment.article.title}
                      </Link>
                    </>
                  )}
                </p>
                <p className="mt-1 whitespace-pre-wrap break-words">{comment.body}</p>
                {isAdmin && (
                  <div className="mt-2 flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setRemoving(comment)}>
                      Borrar
                    </Button>
                    {comment.user_id !== session?.user.id && (
                      <Button variant="ghost" size="sm" onClick={() => setBlocking(comment)}>
                        Bloquear al autor
                      </Button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        <Pager page={page} total={data?.total ?? 0} size={PAGE_SIZE} onChange={setPage} />
      </section>

      <NotePicker
        open={picking}
        onOpenChange={setPicking}
        title="Filtrar por nota"
        exclude={[]}
        onPick={(picked) => {
          setNote(picked);
          setPage(1);
        }}
      />

      <AlertDialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar este comentario?</AlertDialogTitle>
            <AlertDialogDescription>
              Desaparece del sitio, junto con sus respuestas. No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => removing && remove.mutate(removing)}
            >
              Borrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={blocking !== null} onOpenChange={(open) => !open && setBlocking(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Bloquear a {blocking?.author?.full_name ?? "este lector"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              No va a poder comentar. Si tiene un rol en el equipo, pierde también el acceso al
              panel. Se puede revertir en Usuarios.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label className="block font-medium">
            Motivo
            <Input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="mt-1.5"
            />
          </label>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => blocking && block.mutate(blocking)}
            >
              Bloquear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
