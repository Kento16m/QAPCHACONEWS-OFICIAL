import { afterEach, describe, expect, it, vi } from "vitest";
import { printHtml } from "@/lib/print";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("printHtml", () => {
  it("opens the window without features that make window.open return null", () => {
    const popup = { document: { write: vi.fn(), close: vi.fn() }, focus: vi.fn(), print: vi.fn() };
    const open = vi.spyOn(window, "open").mockReturnValue(popup as unknown as Window);
    vi.useFakeTimers();

    expect(printHtml("<p>hola</p>")).toBe(true);
    vi.runAllTimers();

    expect(open.mock.calls[0]?.[2]).toBeUndefined();
    expect(popup.document.write).toHaveBeenCalledWith("<p>hola</p>");
    expect(popup.print).toHaveBeenCalledTimes(1);
  });

  it("reports a blocked popup", () => {
    vi.spyOn(window, "open").mockReturnValue(null);
    expect(printHtml("<p>hola</p>")).toBe(false);
  });
});
