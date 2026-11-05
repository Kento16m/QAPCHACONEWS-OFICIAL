import { describe, expect, it } from "vitest";
import { navFor } from "./nav";

const labels = (role: "editor" | "admin") =>
  navFor(role).flatMap((group) => group.items.map((item) => item.label));

describe("navFor", () => {
  it("hides administration from editors", () => {
    expect(labels("editor")).toEqual([
      "Hoy",
      "Artículos",
      "Portada",
      "Calendario",
      "Imágenes",
      "Comentarios",
      "Estadísticas",
    ]);
  });

  it("gives administrators everything", () => {
    expect(labels("admin")).toEqual([
      "Hoy",
      "Artículos",
      "Portada",
      "Calendario",
      "Imágenes",
      "Comentarios",
      "Newsletter",
      "Usuarios",
      "Estadísticas",
      "Actividad",
      "Categorías y etiquetas",
    ]);
  });

  it("leaves out groups with nothing to show", () => {
    expect(navFor("editor").map((group) => group.title)).toEqual([
      "Contenido",
      "Comunidad",
      "Análisis",
    ]);
  });
});
