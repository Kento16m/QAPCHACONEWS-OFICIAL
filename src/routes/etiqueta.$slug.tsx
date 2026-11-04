import { createFileRoute } from "@tanstack/react-router";
import { ArticleListPage } from "@/components/news/ArticleList";
import { useArticlesByTag } from "@/hooks/use-news";

export const Route = createFileRoute("/etiqueta/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `#${params.slug} — QAP ChacoNews` },
      { name: "description", content: `Noticias etiquetadas con ${params.slug}.` },
      { property: "og:title", content: `#${params.slug} — QAP ChacoNews` },
      { property: "og:description", content: `Noticias etiquetadas con ${params.slug}.` },
    ],
  }),
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
