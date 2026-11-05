import { describe, expect, it } from "vitest";
import { canMove, dayKey, monthGrid, moveToDay, monthRange } from "./calendar";

describe("dayKey", () => {
  it("uses the day in Paraguay, not in UTC", () => {
    expect(dayKey("2026-11-05T02:30:00Z")).toBe("2026-11-04");
    expect(dayKey("2026-11-05T03:30:00Z")).toBe("2026-11-05");
  });
});

describe("monthGrid", () => {
  const november = monthGrid(2026, 11);

  it("starts on Monday and shows full weeks", () => {
    expect(november[0]?.[0]).toBe("2026-10-26");
    expect(november[0]?.[6]).toBe("2026-11-01");
    expect(november.at(-1)?.[6]).toBe("2026-12-06");
    expect(november.every((week) => week.length === 7)).toBe(true);
  });

  it("includes every day of the month", () => {
    const days = november.flat();
    expect(days).toContain("2026-11-01");
    expect(days).toContain("2026-11-30");
  });

  it("handles a leap February and the turn of the year", () => {
    expect(monthGrid(2028, 2).flat()).toContain("2028-02-29");
    expect(monthGrid(2026, 12).flat()).toContain("2027-01-03");
  });
});

describe("monthRange", () => {
  it("covers the whole grid, in Paraguay's time", () => {
    expect(monthRange(2026, 11)).toEqual({
      from: "2026-10-26T03:00:00.000Z",
      to: "2026-12-07T03:00:00.000Z",
    });
  });
});

describe("moveToDay", () => {
  it("keeps the time of day", () => {
    expect(moveToDay("2026-11-10T13:30:00.000Z", "2026-11-20")).toBe("2026-11-20T13:30:00.000Z");
  });

  it("keeps a late evening time in the chosen day", () => {
    const moved = moveToDay("2026-11-11T02:30:00.000Z", "2026-11-20");
    expect(moved).toBe("2026-11-21T02:30:00.000Z");
    expect(dayKey(moved)).toBe("2026-11-20");
  });
});

describe("canMove", () => {
  const now = new Date("2026-11-05T12:00:00Z");
  const scheduled = { status: "scheduled" as const, scheduled_at: "2026-11-10T13:30:00.000Z" };

  it("allows moving a scheduled note to a later moment", () => {
    expect(canMove(scheduled, "2026-11-20", now)).toBe(true);
  });

  it("refuses a moment already past", () => {
    expect(canMove(scheduled, "2026-11-04", now)).toBe(false);
  });

  it("refuses notes that are not scheduled", () => {
    expect(canMove({ status: "published", scheduled_at: null }, "2026-11-20", now)).toBe(false);
    expect(canMove({ status: "draft", scheduled_at: null }, "2026-11-20", now)).toBe(false);
  });
});
