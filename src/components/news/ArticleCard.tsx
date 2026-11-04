import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import type { Article } from "@/types";
import { CategoryBadge, CoverImage, timeAgo } from "./primitives";

type Variant = "default" | "overlay" | "compact" | "mini";

export function ArticleCard({
  article,
  variant = "default",
  className,
}: {
  article: Article;
  variant?: Variant;
  className?: string;
}) {
  const link = (
    <Link
      to="/noticia/$slug"
      params={{ slug: article.slug }}
      className="after:absolute after:inset-0 focus-visible:outline-none"
    >
      {article.title}
    </Link>
  );

  if (variant === "overlay") {
    return (
      <article
        className={cn(
          "img-zoom card-lift group relative overflow-hidden rounded-2xl bg-navy shadow-soft",
          className,
        )}
      >
        <CoverImage
          src={article.cover_image_url}
          alt={article.title}
          className="absolute inset-0"
        />
        <div className="bg-scrim absolute inset-0" />
        <div className="absolute left-4 top-4">
          <CategoryBadge category={article.category} />
        </div>
        <div className="absolute inset-x-0 bottom-0 p-5 text-navy-foreground">
          <h3 className="font-bold leading-snug text-balance">{link}</h3>
          <p className="mt-2 text-xs text-navy-muted">{timeAgo(article.published_at)}</p>
        </div>
      </article>
    );
  }

  if (variant === "mini") {
    const meta = article.category?.name
      ? `${article.category.name} · ${timeAgo(article.published_at)}`
      : timeAgo(article.published_at);

    return (
      <article
        className={cn(
          "card-lift img-zoom relative flex items-center gap-3 rounded-2xl bg-card p-3 shadow-soft",
          className,
        )}
      >
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl">
          <CoverImage src={article.cover_image_url} alt="" />
        </div>
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-sm font-bold leading-snug">{link}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{meta}</p>
        </div>
      </article>
    );
  }

  if (variant === "compact") {
    return (
      <article className={cn("group relative flex gap-4", className)}>
        <div className="img-zoom h-20 w-28 shrink-0 overflow-hidden rounded-xl">
          <CoverImage src={article.cover_image_url} alt="" />
        </div>
        <div className="min-w-0">
          <h3 className="line-clamp-3 text-sm font-bold leading-snug group-hover:text-primary">
            {link}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">{timeAgo(article.published_at)}</p>
        </div>
      </article>
    );
  }

  return (
    <article
      className={cn(
        "card-lift img-zoom group relative overflow-hidden rounded-2xl bg-card shadow-soft",
        className,
      )}
    >
      <div className="relative aspect-[16/10] overflow-hidden">
        <CoverImage src={article.cover_image_url} alt={article.title} />
        <div className="absolute left-3 top-3">
          <CategoryBadge category={article.category} />
        </div>
      </div>
      <div className="p-4 md:p-5">
        <h3 className="font-bold leading-snug text-balance group-hover:text-primary">{link}</h3>
        {article.excerpt && (
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{article.excerpt}</p>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          {timeAgo(article.published_at)}
          {article.reading_time_minutes ? ` · ${article.reading_time_minutes} min de lectura` : ""}
        </p>
      </div>
    </article>
  );
}
