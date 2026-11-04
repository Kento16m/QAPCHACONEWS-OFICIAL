import { createFileRoute } from "@tanstack/react-router";
import { ArticleListPage } from "@/components/news/ArticleList";
import { useArticlesByCategory, useCategories } from "@/hooks/use-news";

export const Route = createFileRoute("/categoria/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug} — QAP ChacoNews` },
      { name: "description", content: `Noticias de la sección ${params.slug} en QAP ChacoNews.` },
      { property: "og:title", content: `${params.slug} — QAP ChacoNews` },
      { property: "og:description", content: `Noticias de la sección ${params.slug}.` },
    ],
  }),
  component: CategoryPage,
});

function CategoryPage() {
  const { slug } = Route.useParams();
  const { data: cats } = useCategories();
  const q = useArticlesByCategory(slug, 1, 12);
  const name = cats?.find((c) => c.slug === slug)?.name ?? slug;
  return (
    <ArticleListPage
      eyebrow="Sección"
      title={name}
      items={q.data?.items}
      isLoading={q.isLoading}
      isError={q.isError}
      empty="No hay noticias en esta sección."
    />
  );
}
