import { describe, expect, it } from "vitest";
import { cleanPastedHtml } from "./paste";

describe("cleanPastedHtml", () => {
  const word = `<!--[if gte mso 9]><xml><o:OfficeDocumentSettings></o:OfficeDocumentSettings></xml><![endif]-->
    <p class="MsoNormal" style="margin-bottom:0cm;mso-line-height-alt:12pt"><span style="font-family:Calibri;mso-bidi-font-weight:bold"><b>Título</b> del texto<o:p></o:p></span></p>
    <style>p {color: red}</style>`;

  it("removes what Word leaves behind", () => {
    const clean = cleanPastedHtml(word);
    expect(clean).not.toMatch(/mso|MsoNormal|style=|class=|<style|<!--|o:p/i);
  });

  it("keeps the text and its emphasis", () => {
    const clean = cleanPastedHtml(word);
    expect(clean).toContain("<b>Título</b>");
    expect(clean).toContain("del texto");
  });

  it("keeps links and removes dangerous attributes", () => {
    const clean = cleanPastedHtml(
      `<a href="https://x.com" onclick="alert(1)" style="color:red">enlace</a>`,
    );
    expect(clean).toBe(`<a href="https://x.com">enlace</a>`);
  });

  it("removes scripts", () => {
    expect(cleanPastedHtml(`<p>hola</p><script>alert(1)</script>`)).toBe("<p>hola</p>");
  });
});

describe("cleanPastedHtml with Google Docs", () => {
  it("does not take its outer wrapper for bold", () => {
    const clean = cleanPastedHtml(
      `<b style="font-weight:normal" id="docs-internal-guid-1"><p>texto</p></b>`,
    );
    expect(clean).toBe("<p>texto</p>");
  });

  it("keeps bold and italic that it writes as styles", () => {
    const clean = cleanPastedHtml(
      `<p><span style="font-weight:700">fuerte</span> <span style="font-style:italic">suave</span></p>`,
    );
    expect(clean).toBe("<p><strong>fuerte</strong> <em>suave</em></p>");
  });
});
