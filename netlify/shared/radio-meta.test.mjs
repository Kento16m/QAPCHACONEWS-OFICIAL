// @vitest-environment node
import { describe, expect, it } from "vitest";
import { handleRadioRequest } from "./radio-meta.mjs";

const HTML = `<!doctype html><html><head>
  <meta name="description" content="Genérica" />
  <meta property="og:title" content="Genérico" />
  <title>QAP ChacoNews</title>
</head><body></body></html>`;

const page = (type = "text/html; charset=utf-8") =>
  new Response(HTML, { headers: { "content-type": type, "content-length": "10", etag: '"a"' } });

describe("handleRadioRequest", () => {
  it("puts the radio's own tags in the HTML, replacing the generic ones", async () => {
    const response = await handleRadioRequest(async () => page());
    const html = await response.text();

    expect(html).toContain("<title>Radio en vivo — QAP ChacoNews</title>");
    expect(html).toContain('property="og:title" content="Radio en vivo — QAP ChacoNews"');
    expect(html).toContain('property="og:url" content="https://qapchaconews.com/radio"');
    expect(html).toContain('rel="preload" as="image" href="/radio-cover.webp"');
    expect(html).not.toContain("Genérico");
    expect(html).not.toContain("Genérica");
    expect(response.headers.get("content-length")).toBeNull();
    expect(response.headers.get("etag")).toBeNull();
  });

  it("leaves anything that is not a page alone", async () => {
    const original = page("application/json");
    expect(await handleRadioRequest(async () => original)).toBe(original);
  });
});
