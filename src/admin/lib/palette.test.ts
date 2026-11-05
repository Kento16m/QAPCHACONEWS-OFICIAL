import { describe, expect, it } from "vitest";
import { paletteResults } from "./palette";

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
