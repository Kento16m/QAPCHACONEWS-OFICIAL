import { describe, expect, it } from "vitest";
import { canConvert, fitWithin, publicFileName, validateImageUrl } from "./media";

describe("validateImageUrl", () => {
  it.each(["https://ik.imagekit.io/qap/a.jpg", "https://x.supabase.co/a.webp?x=1"])(
    "accepts %s",
    (url) => {
      expect(validateImageUrl(url)).toBe(true);
    },
  );

  it.each(["http://x.com/a.jpg", "javascript:alert(1)", "data:image/png;base64,AAAA", "no es", ""])(
    "refuses %s",
    (url) => {
      expect(validateImageUrl(url)).toBe(false);
    },
  );
});

describe("canConvert", () => {
  it.each(["image/jpeg", "image/png", "image/webp"])("converts %s", (type) => {
    expect(canConvert(type)).toBe(true);
  });

  it.each(["image/gif", "video/mp4", "image/svg+xml", ""])("leaves %s as it is", (type) => {
    expect(canConvert(type)).toBe(false);
  });
});

describe("fitWithin", () => {
  it("reduces a large photo to the limit, keeping its shape", () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 });
  });

  it("never enlarges a small image", () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });
});

describe("publicFileName", () => {
  it("makes a safe, unique path", () => {
    expect(publicFileName("Foto del día (1).webp", 123)).toBe("123-Foto-del-d-a-1-.webp");
  });
});
