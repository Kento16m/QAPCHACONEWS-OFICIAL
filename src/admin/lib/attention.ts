export type AttentionInput = {
  homepage_open_slots: number | null;
  stale_breaking: number;
  stale_drafts: number;
  scheduled_24h: number;
  comments_24h: number;
};

export type AttentionItem = {
  id: "homepage" | "breaking" | "drafts" | "scheduled" | "comments";
  count: number;
  title: string;
  detail: string;
  action: string;
  to: string;
  tone: "warning" | "info";
};

const pick = (count: number, one: string, many: string) => (count === 1 ? one : many);

export const attentionItems = (stats: AttentionInput): AttentionItem[] => {
  const {
    homepage_open_slots: open,
    stale_breaking,
    stale_drafts,
    scheduled_24h,
    comments_24h,
  } = stats;

  const all: AttentionItem[] = [
    {
      id: "homepage",
      count: open ?? 0,
      title: pick(open ?? 0, "Lugar libre en portada", "Lugares libres en portada"),
      detail: "Se rellenan solos con lo más reciente",
      action: "Elegir",
      to: "/portada",
      tone: "warning",
    },
    {
      id: "breaking",
      count: stale_breaking,
      title: pick(stale_breaking, "Última hora vencida", "Últimas horas vencidas"),
      detail: "Publicadas hace más de 24 horas",
      action: "Revisar",
      to: "/portada",
      tone: "warning",
    },
    {
      id: "drafts",
      count: stale_drafts,
      title: pick(stale_drafts, "Borrador sin tocar", "Borradores sin tocar"),
      detail: "Sin cambios hace más de 7 días",
      action: "Ver",
      to: "/articulos",
      tone: "warning",
    },
    {
      id: "scheduled",
      count: scheduled_24h,
      title: pick(scheduled_24h, "Nota programada", "Notas programadas"),
      detail: "Salen en las próximas 24 horas",
      action: "Ver",
      to: "/calendario",
      tone: "info",
    },
    {
      id: "comments",
      count: comments_24h,
      title: pick(comments_24h, "Comentario nuevo", "Comentarios nuevos"),
      detail: "En las últimas 24 horas",
      action: "Ver",
      to: "/comentarios",
      tone: "info",
    },
  ];

  return all.filter((item) => item.count > 0);
};
