// @vitest-environment node
import { describe, expect, it } from "vitest";
import { hasBlockedWord } from "./blocked-words.ts";

describe("hasBlockedWord", () => {
  it.each([
    "Sos un idiota",
    "PUTA madre",
    "hijo de puta",
    "qué mierda de gestión",
    "pendejo",
    "imbecil",
    "bastardo",
  ])("rejects the insult in %j", (text) => {
    expect(hasBlockedWord(text)).toBe(true);
  });

  it.each([
    "Mi perro se perdió en Filadelfia",
    "El camión era muy pesado para el puente",
    "El vuelo salió retrasado por la lluvia",
    "Intentaron matar al ganado y asesinar a un testigo, dice la nota",
    "La historia de la invasión mongol",
    "Un artículo sobre el régimen nazi",
    "Maldito tráfico en la ruta",
    "Computadora y discusión",
    "Leí el artículo sobre el vehículo",
    "Es ridículo, un obstáculo y un vínculo",
    "La disputa por el cálculo del músculo",
  ])("allows the ordinary sentence %j", (text) => {
    expect(hasBlockedWord(text)).toBe(false);
  });
});
