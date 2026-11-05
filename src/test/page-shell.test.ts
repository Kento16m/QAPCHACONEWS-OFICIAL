import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const index = readFileSync("index.html", "utf8");
const toml = readFileSync("netlify.toml", "utf8");
const fontsDir = "src/assets/vendor/fonts";

describe("first paint", () => {
  it("shows the logo before any JavaScript runs", () => {
    const root = index.match(/<div id="root">([\s\S]*?)<\/div>\s*<script/)?.[1] ?? "";
    expect(root).toContain('src="/logo-light.webp"');
    expect(root).toMatch(/width="\d+"/);
    expect(root).toMatch(/height="\d+"/);
    expect(existsSync("public/logo-light.webp")).toBe(true);
  });

  it("connects to the database early", () => {
    expect(index).toContain('<link rel="preconnect" href="%VITE_SUPABASE_URL%"');
  });
});

describe("fonts", () => {
  const css = existsSync(join(fontsDir, "fonts.css"))
    ? readFileSync(join(fontsDir, "fonts.css"), "utf8")
    : "";

  it("come from this site, not from Google", () => {
    expect(index).not.toContain("fonts.googleapis.com");
    expect(index).not.toContain("fonts.gstatic.com");
    expect(toml).not.toContain("fonts.googleapis.com");
    expect(toml).not.toContain("fonts.gstatic.com");
    expect(readFileSync("src/styles.css", "utf8")).toContain("vendor/fonts/fonts.css");
  });

  it("provide both families the design uses, without blocking text", () => {
    expect(css).toContain('font-family: "Plus Jakarta Sans"');
    expect(css).toContain('font-family: "Playfair Display"');
    expect(css.match(/font-display: swap/g)?.length).toBe(css.match(/@font-face/g)?.length);
  });

  it("point to files that exist", () => {
    const files = [...css.matchAll(/url\("\.\/([^"]+)"\)/g)].map((match) => match[1]!);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) expect(existsSync(join(fontsDir, file))).toBe(true);
  });
});
