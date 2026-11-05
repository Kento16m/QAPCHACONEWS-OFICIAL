import { describe, expect, it } from "vitest";
import { embedUrlFor } from "./extensions";

describe("embedUrlFor", () => {
  it.each([
    ["https://www.youtube.com/watch?v=abc123", "https://www.youtube-nocookie.com/embed/abc123"],
    ["https://youtu.be/abc123", "https://www.youtube-nocookie.com/embed/abc123"],
    ["https://www.youtube.com/shorts/abc123", "https://www.youtube-nocookie.com/embed/abc123"],
    ["https://www.instagram.com/reel/DfQB8/", "https://www.instagram.com/reel/DfQB8/embed/"],
    ["https://www.instagram.com/p/DfQB8/?igsh=1", "https://www.instagram.com/p/DfQB8/embed/"],
  ])("turns %s into its player", (link, player) => {
    expect(embedUrlFor(link)).toBe(player);
  });

  it.each(["https://evil.example/x", "no es un enlace", "https://www.instagram.com/qapchaco/"])(
    "refuses %s",
    (link) => {
      expect(embedUrlFor(link)).toBeNull();
    },
  );
});
