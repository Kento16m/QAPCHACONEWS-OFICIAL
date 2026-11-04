import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const VENDOR = "src/assets/vendor";

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return path.includes("assets") ? [] : sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });

const source = sourceFiles("src")
  .map((path) => readFileSync(path, "utf8"))
  .join("\n");

const flagsCss = readFileSync(join(VENDOR, "flags/flags.css"), "utf8");
const weatherCss = readFileSync(join(VENDOR, "weather-icons/css/weather-icons.css"), "utf8");
const styles = readFileSync("src/styles.css", "utf8");

describe("icon styles the site ships", () => {
  const usedFlags = [...new Set([...source.matchAll(/\bfi fi-([a-z]{2})\b/g)].map((m) => m[1]!))];
  const usedWeather = [...new Set([...source.matchAll(/\bwi-[a-z0-9-]+/g)].map((m) => m[0]))];

  it("finds the icons in use, so the checks below mean something", () => {
    expect(usedFlags.length).toBeGreaterThan(5);
    expect(usedWeather.length).toBeGreaterThan(5);
  });

  it("includes every flag the site uses, with its image", () => {
    for (const flag of usedFlags) {
      expect(flagsCss).toContain(`.fi-${flag}`);
      expect(existsSync(join(VENDOR, `flags/${flag}.svg`))).toBe(true);
    }
  });

  it("includes every weather icon the site uses", () => {
    for (const icon of usedWeather) {
      expect(weatherCss).toContain(`.${icon}:before`);
    }
  });

  it("does not ship the full icon sets", () => {
    expect(styles).not.toContain("flag-icons");
    expect((flagsCss.match(/\.fi-/g) ?? []).length).toBe(usedFlags.length);
    expect((weatherCss.match(/\.wi-[a-z0-9-]+:before/g) ?? []).length).toBe(usedWeather.length);
  });

  it("only offers modern font formats that exist", () => {
    expect(weatherCss).not.toMatch(/\.eot|\.ttf|\.svg/);
    for (const [, file] of weatherCss.matchAll(/url\(['"]?\.\.\/font\/([^'")?#]+)/g)) {
      expect(existsSync(join(VENDOR, "weather-icons/font", file!))).toBe(true);
    }
  });
});
