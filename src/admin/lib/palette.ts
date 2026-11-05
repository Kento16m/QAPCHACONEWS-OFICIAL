import { navFor } from "./nav";

export type PaletteItem = {
  id: string;
  kind: "action" | "note" | "user";
  label: string;
  detail?: string | undefined;
  to: string;
};

const plain = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

export const paletteResults = (
  q: string,
  role: "editor" | "admin",
  notes: { id: string; title: string }[],
  users: { id: string; full_name: string | null; email: string | null }[],
): PaletteItem[] => {
  const term = plain(q.trim());
  const actions: PaletteItem[] = [
    { id: "new", kind: "action" as const, label: "Nueva nota", to: "/articulos/nueva" },
    ...navFor(role).flatMap((group) =>
      group.items.map((item) => ({
        id: item.to,
        kind: "action" as const,
        label: `Ir a ${item.label}`,
        to: item.to,
      })),
    ),
  ].filter((action) => !term || plain(action.label).includes(term));

  return [
    ...actions,
    ...notes.map((note) => ({
      id: note.id,
      kind: "note" as const,
      label: note.title,
      to: `/articulos/${note.id}`,
    })),
    ...(role === "admin"
      ? users.map((user) => ({
          id: user.id,
          kind: "user" as const,
          label: user.full_name ?? user.email ?? "Sin nombre",
          detail: user.email ?? undefined,
          to: `/usuarios?q=${encodeURIComponent(user.email ?? "")}`,
        }))
      : []),
  ];
};
