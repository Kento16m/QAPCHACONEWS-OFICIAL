import { describe, expect, it } from "vitest";
import { composeHomepage, LATEST_NEEDED } from "./homepage";
import type { Article } from "@/types";

const note = (id: string) => ({ id, title: id }) as Article;
const latest = Array.from({ length: LATEST_NEEDED }, (_, index) => note(`n${index + 1}`));
const ids = (notes: Article[]) => notes.map((item) => item.id);

describe("composeHomepage", () => {
  it("with nothing chosen shows exactly what the homepage shows today", () => {
    const home = composeHomepage([], note("destacada"), latest);
    expect(home.hero?.id).toBe("destacada");
    expect(ids(home.strip)).toEqual(["n1", "n2", "n3", "n4"]);
    expect(ids(home.latest)).toEqual(["n1", "n2", "n3", "n4", "n5"]);
    expect(ids(home.featured)).toEqual(["n6", "n7", "n8", "n9", "n10"]);
  });

  it("puts the chosen note first", () => {
    const home = composeHomepage([{ position: 1, article: note("n9") }], note("destacada"), latest);
    expect(home.hero?.id).toBe("n9");
  });

  it("does not repeat a chosen note in the lists by date", () => {
    const home = composeHomepage(
      [
        { position: 1, article: note("n1") },
        { position: 2, article: note("n2") },
      ],
      null,
      latest,
    );
    expect(ids(home.strip)).toEqual(["n3", "n4", "n5", "n6"]);
    expect(ids(home.latest)).toEqual(["n3", "n4", "n5", "n6", "n7"]);
    expect(ids(home.featured)[0]).toBe("n2");
    expect(new Set(ids(home.featured)).size).toBe(ids(home.featured).length);
  });

  it("keeps each chosen note in its place and fills the empty ones", () => {
    const home = composeHomepage(
      [
        { position: 3, article: note("n15") },
        { position: 6, article: note("n16") },
      ],
      null,
      latest,
    );
    expect(ids(home.featured)).toEqual(["n6", "n15", "n7", "n8", "n16"]);
  });

  it("fills a place whose note stopped being public", () => {
    const home = composeHomepage(
      [
        { position: 1, article: null },
        { position: 2, article: null },
      ],
      note("destacada"),
      latest,
    );
    expect(home.hero?.id).toBe("destacada");
    expect(ids(home.featured)).toEqual(["n6", "n7", "n8", "n9", "n10"]);
  });

  it("falls back to the newest note when nothing is marked as featured", () => {
    expect(composeHomepage([], null, latest).hero?.id).toBe("n1");
  });

  it("works with very few notes", () => {
    const home = composeHomepage([], null, [note("a"), note("b")]);
    expect(home.hero?.id).toBe("a");
    expect(ids(home.strip)).toEqual(["a", "b"]);
    expect(home.featured).toEqual([]);
  });

  it("works with no notes at all", () => {
    const home = composeHomepage([], null, []);
    expect(home.hero).toBeNull();
    expect(home.strip).toEqual([]);
    expect(home.featured).toEqual([]);
  });
});
