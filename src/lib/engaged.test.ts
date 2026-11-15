import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { onceEngaged } from "./engaged";

const setVisibility = (state: DocumentVisibilityState) =>
  Object.defineProperty(document, "visibilityState", { value: state, configurable: true });

describe("onceEngaged", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setVisibility("visible");
  });
  afterEach(() => vi.useRealTimers());

  it("waits for both the time and an interaction", () => {
    const counted = vi.fn();
    onceEngaged(counted);
    vi.advanceTimersByTime(30_000);
    expect(counted).not.toHaveBeenCalled();
    window.dispatchEvent(new Event("scroll"));
    expect(counted).toHaveBeenCalledTimes(1);
  });

  it("does not count an early interaction until the time has passed", () => {
    const counted = vi.fn();
    onceEngaged(counted);
    window.dispatchEvent(new Event("pointerdown"));
    vi.advanceTimersByTime(9_000);
    expect(counted).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1_000);
    expect(counted).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event("scroll"));
    vi.advanceTimersByTime(20_000);
    expect(counted).toHaveBeenCalledTimes(1);
  });

  it("only counts time while the tab is visible", () => {
    const counted = vi.fn();
    onceEngaged(counted);
    window.dispatchEvent(new Event("keydown"));
    setVisibility("hidden");
    vi.advanceTimersByTime(60_000);
    expect(counted).not.toHaveBeenCalled();
    setVisibility("visible");
    vi.advanceTimersByTime(10_000);
    expect(counted).toHaveBeenCalledTimes(1);
  });

  it("never counts after leaving the note", () => {
    const counted = vi.fn();
    const stop = onceEngaged(counted);
    stop();
    window.dispatchEvent(new Event("scroll"));
    vi.advanceTimersByTime(60_000);
    expect(counted).not.toHaveBeenCalled();
  });
});
