import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, ImageOff, Search, SlidersHorizontal } from "lucide-react";
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
import { cn } from "@/lib/utils";
import type { ArticleStatus } from "@/lib/admin";
import { useDebouncedValue } from "@/hooks/use-news";
import {
  deleteArticles,
  listArticles,
  PAGE_SIZE,
  setArticlesStatus,
  useAuthors,
  useCategories,
  type ArticleRow,
} from "../lib/articles";
import { useSession } from "../lib/session";
import { Card, SearchField, Select, Skeleton, StatusBadge, STATUS_OPTIONS } from "../ui/Field";

type Search = {
  page: number;
  q?: string | undefined;
  status?: ArticleStatus | undefined;
  category?: string | undefined;
  author?: string | undefined;
};

const STATUSES = ["draft", "scheduled", "published", "archived"];

export const Route = createFileRoute("/articulos/")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    page: Math.max(1, Number(search["page"]) || 1),
    q: typeof search["q"] === "string" && search["q"] ? search["q"] : undefined,
    status: STATUSES.includes(String(search["status"]))
      ? (search["status"] as ArticleStatus)
      : undefined,
    category: typeof search["category"] === "string" ? search["category"] : undefined,
    author: typeof search["author"] === "string" ? search["author"] : undefined,
  }),
  component: ArticlesPage,
});

const dateFormat = new Intl.DateTimeFormat("es-PY", {
  timeZone: "America/Asuncion",
  day: "numeric",
  month: "short",
  year: "numeric",
});

const rowDate = (row: ArticleRow) => {
  const iso = row.status === "scheduled" ? row.scheduled_at : (row.published_at ?? row.updated_at);
  return iso ? dateFormat.format(new Date(iso)) : "—";
};

type BulkAction = "published" | "archived" | "draft" | "delete";

const BULK_DONE: Record<BulkAction, string> = {
  published: "Notas publicadas.",
  archived: "Notas archivadas.",
  draft: "Notas pasadas a borrador.",
  delete: "Notas borradas.",
};

function ArticlesPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const queryClient = useQueryClient();
  const { profile } = useSession();
  const isAdmin = profile?.role === "admin";

  const [term, setTerm] = useState(search.q ?? "");
  const debounced = useDebouncedValue(term, 350);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const update = (changes: Partial<Search>) =>
    void navigate({ search: (previous) => ({ ...previous, page: 1, ...changes }) });

  useEffect(() => {
    if (debounced !== (search.q ?? "")) update({ q: debounced || undefined });
    // Only a new typed term starts a search.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const { data: categories } = useCategories();
  const { data: authors } = useAuthors();
  const { data, isPending, isError, refetch, isPlaceholderData } = useQuery({
    queryKey: ["admin", "articles", search],
    queryFn: () =>
      listArticles({
        page: search.page,
        q: search.q,
        status: search.status,
        categoryId: search.category,
        authorId: search.author,
      }),
    placeholderData: keepPreviousData,
  });

  const rows = data?.rows ?? [];
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));
  const filtered = Boolean(search.q || search.status || search.category || search.author);

  const bulk = useMutation({
    mutationFn: async (action: BulkAction) => {
      const ids = [...selected];
      if (action === "delete") await deleteArticles(ids);
      else await setArticlesStatus(ids, action);
    },
    onSuccess: (_result, action) => toast.success(BULK_DONE[action]),
    onError: (error) => toast.error(error.message),
    onSettled: async () => {
      setSelected(new Set());
      setConfirmDelete(false);
      await queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
  });

  const allOnPage = rows.length > 0 && rows.every((row) => selected.has(row.id));
  const toggleAll = () => setSelected(allOnPage ? new Set() : new Set(rows.map((row) => row.id)));
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const activeFilters = [search.status, search.category, search.author].filter(Boolean).length;

  return (
    <>
      <header className="mb-5 flex min-h-10 flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Artículos</h1>
        {data && (
          <p className="text-muted-foreground">
            {data.total} {data.total === 1 ? "nota" : "notas"}
          </p>
        )}
      </header>

      <Card className="p-0">
        <div className="flex flex-wrap items-center gap-3 border-b p-4">
          <SearchField
            aria-label="Buscar notas"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Buscar por título o resumen"
            className="min-w-56 flex-1"
          />
          <Button
            variant="outline"
            className="h-10 rounded-lg sm:hidden"
            aria-expanded={showFilters}
            onClick={() => setShowFilters(!showFilters)}
          >
            <SlidersHorizontal className="size-4" aria-hidden />
            Filtros
            {activeFilters > 0 && ` (${activeFilters})`}
          </Button>
          <div
            className={cn(
              showFilters ? "grid" : "hidden",
              "w-full gap-3 sm:flex sm:w-auto sm:flex-wrap",
            )}
          >
            <Select
              aria-label="Filtrar por estado"
              value={search.status ?? ""}
              onChange={(event) =>
                update({ status: (event.target.value || undefined) as ArticleStatus | undefined })
              }
            >
              <option value="">Todos los estados</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Filtrar por sección"
              value={search.category ?? ""}
              onChange={(event) => update({ category: event.target.value || undefined })}
            >
              <option value="">Todas las secciones</option>
              {categories?.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Filtrar por autor"
              value={search.author ?? ""}
              onChange={(event) => update({ author: event.target.value || undefined })}
            >
              <option value="">Todos los autores</option>
              {authors?.map((author) => (
                <option key={author.id} value={author.id}>
                  {author.full_name ?? "Sin nombre"}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {selected.size > 0 && (
          <div
            role="toolbar"
            aria-label="Acciones sobre las notas elegidas"
            className="flex flex-wrap items-center gap-2 border-b bg-accent px-4 py-2.5"
          >
            <span className="mr-2 font-medium text-accent-foreground">
              {selected.size} {selected.size === 1 ? "elegida" : "elegidas"}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={bulk.isPending}
              onClick={() => bulk.mutate("published")}
            >
              Publicar
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={bulk.isPending}
              onClick={() => bulk.mutate("draft")}
            >
              Pasar a borrador
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={bulk.isPending}
              onClick={() => bulk.mutate("archived")}
            >
              Archivar
            </Button>
            {isAdmin && (
              <Button
                size="sm"
                variant="destructive"
                disabled={bulk.isPending}
                onClick={() => setConfirmDelete(true)}
              >
                Borrar
              </Button>
            )}
          </div>
        )}

        {isError ? (
          <div role="alert" className="flex flex-wrap items-center gap-3 p-5">
            <p>No pudimos cargar las notas. Revisá tu conexión.</p>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              Reintentar
            </Button>
          </div>
        ) : isPending ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-11" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-lg font-medium">
              {filtered ? "Ninguna nota coincide con esos filtros" : "Todavía no hay notas"}
            </p>
            <p className="mt-1 text-muted-foreground">
              {filtered
                ? "Probá con otra palabra o quitá algún filtro."
                : "Empezá escribiendo la primera."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table
              className={`w-full text-left transition-opacity duration-150 ${isPlaceholderData ? "opacity-60" : ""}`}
            >
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th scope="col" className="w-11 py-3 pl-4 font-normal">
                    <input
                      type="checkbox"
                      aria-label="Elegir todas las notas de esta página"
                      checked={allOnPage}
                      onChange={toggleAll}
                      className="size-4 accent-primary"
                    />
                  </th>
                  <th scope="col" className="py-3 pr-4 font-normal">
                    Nota
                  </th>
                  <th scope="col" className="hidden py-3 pr-4 font-normal md:table-cell">
                    Sección
                  </th>
                  <th scope="col" className="hidden py-3 pr-4 font-normal xl:table-cell">
                    Autor
                  </th>
                  <th scope="col" className="py-3 pr-4 font-normal">
                    Estado
                  </th>
                  <th scope="col" className="hidden py-3 pr-4 font-normal lg:table-cell">
                    Fecha
                  </th>
                  <th scope="col" className="hidden py-3 pr-4 text-right font-normal sm:table-cell">
                    Lecturas
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b transition-colors duration-150 last:border-b-0 hover:bg-muted/50"
                  >
                    <td className="py-2.5 pl-4">
                      <input
                        type="checkbox"
                        aria-label={`Elegir ${row.title}`}
                        checked={selected.has(row.id)}
                        onChange={() => toggle(row.id)}
                        className="size-4 accent-primary"
                      />
                    </td>
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-3">
                        {row.cover_image_url ? (
                          <img
                            src={row.cover_image_url}
                            alt=""
                            loading="lazy"
                            className="h-11 w-16 shrink-0 rounded-md bg-muted object-cover"
                          />
                        ) : (
                          <span className="flex h-11 w-16 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                            <ImageOff className="size-4" aria-hidden />
                          </span>
                        )}
                        <Link
                          to="/articulos/$id"
                          params={{ id: row.id }}
                          className="font-medium hover:text-link hover:underline"
                        >
                          {row.title}
                        </Link>
                      </div>
                    </td>
                    <td className="hidden py-2.5 pr-4 text-muted-foreground md:table-cell">
                      {row.category?.name ?? "Sin sección"}
                    </td>
                    <td className="hidden py-2.5 pr-4 text-muted-foreground xl:table-cell">
                      {row.author?.full_name ?? "Redacción"}
                    </td>
                    <td className="py-2.5 pr-4">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="hidden whitespace-nowrap py-2.5 pr-4 text-muted-foreground lg:table-cell">
                      {rowDate(row)}
                    </td>
                    <td className="hidden py-2.5 pr-4 text-right font-medium sm:table-cell">
                      {row.views_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <nav
            aria-label="Páginas"
            className="flex items-center justify-between gap-3 border-t px-4 py-3"
          >
            <p className="text-muted-foreground">
              Página {search.page} de {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={search.page <= 1}
                onClick={() => update({ page: search.page - 1 })}
              >
                <ChevronLeft className="size-4" aria-hidden />
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={search.page >= totalPages}
                onClick={() => update({ page: search.page + 1 })}
              >
                Siguiente
                <ChevronRight className="size-4" aria-hidden />
              </Button>
            </div>
          </nav>
        )}
      </Card>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Borrar {selected.size} {selected.size === 1 ? "nota" : "notas"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Desaparecen del sitio de inmediato. Si solo querés sacarlas de circulación, mejor
              archivalas: eso se revierte con un clic.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => bulk.mutate("delete")}
            >
              Borrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
