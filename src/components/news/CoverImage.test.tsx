import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CoverImage } from "@/components/news/primitives";

const SRC = "https://x.supabase.co/a.webp";

describe("CoverImage", () => {
  it("waits to download images further down the page", () => {
    render(<CoverImage src={SRC} alt="Nota" />);
    expect(screen.getByRole("img", { name: "Nota" })).toHaveAttribute("loading", "lazy");
  });

  it("downloads the main image of the page right away", () => {
    render(<CoverImage src={SRC} alt="Nota" priority />);
    const image = screen.getByRole("img", { name: "Nota" });
    expect(image).toHaveAttribute("loading", "eager");
    expect(image).toHaveAttribute("fetchpriority", "high");
  });
});
