import { createFileRoute } from "@tanstack/react-router";
import { ArticleListPage } from "@/components/news/ArticleList";
import { useSearch } from "@/hooks/use-news";

export const Route = createFileRoute("/buscar")({
  validateSearch: (s: Record<string, unknown>) => ({
    q: typeof s["q"] === "string" ? s["q"].slice(0, 100) : "",
  }),
  head: () => ({
    meta: [
      { title: "Buscar — QAP ChacoNews" },
      { name: "description", content: "Buscá noticias en QAP ChacoNews." },
      { property: "og:title", content: "Buscar — QAP ChacoNews" },
      { property: "og:description", content: "Buscá noticias del Chaco y Paraguay." },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const { q } = Route.useSearch();
  const r = useSearch(q);
  return (
    <ArticleListPage
      eyebrow="Búsqueda"
      title={q ? `“${q}”` : "Buscar noticias"}
      items={r.data?.items}
      isLoading={r.isLoading}
      isError={r.isError}
      empty={q ? "No encontramos resultados." : "Escribí un término en el buscador."}
    />
  );
}
