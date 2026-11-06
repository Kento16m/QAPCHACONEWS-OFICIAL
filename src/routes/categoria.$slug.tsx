import { createFileRoute } from "@tanstack/react-router";
import { ArticleListPage } from "@/components/news/ArticleList";
import { useArticlesByCategory, useCategories } from "@/hooks/use-news";
import { getCategories } from "@/lib/api";
import { pageHead } from "@/lib/page-head";

export const Route = createFileRoute("/categoria/$slug")({
  // The title shows the section's real name: slugs lose accents and capitals.
  loader: async ({ context, params }) => {
    const categories = await context.queryClient
      .fetchQuery({ queryKey: ["categories"], queryFn: getCategories, staleTime: 60_000 })
      .catch(() => []);
    return categories.find((c) => c.slug === params.slug)?.name ?? params.slug;
  },
  head: ({ params, loaderData: name = params.slug }) =>
    pageHead(
      `/categoria/${encodeURIComponent(params.slug)}`,
      name,
      `Noticias de la sección ${name} en QAP ChacoNews.`,
    ),
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
