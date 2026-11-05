import { describe, expect, it } from "vitest";
import {
  axisTicks,
  comparedToPrevious,
  deltaPercent,
  fillMissingDays,
  groupByMonth,
  hasEnoughHistory,
  niceMax,
  rangeFor,
  smoothPath,
} from "./series";

describe("fillMissingDays", () => {
  it("shows days without reads as zero", () => {
    expect(fillMissingDays([{ day: "2026-11-02", reads: 5 }], "2026-11-01", "2026-11-03")).toEqual([
      { day: "2026-11-01", reads: 0 },
      { day: "2026-11-02", reads: 5 },
      { day: "2026-11-03", reads: 0 },
    ]);
  });

  it("crosses a month and a year", () => {
    expect(fillMissingDays([], "2026-12-31", "2027-01-01").map((row) => row.day)).toEqual([
      "2026-12-31",
      "2027-01-01",
    ]);
  });

  it("reads numbers the database sends as text", () => {
    expect(
      fillMissingDays(
        [{ day: "2026-11-01", reads: "7" as unknown as number }],
        "2026-11-01",
        "2026-11-01",
      ),
    ).toEqual([{ day: "2026-11-01", reads: 7 }]);
  });
});

describe("groupByMonth", () => {
  it("adds up each month", () => {
    expect(
      groupByMonth([
        { day: "2026-10-31", reads: 1 },
        { day: "2026-11-01", reads: 2 },
        { day: "2026-11-02", reads: 3 },
      ]),
    ).toEqual([
      { day: "2026-10", reads: 1 },
      { day: "2026-11", reads: 5 },
    ]);
  });
});

describe("deltaPercent", () => {
  it("compares with the previous period", () => {
    expect(deltaPercent(120, 100)).toBe(20);
    expect(deltaPercent(50, 100)).toBe(-50);
  });

  it("gives nothing when there is no period to compare with", () => {
    expect(deltaPercent(50, 0)).toBeNull();
  });
});

describe("comparedToPrevious", () => {
  const days = (reads: number[]) =>
    reads.map((value, index) => ({ day: String(index), reads: value }));

  it("compares two whole periods", () => {
    expect(comparedToPrevious(days([60, 60]), days([50, 50]))).toBe(20);
  });

  it("does not compare with a period that started before counting did", () => {
    expect(comparedToPrevious(days([60, 60]), days([0, 0, 0, 0, 5]))).toBeNull();
  });

  it("allows a quiet first day", () => {
    expect(comparedToPrevious(days([20]), days([0, 5, 5]))).toBe(100);
  });
});

describe("hasEnoughHistory", () => {
  const row = (day: string, reads: number) => ({ day, reads });

  it("waits for three days with reads", () => {
    expect(hasEnoughHistory([row("a", 1), row("b", 0), row("c", 2)])).toBe(false);
    expect(hasEnoughHistory([row("a", 1), row("b", 3), row("c", 2)])).toBe(true);
  });
});

describe("rangeFor", () => {
  const now = new Date("2026-11-05T02:30:00Z");

  it("counts days ending today in Paraguay", () => {
    expect(rangeFor(7, now)).toEqual({ from: "2026-10-29", to: "2026-11-04" });
  });

  it("gives the period before it, the same length", () => {
    expect(rangeFor(7, now).from).toBe("2026-10-29");
    expect(rangeFor(14, now).from).toBe("2026-10-22");
  });
});

describe("niceMax", () => {
  it.each([
    [57, 60],
    [100, 100],
    [101, 150],
    [3, 4],
    [0, 4],
    [950, 1000],
  ])("fits %i under %i", (value, top) => {
    expect(niceMax(value)).toBe(top);
  });
});

describe("smoothPath", () => {
  const points = [
    { x: 0, y: 100 },
    { x: 10, y: 100 },
    { x: 20, y: 40 },
    { x: 30, y: 60 },
  ];
  const numbers = (path: string) => (path.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);

  it("passes through every point", () => {
    const path = smoothPath(points);
    expect(path.startsWith("M0 100")).toBe(true);
    expect(path).toContain("10 100 C");
    expect(path).toContain("20 40 C");
    expect(path.endsWith("30 60")).toBe(true);
  });

  it("never invents a peak beyond the data", () => {
    const ys = numbers(smoothPath(points)).filter((_, index) => index % 2 === 1);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(40);
    expect(Math.max(...ys)).toBeLessThanOrEqual(100);
  });

  it("copes with one point and with none", () => {
    expect(smoothPath([{ x: 5, y: 5 }])).toBe("M5 5");
    expect(smoothPath([])).toBe("");
  });
});

describe("axisTicks", () => {
  it("always ends on the last day, so the end of the line reads as today", () => {
    expect(axisTicks(30)).toEqual([0, 5, 10, 15, 20, 25, 29]);
    expect(axisTicks(31)).toEqual([0, 5, 10, 15, 20, 25, 30]);
    expect(axisTicks(7)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("drops the label that would crowd the last one", () => {
    expect(axisTicks(12)).toEqual([0, 2, 4, 6, 8, 11]);
  });

  it("copes with one day and with none", () => {
    expect(axisTicks(1)).toEqual([0]);
    expect(axisTicks(0)).toEqual([]);
  });
});
