import { describe, expect, it } from "vitest";
import { prepareArticleHtml } from "./article-html";

describe("prepareArticleHtml", () => {
  it.each([
    ["a link that runs code", `<p><a href="javascript:alert(1)">x</a></p>`, "javascript:"],
    ["an embed that runs code", `<iframe src="javascript:alert(1)"></iframe>`, "javascript:"],
    ["a fake form", `<form action="https://evil.test"><input name="clave"></form>`, "<form"],
    ["a form field", `<p><input name="clave"></p>`, "<input"],
    ["a style sheet", `<style>body{display:none}</style><p>x</p>`, "<style"],
    ["a script", `<p>x</p><script>alert(1)</script>`, "<script"],
    ["an event handler", `<p onclick="alert(1)">x</p>`, "onclick"],
  ])("removes %s", (_name, html, forbidden) => {
    expect(prepareArticleHtml(html)).not.toContain(forbidden);
  });

  it.each([
    [
      "a normal link",
      `<a href="https://qapchaconews.com/x">x</a>`,
      `href="https://qapchaconews.com/x"`,
    ],
    ["a relative link", `<a href="/noticia/x">x</a>`, `href="/noticia/x"`],
    ["a mail link", `<a href="mailto:a@qap.com">x</a>`, `href="mailto:a@qap.com"`],
    ["a video player", `<iframe src="https://www.youtube.com/embed/a"></iframe>`, "<iframe"],
    ["a video file", `<video src="https://x.supabase.co/v.mp4" controls></video>`, "<video"],
    ["an embedded image", `<img src="data:image/png;base64,AAAA" alt="x">`, "data:image/png"],
    ["the bold of old notes", `<p><span style="font-weight: bolder;">x</span></p>`, "font-weight"],
  ])("keeps %s", (_name, html, expected) => {
    expect(prepareArticleHtml(html)).toContain(expected);
  });

  it("turns plain text into paragraphs", () => {
    expect(prepareArticleHtml("Uno\n\nDos")).toBe("<p>Uno</p><p>Dos</p>");
  });

  it("removes the old panel's media buttons", () => {
    expect(
      prepareArticleHtml(
        `<div><button data-remove-media="true">×</button><img src="https://x.co/a" alt=""></div>`,
      ),
    ).not.toContain("×");
  });
});
