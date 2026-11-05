import { describe, expect, it } from "vitest";
import { breakingUntilFor } from "./save-article";
import { inHours, moveSlot } from "./homepage-admin";

describe("moveSlot", () => {
  it("swaps two places", () => {
    expect(moveSlot(["a", "b", "c"], 0, 2)).toEqual(["c", "b", "a"]);
  });

  it("moving onto an empty place frees the old one", () => {
    expect(moveSlot(["a", null, "c"], 0, 1)).toEqual([null, "a", "c"]);
  });

  it.each([
    [0, 0],
    [0, 5],
    [-1, 1],
  ])("does nothing for %i to %i", (from, to) => {
    const slots = ["a", "b"];
    expect(moveSlot(slots, from, to)).toBe(slots);
  });
});

describe("breakingUntilFor", () => {
  const now = new Date("2026-11-05T12:00:00Z");
  const in24 = inHours(24, now);

  it("gives 24 hours to a note that just became breaking", () => {
    expect(breakingUntilFor(true, null, now)).toBe(in24);
    expect(breakingUntilFor(true, { is_breaking: false, breaking_until: null }, now)).toBe(in24);
  });

  it("keeps the date of a note that already was", () => {
    const until = "2026-11-06T09:00:00.000Z";
    expect(breakingUntilFor(true, { is_breaking: true, breaking_until: until }, now)).toBe(until);
  });

  it("clears it when the note stops being breaking", () => {
    expect(breakingUntilFor(false, { is_breaking: true, breaking_until: in24 }, now)).toBeNull();
  });
});
