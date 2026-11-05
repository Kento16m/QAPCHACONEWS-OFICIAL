import type { Article } from "@/types";

const FIRST_FEATURED = 2;
const LAST_FEATURED = 6;
const STRIP_SIZE = 4;
const LATEST_SIZE = 5;

// The lists by date, plus every note that could be chosen and leave them short.
export const LATEST_NEEDED = 16;

export type HomepageSlot = { position: number; article: Article | null };

export type Homepage = {
  hero: Article | null;
  featured: Article[];
  strip: Article[];
  latest: Article[];
};

/** An empty place, or one whose note is no longer public, takes the next note by date. */
export const composeHomepage = (
  slots: HomepageSlot[],
  featuredFallback: Article | null,
  latest: Article[],
): Homepage => {
  const chosen = new Map(
    slots.filter((slot) => slot.article).map((slot) => [slot.position, slot.article as Article]),
  );
  const chosenIds = new Set([...chosen.values()].map((article) => article.id));
  const byDate = latest.filter((article) => !chosenIds.has(article.id));

  const spare = byDate.slice(LATEST_SIZE);
  const featured: Article[] = [];
  for (let position = FIRST_FEATURED; position <= LAST_FEATURED; position++) {
    const article = chosen.get(position) ?? spare.shift();
    if (article) featured.push(article);
  }

  return {
    hero: chosen.get(1) ?? featuredFallback ?? latest[0] ?? null,
    featured,
    strip: byDate.slice(0, STRIP_SIZE),
    latest: byDate.slice(0, LATEST_SIZE),
  };
};
