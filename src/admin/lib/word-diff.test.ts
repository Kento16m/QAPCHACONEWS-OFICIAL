import { describe, expect, it } from "vitest";
import { htmlToText, wordDiff } from "./word-diff";

const text = (parts: ReturnType<typeof wordDiff>, type?: string) =>
  parts
    .filter((part) => !type || part.type === type)
    .map((part) => part.text)
    .join("");

describe("wordDiff", () => {
  it("marks nothing when the text is the same", () => {
    expect(wordDiff("uno dos", "uno dos")).toEqual([{ type: "same", text: "uno dos" }]);
  });

  it("marks the word that changed", () => {
    const parts = wordDiff("el gato negro", "el perro negro");
    expect(text(parts, "del")).toBe("gato");
    expect(text(parts, "add")).toBe("perro");
    expect(text(parts, "same")).toBe("el  negro");
  });

  it("rebuilds both texts exactly", () => {
    const before = "Una nota\ncon dos líneas y varias palabras.";
    const after = "Una nota\ncon tres líneas, varias palabras y un final.";
    const parts = wordDiff(before, after);
    expect(
      parts
        .filter((p) => p.type !== "add")
        .map((p) => p.text)
        .join(""),
    ).toBe(before);
    expect(
      parts
        .filter((p) => p.type !== "del")
        .map((p) => p.text)
        .join(""),
    ).toBe(after);
  });

  it("handles an empty side", () => {
    expect(wordDiff("", "hola")).toEqual([{ type: "add", text: "hola" }]);
    expect(wordDiff("hola", "")).toEqual([{ type: "del", text: "hola" }]);
  });

  it("stays fast on a very long note with changes spread across it", () => {
    const before = Array.from({ length: 6000 }, (_, i) => `a${i}`).join(" ");
    const after = Array.from({ length: 6000 }, (_, i) => `b${i}`).join(" ");
    const start = performance.now();
    const parts = wordDiff(before, after);
    expect(performance.now() - start).toBeLessThan(1000);
    expect(
      parts
        .filter((p) => p.type !== "add")
        .map((p) => p.text)
        .join(""),
    ).toBe(before);
  });
});

describe("htmlToText", () => {
  it("keeps paragraphs apart", () => {
    expect(htmlToText("<p>uno</p><p>dos <strong>tres</strong></p>")).toBe("uno\ndos tres");
  });

  it("names media instead of dropping it", () => {
    expect(htmlToText(`<p>a</p><img src="x" alt="Foto">`)).toBe("a\n[Imagen: Foto]");
    expect(htmlToText(`<iframe src="x"></iframe>`)).toBe("[Video]");
  });
});
