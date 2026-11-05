import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { useDebouncedValue } from "@/hooks/use-news";
import { updateAuthorRole, updateUserAccess } from "@/lib/admin";
import { listUsers, PAGE_SIZE, type UserRow } from "../lib/manage";
import { useSession } from "../lib/session";
import { Select, Skeleton } from "../ui/Field";
import { LoadError, Pager } from "../ui/Pager";

export const Route = createFileRoute("/usuarios")({
  validateSearch: (search: Record<string, unknown>): { q?: string | undefined } => ({
    q: typeof search["q"] === "string" && search["q"] ? search["q"] : undefined,
  }),
  component: UsersPage,
});

const ROLES = [
  { value: "reader", label: "Lector" },
  { value: "editor", label: "Editor" },
  { value: "admin", label: "Administrador" },
];

function UsersPage() {
  const { q: initial } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const queryClient = useQueryClient();
  const { session, profile } = useSession();
  const [page, setPage] = useState(1);
  const [term, setTerm] = useState(initial ?? "");
  const debounced = useDebouncedValue(term, 300);
  const [blocking, setBlocking] = useState<UserRow | null>(null);
  const [reason, setReason] = useState("");

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["admin", "users", page, debounced],
    queryFn: () => listUsers(page, debounced),
    placeholderData: keepPreviousData,
    enabled: profile?.role === "admin",
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin", "users"] });

  const setRole = useMutation({
    mutationFn: ({ user, role }: { user: UserRow; role: UserRow["role"] }) =>
      updateAuthorRole(user.id, role),
    onSuccess: () => toast.success("Rol cambiado."),
    onError: (error) => toast.error(error.message),
    onSettled: refresh,
  });

  const setAccess = useMutation({
    mutationFn: ({ user, blocked }: { user: UserRow; blocked: boolean }) =>
      updateUserAccess(user.id, {
        is_blocked: blocked,
        blocked_reason: blocked ? reason.trim() || null : null,
      }),
    onSuccess: (_result, { blocked }) =>
      toast.success(blocked ? "Cuenta bloqueada." : "Cuenta desbloqueada."),
    onError: (error) => toast.error(error.message),
    onSettled: () => {
      setBlocking(null);
      setReason("");
      return refresh();
    },
  });

  if (profile?.role !== "admin") {
    return <p className="py-16 text-center text-lg">Esta pantalla es solo para administradores.</p>;
  }

  return (
    <>
      <header className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Usuarios</h1>
        {data && (
          <p className="text-muted-foreground">
            {data.total} {data.total === 1 ? "cuenta" : "cuentas"}
          </p>
        )}
      </header>

      <section className="rounded-2xl border bg-card">
        <div className="border-b p-4">
          <Input
            type="search"
            aria-label="Buscar usuarios"
            value={term}
            onChange={(event) => {
              setTerm(event.target.value);
              setPage(1);
              void navigate({ search: {}, replace: true });
            }}
            placeholder="Buscar por nombre o correo"
            className="h-10 max-w-md rounded-lg"
          />
        </div>

        {isError ? (
          <LoadError what="los usuarios" onRetry={() => void refetch()} />
        ) : isPending ? (
          <div className="space-y-3 p-5">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : data.rows.length === 0 ? (
          <p className="p-10 text-center text-lg font-medium">Nadie coincide con esa búsqueda</p>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full text-left">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th scope="col" className="px-4 py-3 font-normal">
                    Persona
                  </th>
                  <th scope="col" className="py-3 pr-4 font-normal">
                    Rol
                  </th>
                  <th scope="col" className="py-3 pr-4 font-normal">
                    Estado
                  </th>
                  <th scope="col" className="py-3 pr-4 font-normal">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((user) => {
                  const locked = user.is_protected || user.id === session?.user.id;
                  return (
                    <tr key={user.id} className="border-b last:border-b-0">
                      <td className="px-4 py-3">
                        <p className="font-medium">{user.full_name ?? "Sin nombre"}</p>
                        <p className="text-[0.8125rem] text-muted-foreground">{user.email}</p>
                      </td>
                      <td className="py-3 pr-4">
                        <Select
                          aria-label={`Rol de ${user.full_name ?? user.email}`}
                          value={user.role}
                          disabled={locked || setRole.isPending}
                          onChange={(event) =>
                            setRole.mutate({ user, role: event.target.value as UserRow["role"] })
                          }
                        >
                          {ROLES.map((role) => (
                            <option key={role.value} value={role.value}>
                              {role.label}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className="py-3 pr-4">
                        {user.is_protected ? (
                          <span className="text-muted-foreground">Cuenta protegida</span>
                        ) : user.is_blocked ? (
                          <span className="text-destructive-text">
                            Bloqueada
                            {user.blocked_reason ? `: ${user.blocked_reason}` : ""}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Activa</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-right">
                        {!locked &&
                          (user.is_blocked ? (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={setAccess.isPending}
                              onClick={() => setAccess.mutate({ user, blocked: false })}
                            >
                              Desbloquear
                            </Button>
                          ) : (
                            <Button variant="outline" size="sm" onClick={() => setBlocking(user)}>
                              Bloquear
                            </Button>
                          ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={page} total={data?.total ?? 0} size={PAGE_SIZE} onChange={setPage} />
      </section>

      <AlertDialog open={blocking !== null} onOpenChange={(open) => !open && setBlocking(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Bloquear a {blocking?.full_name ?? blocking?.email}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              No va a poder comentar ni entrar al panel. La base lo aplica de inmediato, y se puede
              revertir desde acá.
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
              onClick={() => blocking && setAccess.mutate({ user: blocking, blocked: true })}
            >
              Bloquear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
