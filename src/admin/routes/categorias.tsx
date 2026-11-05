import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  createCategory,
  createTag,
  deleteCategory,
  deleteTag,
  getAdminCategories,
  getAdminTags,
  updateCategory,
  updateTag,
  type AdminCategory,
  type AdminTag,
} from "@/lib/admin";
import { useSession } from "../lib/session";
import { Skeleton } from "../ui/Field";
import { LoadError } from "../ui/Pager";

export const Route = createFileRoute("/categorias")({ component: TaxonomyPage });

type Editing =
  { kind: "category"; item: AdminCategory | null } | { kind: "tag"; item: AdminTag | null };

const friendly = (error: unknown) =>
  (error as { code?: string })?.code === "23505"
    ? "Ya existe una con ese nombre o dirección."
    : error instanceof Error
      ? error.message
      : "No pudimos guardar.";

function TaxonomyPage() {
  const queryClient = useQueryClient();
  const { profile } = useSession();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [removing, setRemoving] = useState<Editing | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [color, setColor] = useState("#465fff");
  const [order, setOrder] = useState("0");

  const categories = useQuery({ queryKey: ["admin", "categories"], queryFn: getAdminCategories });
  const tags = useQuery({ queryKey: ["admin", "tags"], queryFn: getAdminTags });

  const open = (next: Editing) => {
    setEditing(next);
    setName(next.item?.name ?? "");
    setSlug(next.item?.slug ?? "");
    if (next.kind === "category") {
      setColor(next.item?.color ?? "#465fff");
      setOrder(String(next.item?.sort_order ?? (categories.data?.length ?? 0) + 1));
    }
  };

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "tags"] });
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      if (editing.kind === "category") {
        const input = { name, slug, color, sort_order: Number(order) };
        if (editing.item) await updateCategory(editing.item.id, input);
        else await createCategory(input);
      } else {
        const input = { name, slug };
        if (editing.item) await updateTag(editing.item.id, input);
        else await createTag(input);
      }
    },
    onSuccess: () => {
      toast.success("Guardado.");
      setEditing(null);
      refresh();
    },
    onError: (error) => toast.error(friendly(error)),
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!removing?.item) return;
      if (removing.kind === "category") await deleteCategory(removing.item.id);
      else await deleteTag(removing.item.id);
    },
    onSuccess: () => {
      toast.success("Borrado.");
      refresh();
    },
    onError: (error) => toast.error(friendly(error)),
    onSettled: () => setRemoving(null),
  });

  if (profile?.role !== "admin") {
    return <p className="py-16 text-center text-lg">Esta pantalla es solo para administradores.</p>;
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate();
  };

  const row = (label: string, onEdit: () => void, onRemove: () => void, dot?: string | null) => (
    <li key={label} className="flex items-center gap-3 border-t py-2.5 first:border-t-0">
      {dot !== undefined && (
        <span
          aria-hidden
          className="size-3 shrink-0 rounded-full bg-muted"
          style={dot ? { background: dot } : undefined}
        />
      )}
      <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
      <Button variant="ghost" size="sm" aria-label={`Editar ${label}`} onClick={onEdit}>
        Editar
      </Button>
      <Button variant="ghost" size="sm" aria-label={`Borrar ${label}`} onClick={onRemove}>
        Borrar
      </Button>
    </li>
  );

  return (
    <>
      <h1 className="mb-5 flex min-h-10 items-center text-2xl font-semibold">
        Categorías y etiquetas
      </h1>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border bg-card p-5">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Categorías</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => open({ kind: "category", item: null })}
            >
              Nueva categoría
            </Button>
          </div>
          {categories.isError ? (
            <LoadError what="las categorías" onRetry={() => void categories.refetch()} />
          ) : categories.isPending ? (
            <Skeleton className="h-64" />
          ) : (
            <ul>
              {categories.data.map((item) =>
                row(
                  item.name,
                  () => open({ kind: "category", item }),
                  () => setRemoving({ kind: "category", item }),
                  item.color,
                ),
              )}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border bg-card p-5">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Etiquetas</h2>
            <Button variant="outline" size="sm" onClick={() => open({ kind: "tag", item: null })}>
              Nueva etiqueta
            </Button>
          </div>
          {tags.isError ? (
            <LoadError what="las etiquetas" onRetry={() => void tags.refetch()} />
          ) : tags.isPending ? (
            <Skeleton className="h-64" />
          ) : tags.data.length === 0 ? (
            <p className="text-muted-foreground">Todavía no hay etiquetas.</p>
          ) : (
            <ul>
              {tags.data.map((item) =>
                row(
                  item.name,
                  () => open({ kind: "tag", item }),
                  () => setRemoving({ kind: "tag", item }),
                ),
              )}
            </ul>
          )}
        </section>
      </div>

      <Dialog open={editing !== null} onOpenChange={(value) => !value && setEditing(null)}>
        <DialogContent>
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>
                {editing?.item ? "Editar" : "Nueva"}{" "}
                {editing?.kind === "category" ? "categoría" : "etiqueta"}
              </DialogTitle>
              <DialogDescription>
                La dirección se genera sola a partir del nombre si la dejás vacía.
              </DialogDescription>
            </DialogHeader>
            <label className="block font-medium">
              Nombre
              <Input
                autoFocus
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-1.5"
              />
            </label>
            <label className="block font-medium">
              Dirección
              <Input
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                className="mt-1.5"
              />
            </label>
            {editing?.kind === "category" && (
              <div className="flex gap-4">
                <label className="block font-medium">
                  Color
                  <input
                    type="color"
                    value={color}
                    onChange={(event) => setColor(event.target.value)}
                    className="mt-1.5 block h-10 w-20 rounded-lg border border-input bg-card p-1"
                  />
                </label>
                <label className="block font-medium">
                  Orden
                  <Input
                    type="number"
                    value={order}
                    onChange={(event) => setOrder(event.target.value)}
                    className="mt-1.5 w-24"
                  />
                </label>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={save.isPending}>
                Guardar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={removing !== null} onOpenChange={(value) => !value && setRemoving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Borrar “{removing?.item?.name}”?</DialogTitle>
            <DialogDescription>
              {removing?.kind === "category"
                ? "Las notas de esta categoría se conservan y quedan sin sección."
                : "Las notas se conservan y dejan de tener esta etiqueta."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoving(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => remove.mutate()}
            >
              Borrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
