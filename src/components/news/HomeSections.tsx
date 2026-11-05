import { Link } from "@tanstack/react-router";
import { ArrowRight, Mail } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { parseEmail } from "@/lib/email";
import { Button } from "@/components/ui/button";
import {
  useArticlesByCategory,
  useCategories,
  useHomepage,
  useMostRead,
  useSubscribe,
} from "@/hooks/use-news";
import { trackCategoryView, trackNewsletterSignup } from "@/lib/analytics";
import type { Category } from "@/types";
import { ArticleCard } from "./ArticleCard";
import {
  CardSkeleton,
  CategoryBadge,
  CoverImage,
  SectionTitle,
  StateMessage,
  timeAgo,
} from "./primitives";

export function MiniStrip() {
  const { data: home, isLoading, isError } = useHomepage();
  const data = home?.strip;
  if (isError) return <StateMessage error>No pudimos cargar las noticias.</StateMessage>;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {isLoading
        ? Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} className="h-[88px]" />)
        : data?.map((a) => <ArticleCard key={a.id} article={a} variant="mini" />)}
    </div>
  );
}

export function HeroArticle() {
  const { data: home, isLoading, isError } = useHomepage();
  const a = home?.hero;
  if (isLoading) return <CardSkeleton className="h-[460px] lg:h-[520px]" />;
  if (isError || !a) return <StateMessage error={isError}>No hay una nota destacada.</StateMessage>;
  return (
    <article className="img-zoom relative h-[460px] overflow-hidden rounded-3xl bg-navy lg:h-[520px]">
      <CoverImage src={a.cover_image_url} alt={a.title} className="absolute inset-0" priority />
      <div className="bg-scrim-strong absolute inset-0" />
      <div className="absolute left-6 top-6 z-10">
        <CategoryBadge category={a.category} className="shadow-soft" />
      </div>
      <div className="text-shadow-hero absolute inset-x-0 bottom-0 p-6 text-navy-foreground sm:p-10">
        <p className="inline-flex rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-primary-foreground">
          Destacado
        </p>
        <h1 className="mt-2 max-w-2xl font-display text-3xl font-bold leading-tight text-balance sm:text-4xl lg:text-[2.75rem]">
          {a.title}
        </h1>
        {a.subtitle && (
          <p className="mt-4 max-w-xl text-sm text-navy-foreground/85 sm:text-base">{a.subtitle}</p>
        )}
        <Button asChild size="lg" className="mt-6 rounded-full">
          <Link to="/noticia/$slug" params={{ slug: a.slug }}>
            Leer nota completa <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </article>
  );
}

export function LatestPanel() {
  const { data: home, isLoading, isError } = useHomepage();
  const data = home?.latest;
  return (
    <aside className="flex flex-col rounded-3xl bg-navy p-6 text-navy-foreground">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-extrabold">Lo más reciente</h2>
        <span className="flex items-center gap-1.5 text-xs text-navy-muted">
          <span className="h-2 w-2 animate-pulse rounded-full bg-primary" /> En vivo
        </span>
      </div>
      {isError ? (
        <p className="text-sm text-navy-muted">Error al cargar.</p>
      ) : (
        <ol className="flex flex-1 flex-col divide-y divide-navy-border">
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => (
                <li key={i} className="py-3">
                  <div className="h-10 animate-pulse rounded-lg bg-navy-border" />
                </li>
              ))
            : data?.map((a) => {
                const meta = a.category?.name
                  ? `${a.category.name} · ${timeAgo(a.published_at)}`
                  : timeAgo(a.published_at);
                return (
                  <li key={a.id} className="group relative py-3.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                      <span className="text-navy-muted">{meta}</span>
                    </p>
                    <Link
                      to="/noticia/$slug"
                      params={{ slug: a.slug }}
                      className="mt-1 line-clamp-2 text-sm font-semibold leading-snug group-hover:text-primary after:absolute after:inset-0"
                    >
                      {a.title}
                    </Link>
                  </li>
                );
              })}
        </ol>
      )}
    </aside>
  );
}

export function BentoGrid() {
  const { data: home, isLoading, isError } = useHomepage();
  const items = home?.featured;
  if (isError) return <StateMessage error>No pudimos cargar esta sección.</StateMessage>;
  if (isLoading)
    return (
      <div className="grid gap-4 md:grid-cols-3 md:grid-rows-2">
        <CardSkeleton className="h-[420px] md:row-span-2" />
        {Array.from({ length: 4 }).map((_, i) => (
          <CardSkeleton key={i} className="h-[200px]" />
        ))}
      </div>
    );
  if (!items?.length) return <StateMessage>No hay noticias.</StateMessage>;
  const big = items[0]!;
  const rest = items.slice(1);
  return (
    <div className="grid auto-rows-[200px] gap-4 md:grid-cols-3">
      <ArticleCard
        article={big}
        variant="overlay"
        className="row-span-2 [&_h3]:font-display [&_h3]:text-2xl"
      />
      {rest.map((a) => (
        <ArticleCard key={a.id} article={a} variant="overlay" />
      ))}
    </div>
  );
}

export function MostRead() {
  const { data, isLoading, isError } = useMostRead(5);
  return (
    <aside className="rounded-3xl bg-card p-6 shadow-soft">
      <h2 className="mb-2 text-lg font-extrabold">Más leídas</h2>
      {isError ? (
        <StateMessage error>Error al cargar.</StateMessage>
      ) : (
        <ol className="divide-y">
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => (
                <li key={i} className="py-3">
                  <CardSkeleton className="h-14" />
                </li>
              ))
            : data?.map((a, i) => (
                <li key={a.id} className="group relative flex items-center gap-4 py-3.5">
                  <span className="w-6 shrink-0 font-display text-3xl font-bold text-primary">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link
                      to="/noticia/$slug"
                      params={{ slug: a.slug }}
                      className="line-clamp-2 text-sm font-semibold leading-snug group-hover:text-primary after:absolute after:inset-0"
                    >
                      {a.title}
                    </Link>
                    <p className="mt-1 text-xs text-muted-foreground">{timeAgo(a.published_at)}</p>
                  </div>
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl">
                    <CoverImage src={a.cover_image_url} alt="" />
                  </div>
                </li>
              ))}
        </ol>
      )}
    </aside>
  );
}

function CategoryBlock({ category }: { category: Category }) {
  const { data, isLoading, isError } = useArticlesByCategory(category.slug, 1, 3);
  return (
    <section className="reveal">
      <SectionTitle
        action={
          <Link
            to="/categoria/$slug"
            params={{ slug: category.slug }}
            onClick={() => trackCategoryView(category.name, "homepage_section")}
            className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
          >
            Ver todo <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        }
      >
        {category.name}
      </SectionTitle>
      {isError ? (
        <StateMessage error>Error al cargar.</StateMessage>
      ) : isLoading ? (
        <div className="space-y-4">
          <CardSkeleton className="h-56" />
          <CardSkeleton className="h-20" />
        </div>
      ) : !data?.items.length ? (
        <StateMessage>Pronto habrá noticias en {category.name}.</StateMessage>
      ) : (
        <div className="space-y-4">
          {data.items[0] && <ArticleCard article={data.items[0]} />}
          {data.items.slice(1).map((a) => (
            <ArticleCard key={a.id} article={a} variant="compact" />
          ))}
        </div>
      )}
    </section>
  );
}

export function CategoryBlocks() {
  const { data, isLoading } = useCategories();
  if (isLoading)
    return (
      <div className="grid gap-8 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <CardSkeleton key={i} className="h-80" />
        ))}
      </div>
    );
  return (
    <div className="grid gap-x-8 gap-y-14 md:grid-cols-2 lg:grid-cols-3">
      {data?.map((c) => (
        <CategoryBlock key={c.id} category={c} />
      ))}
    </div>
  );
}

export function Newsletter() {
  const [email, setEmail] = useState("");
  const sub = useSubscribe();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = parseEmail(email);
    if (!parsed) {
      toast.error("Ingresá un correo electrónico válido.");
      return;
    }
    sub.mutate(parsed, {
      onSuccess: () => {
        trackNewsletterSignup("homepage");
        toast.success("¡Listo! Te suscribiste a QAP ChacoNews.");
        setEmail("");
      },
      onError: () => toast.error("No pudimos suscribirte. Intentá de nuevo."),
    });
  };
  return (
    <section className="reveal relative overflow-hidden rounded-3xl bg-navy p-8 text-navy-foreground sm:p-12">
      <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary opacity-30 blur-3xl" />
      <div className="relative grid items-center gap-8 md:grid-cols-2">
        <div className="flex items-start gap-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary">
            <Mail className="h-6 w-6" />
          </span>
          <div>
            <h2 className="font-display text-3xl font-bold">Mantente informado</h2>
            <p className="mt-2 text-sm text-navy-muted">
              Recibí cada mañana las noticias más importantes del Chaco y de todo Paraguay.
            </p>
          </div>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row" noValidate>
          <label className="flex-1">
            <span className="sr-only">Correo electrónico</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              className="h-12 w-full rounded-full bg-card px-5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
          <Button
            type="submit"
            size="lg"
            className="h-12 rounded-full px-8"
            disabled={sub.isPending}
          >
            {sub.isPending ? "Enviando…" : "Suscribirme"}
          </Button>
        </form>
      </div>
    </section>
  );
}
