import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { NoteEditor } from "../features/editor/NoteEditor";
import { fetchArticle } from "../lib/save-article";
import { Skeleton } from "../ui/Field";

export const Route = createFileRoute("/articulos/$id")({ component: NotePage });

function NotePage() {
  const { id } = Route.useParams();
  const isNew = id === "nueva";
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["admin", "article", id],
    queryFn: () => fetchArticle(id),
    enabled: !isNew,
    refetchOnMount: true,
    staleTime: 0,
    // A note always opens as it is saved now, and an open note is not refreshed behind the writer.
    gcTime: 0,
    refetchOnReconnect: false,
  });

  if (isNew) return <NoteEditor key="nueva" article={null} />;

  if (isError && !data) {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border p-5">
        <p>No pudimos abrir la nota. Revisá tu conexión.</p>
        <Button variant="outline" size="sm" onClick={() => void refetch()}>
          Reintentar
        </Button>
      </div>
    );
  }

  if (isPending && !data) {
    return (
      <div className="grid gap-4 lg:grid-cols-12">
        <Skeleton className="h-[34rem] lg:col-span-8" />
        <Skeleton className="h-[34rem] lg:col-span-4" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-2xl font-semibold">Esta nota ya no existe</h1>
        <Link
          to="/articulos"
          search={{ page: 1 }}
          className="mt-3 inline-block text-link underline"
        >
          Volver a Artículos
        </Link>
      </div>
    );
  }

  return <NoteEditor key={id} article={data} />;
}
