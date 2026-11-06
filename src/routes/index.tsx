import { createFileRoute } from "@tanstack/react-router";
import { ArticleCard } from "@/components/news/ArticleCard";
import {
  BentoGrid,
  CategoryBlocks,
  HeroArticle,
  LatestPanel,
  MiniStrip,
  MostRead,
  Newsletter,
} from "@/components/news/HomeSections";
import { CardSkeleton, SectionTitle, StateMessage } from "@/components/news/primitives";
import { useSearchContext } from "@/contexts/SearchContext";
import { useSearch } from "@/hooks/use-news";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "QAP ChacoNews — Noticias del Chaco paraguayo" },
      {
        name: "description",
        content:
          "Últimas noticias de Filadelfia, Loma Plata, Mariscal Estigarribia, el Chaco y todo Paraguay.",
      },
      { property: "og:title", content: "QAP ChacoNews — Noticias del Chaco paraguayo" },
      {
        property: "og:description",
        content: "Últimas noticias del Chaco y de todo Paraguay, las 24 horas.",
      },
    ],
    links: [{ rel: "canonical", href: "https://qapchaconews.com/" }],
  }),
  component: Index,
});

function Index() {
  const { searchTerm } = useSearchContext();
  const normalized = searchTerm.trim();
  const { data, isLoading, isError } = useSearch(normalized, 1);

  if (normalized) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <SectionTitle>Resultados para “{normalized}”</SectionTitle>
        <div className="mt-8">
          {isLoading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <CardSkeleton key={index} className="h-80" />
              ))}
            </div>
          ) : isError ? (
            <StateMessage error>Ocurrió un error al buscar noticias.</StateMessage>
          ) : !data?.items.length ? (
            <StateMessage>{`No se encontraron noticias que coinciden con '${normalized}'`}</StateMessage>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {data.items.map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-14 px-4 py-6 sm:px-6">
      <MiniStrip />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <HeroArticle />
        <LatestPanel />
      </div>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)]">
        <section className="reveal">
          <SectionTitle>No te pierdas</SectionTitle>
          <BentoGrid />
        </section>
        <div className="lg:pt-14">
          <MostRead />
        </div>
      </div>
      <CategoryBlocks />
      <Newsletter />
    </div>
  );
}
