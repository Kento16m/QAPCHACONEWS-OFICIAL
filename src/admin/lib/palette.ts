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

const NOTES_SHOWN = 6;

/** The text before the word, the word, and the text after. */
export const matchParts = (text: string, q: string): [string, string, string] => {
  const term = plain(q.trim());
  const at = term ? plain(text).indexOf(term) : -1;
  if (at < 0) return [text, "", ""];
  return [text.slice(0, at), text.slice(at, at + term.length), text.slice(at + term.length)];
};

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
    ...[
      ...notes.filter((note) => plain(note.title).includes(term)),
      ...notes.filter((note) => !plain(note.title).includes(term)),
    ]
      .slice(0, NOTES_SHOWN)
      .map((note) => ({
        id: note.id,
        kind: "note" as const,
        label: note.title,
        detail: plain(note.title).includes(term) ? undefined : "En el resumen",
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
