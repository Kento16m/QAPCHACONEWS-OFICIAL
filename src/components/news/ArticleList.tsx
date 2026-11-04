import type { ReactNode } from "react";
import type { Article } from "@/types";
import { ArticleCard } from "./ArticleCard";
import { CardSkeleton, StateMessage } from "./primitives";

export function ArticleListPage({
  title,
  eyebrow,
  items,
  isLoading,
  isError,
  empty,
}: {
  title: ReactNode;
  eyebrow?: string | undefined;
  items?: Article[] | undefined;
  isLoading: boolean;
  isError: boolean;
  empty: string;
}) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      {eyebrow && (
        <p className="text-xs font-bold uppercase tracking-widest text-primary">{eyebrow}</p>
      )}
      <h1 className="mt-1 font-display text-4xl font-bold">{title}</h1>
      <div className="mt-8">
        {isError ? (
          <StateMessage error>Ocurrió un error al cargar.</StateMessage>
        ) : isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <CardSkeleton key={i} className="h-80" />
            ))}
          </div>
        ) : !items?.length ? (
          <StateMessage>{empty}</StateMessage>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((a) => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
