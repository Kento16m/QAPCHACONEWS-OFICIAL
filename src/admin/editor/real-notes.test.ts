// Opens and saves every published note in the editor's format and compares what a reader would get.
// Runs only when asked: REAL_NOTES_URL=... REAL_NOTES_KEY=... npm run check:editor
import { describe, expect, it } from "vitest";
import { prepareArticleHtml } from "@/lib/article-html";
import { roundtrip } from "./extensions";

const { REAL_NOTES_URL: url, REAL_NOTES_KEY: key } = process.env;

const inspect = (html: string) => {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("[data-remove-media]").forEach((node) => node.remove());
  const count = (selector: string) => doc.querySelectorAll(selector).length;
  // A <br> and a new paragraph read the same, so line breaks do not count as text.
  const text = (doc.body.textContent ?? "").replace(/\s+/g, "");
  return {
    text,
    images: count("img"),
    embeds: count("iframe, video"),
    links: count("a[href]"),
    headings: count("h1, h2, h3, h4, h5, h6"),
    lists: count("li"),
  };
};

// Every paragraph a reader sees must still be there, whole. A merged or cut one would not match.
const paragraphs = (html: string) =>
  [
    ...new DOMParser()
      .parseFromString(html, "text/html")
      .querySelectorAll("p, h1, h2, h3, h4, h5, h6, li"),
  ]
    .map((node) => (node.textContent ?? "").replace(/\s+/g, " ").trim())
    .filter(Boolean);

describe.skipIf(!url || !key)("real notes", () => {
  it("lose nothing when saved by the editor", async () => {
    const response = await fetch(`${url}/rest/v1/articles?select=title,content`, {
      headers: { apikey: key ?? "" },
    });
    const notes: { title: string; content: string }[] = await response.json();
    expect(notes.length).toBeGreaterThan(0);

    const differences = notes.flatMap(({ title, content }) => {
      const before = inspect(prepareArticleHtml(content));
      const after = inspect(roundtrip(content));
      const saved = roundtrip(content);
      const kept = new Set(paragraphs(saved));
      const lost = paragraphs(prepareArticleHtml(content))
        .filter((paragraph) => !kept.has(paragraph))
        .map((paragraph) => `${title}: se perdió "${paragraph.slice(0, 60)}"`);
      return lost.concat(
        (Object.keys(before) as (keyof typeof before)[])
          .filter((field) => before[field] !== after[field])
          .map((field) =>
            field === "text"
              ? `${title}: el texto cambió (${before.text.length} -> ${after.text.length})`
              : `${title}: ${field} ${before[field]} -> ${after[field]}`,
          ),
      );
    });

    expect(differences).toEqual([]);
  });
});
