import { createFileRoute } from "@tanstack/react-router";
import { ArticleListPage } from "@/components/news/ArticleList";
import { useArticlesByTag } from "@/hooks/use-news";
import { pageHead } from "@/lib/page-head";

export const Route = createFileRoute("/etiqueta/$slug")({
  head: ({ params }) =>
    pageHead(
      `/etiqueta/${encodeURIComponent(params.slug)}`,
      `#${params.slug}`,
      `Noticias etiquetadas con ${params.slug}.`,
    ),
  component: TagPage,
});

function TagPage() {
  const { slug } = Route.useParams();
  const q = useArticlesByTag(slug);
  return (
    <ArticleListPage
      eyebrow="Etiqueta"
      title={`#${slug}`}
      items={q.data?.items}
      isLoading={q.isLoading}
      isError={q.isError}
      empty="No hay noticias con esta etiqueta."
    />
  );
}
