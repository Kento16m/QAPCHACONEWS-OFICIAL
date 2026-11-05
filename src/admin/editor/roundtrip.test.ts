import { describe, expect, it } from "vitest";
import { roundtrip } from "./extensions";

describe("roundtrip", () => {
  it.each([
    ["headings", "<h2>Uno</h2><h3>Dos</h3>"],
    ["paragraph with emphasis", "<p><strong>a</strong> <em>b</em></p>"],
    ["bullet list", "<ul><li><p>a</p></li><li><p>b</p></li></ul>"],
    ["numbered list", "<ol><li><p>a</p></li></ol>"],
    ["quote", "<blockquote><p>cita</p></blockquote>"],
  ])("keeps %s", (_name, html) => {
    expect(roundtrip(html)).toBe(html);
  });

  it("keeps a link and its address", () => {
    const out = roundtrip(`<p><a href="https://qapchaconews.com/x">enlace</a></p>`);
    expect(out).toContain(`href="https://qapchaconews.com/x"`);
    expect(out).toContain(">enlace</a>");
  });

  it("keeps an image with its description", () => {
    const out = roundtrip(`<img src="https://x.com/a.webp" alt="Una foto">`);
    expect(out).toContain(`src="https://x.com/a.webp"`);
    expect(out).toContain(`alt="Una foto"`);
  });

  it("keeps a table", () => {
    const out = roundtrip(
      "<table><tbody><tr><td><p>a</p></td><td><p>b</p></td></tr></tbody></table>",
    );
    expect(out).toContain("<table");
    expect(out).toContain("<p>a</p>");
    expect(out).toContain("<p>b</p>");
  });

  it("keeps a video file", () => {
    const out = roundtrip(`<video src="https://x.supabase.co/v.mp4" controls></video>`);
    expect(out).toContain("<video");
    expect(out).toContain(`src="https://x.supabase.co/v.mp4"`);
  });

  it.each([
    "https://www.youtube.com/embed/abc",
    "https://www.youtube-nocookie.com/embed/abc",
    "https://www.instagram.com/reel/abc/embed/",
  ])("keeps an embed from %s", (src) => {
    expect(roundtrip(`<iframe src="${src}" title="Video"></iframe>`)).toContain(`src="${src}"`);
  });

  it("keeps bold written as a style, the way old notes have it", () => {
    expect(roundtrip(`<p><span style="font-weight: bolder;">fuerte</span></p>`)).toContain(
      "<strong>fuerte</strong>",
    );
  });

  it("drops an embed from an unknown site", () => {
    expect(roundtrip(`<iframe src="https://evil.example/x"></iframe>`)).not.toContain("<iframe");
  });

  it("drops scripts and event handlers", () => {
    const out = roundtrip(`<p onclick="alert(1)">a</p><script>alert(1)</script>`);
    expect(out).not.toMatch(/script|onclick/);
    expect(out).toContain("a");
  });

  it("drops a link that would run code", () => {
    expect(roundtrip(`<p><a href="javascript:alert(1)">x</a></p>`)).not.toContain("javascript:");
  });

  it("removes the old panel's media controls but keeps the media", () => {
    const out = roundtrip(
      `<div data-media-block="true" contenteditable="false"><figure class="x"><img src="https://x.com/a.webp" alt="f"></figure><button type="button" data-remove-media="true" aria-label="Quitar">×</button></div>`,
    );
    expect(out).toContain(`src="https://x.com/a.webp"`);
    expect(out).not.toContain("×");
    expect(out).not.toContain("<button");
  });
});
