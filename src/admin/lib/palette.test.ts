import { describe, expect, it } from "vitest";
import { matchParts, paletteResults } from "./palette";

const notes = [{ id: "n1", title: "Nota uno" }];
const users = [{ id: "u1", full_name: "Ana", email: "ana@qap.com" }];

const labels = (q: string, role: "editor" | "admin", n = notes, u = users) =>
  paletteResults(q, role, n, u).map((item) => item.label);

describe("paletteResults", () => {
  it("finds actions without needing accents", () => {
    expect(labels("categorias", "admin")).toContain("Ir a Categorías y etiquetas");
    expect(labels("estadisticas", "editor")).toContain("Ir a Estadísticas");
  });

  it("never gives an editor an administrator's action", () => {
    expect(labels("usuarios", "editor")).not.toContain("Ir a Usuarios");
    expect(labels("categorias", "editor")).toEqual(["Nota uno"]);
  });

  it("never gives an editor people, even if they were passed", () => {
    expect(labels("ana", "editor")).not.toContain("Ana");
    expect(labels("ana", "admin")).toContain("Ana");
  });

  it("always lists the notes found by the search", () => {
    expect(labels("cualquier cosa", "editor")).toEqual(["Nota uno"]);
  });

  it("puts actions first, then notes, then people", () => {
    const kinds = paletteResults("usuarios", "admin", notes, users).map((item) => item.kind);
    expect(kinds).toEqual(["action", "note", "user"]);
  });

  it("shows the main actions when nothing was typed", () => {
    expect(labels("", "editor", [], [])).toContain("Nueva nota");
  });

  it("links each result to its place", () => {
    const [note] = paletteResults("xx", "editor", notes, []);
    expect(note?.to).toBe("/articulos/n1");
  });
});

describe("notes in the results", () => {
  const found = [
    { id: "a", title: "Sequía en el Chaco" },
    { id: "b", title: "Cuatro intendentes" },
    { id: "c", title: "Lluvias" },
  ];
  const notesOnly = (q: string, list = found) =>
    paletteResults(q, "editor", list, []).filter((item) => item.kind === "note");

  it("puts notes with the word in their title first", () => {
    expect(notesOnly("intendentes").map((item) => item.id)).toEqual(["b", "a", "c"]);
  });

  it("says when the word is only in the summary", () => {
    const [title, summary] = notesOnly("intendentes");
    expect(title?.detail).toBeUndefined();
    expect(summary?.detail).toBe("En el resumen");
  });

  it("ignores accents when ranking", () => {
    expect(notesOnly("sequia")[0]?.id).toBe("a");
  });

  it("shows six notes, without losing a title match further down", () => {
    const many = Array.from({ length: 10 }, (_, index) => ({
      id: String(index),
      title: index === 9 ? "Con palabra" : "Otra",
    }));
    const shown = notesOnly("palabra", many);
    expect(shown).toHaveLength(6);
    expect(shown[0]?.id).toBe("9");
  });
});

describe("matchParts", () => {
  it("splits around the word, whatever its accents and case", () => {
    expect(matchParts("Sequía en el Chaco", "SEQUIA")).toEqual(["", "Sequía", " en el Chaco"]);
    expect(matchParts("El Chaco", "cha")).toEqual(["El ", "Cha", "co"]);
  });

  it("leaves a text without the word alone", () => {
    expect(matchParts("El Chaco", "lluvia")).toEqual(["El Chaco", "", ""]);
    expect(matchParts("El Chaco", " ")).toEqual(["El Chaco", "", ""]);
  });
});
