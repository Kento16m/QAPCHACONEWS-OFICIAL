import { requireSupabaseClient } from "@/lib/supabase";
import { dayKey } from "./calendar";

export type DayReads = { day: string; reads: number };
export type RankRow = { id: string; label: string; reads: number };

const DAY_MS = 86_400_000;
const MIN_DAYS_WITH_READS = 3;

const shiftDay = (day: string, days: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

export const rangeFor = (days: number, now = new Date()) => {
  const to = dayKey(now.toISOString());
  return { from: shiftDay(to, 1 - days), to };
};

export const previousRange = ({ from, to }: { from: string; to: string }) => {
  const length = (Date.parse(to) - Date.parse(from)) / DAY_MS + 1;
  return { from: shiftDay(from, -length), to: shiftDay(from, -1) };
};

export const fillMissingDays = (rows: DayReads[], from: string, to: string): DayReads[] => {
  const known = new Map(rows.map((row) => [row.day, Number(row.reads)]));
  const days: DayReads[] = [];
  for (let day = from; day <= to; day = shiftDay(day, 1)) {
    days.push({ day, reads: known.get(day) ?? 0 });
  }
  return days;
};

export const groupByMonth = (rows: DayReads[]): DayReads[] => {
  const months = new Map<string, number>();
  for (const { day, reads } of rows) {
    const month = day.slice(0, 7);
    months.set(month, (months.get(month) ?? 0) + reads);
  }
  return [...months].map(([day, reads]) => ({ day, reads }));
};

export const deltaPercent = (current: number, previous: number) =>
  previous === 0 ? null : Math.round(((current - previous) / previous) * 100);

/** Counting started at some point: a period that began before that cannot be compared. */
export const comparedToPrevious = (current: DayReads[], previous: DayReads[]) => {
  const sum = (rows: DayReads[]) => rows.reduce((total, row) => total + row.reads, 0);
  return previous.slice(0, MIN_DAYS_WITH_READS).some((row) => row.reads > 0)
    ? deltaPercent(sum(current), sum(previous))
    : null;
};

/** A top for the chart's scale that leaves little room above the highest value. */
export const niceMax = (value: number) => {
  if (value <= 4) return 4;
  const step = 10 ** Math.floor(Math.log10(value));
  const multiple = [1, 1.5, 2, 3, 4, 5, 6, 8, 10].find((candidate) => candidate * step >= value);
  return (multiple ?? 10) * step;
};

/** A curve through every point that stays between neighbours, so it cannot invent a peak. */
export const smoothPath = (points: { x: number; y: number }[]) => {
  const slopes = points.slice(1).map((point, index) => {
    const before = points[index] as { x: number; y: number };
    return (point.y - before.y) / (point.x - before.x);
  });
  const tangent = (index: number) => {
    const left = slopes[index - 1] ?? slopes[index] ?? 0;
    const right = slopes[index] ?? left;
    return left * right <= 0 ? 0 : (2 * left * right) / (left + right);
  };
  return points
    .map(({ x, y }, index) => {
      const before = points[index - 1];
      if (!before) return `M${x} ${y}`;
      const third = (x - before.x) / 3;
      const c1 = `${before.x + third} ${before.y + tangent(index - 1) * third}`;
      const c2 = `${x - third} ${y - tangent(index) * third}`;
      return `C${c1} ${c2} ${x} ${y}`;
    })
    .join(" ");
};

/** Which days get a date under the chart: evenly spaced, and always the last one. */
export const axisTicks = (count: number, labels = 7) => {
  if (count === 0) return [];
  const every = Math.max(1, Math.ceil(count / labels));
  const last = count - 1;
  const ticks: number[] = [];
  for (let index = 0; index < last; index += every) {
    if (last - index >= every * 0.6) ticks.push(index);
  }
  return [...ticks, last];
};

export const totalReads = (rows: DayReads[]) => rows.reduce((sum, row) => sum + row.reads, 0);

export const hasEnoughHistory = (rows: DayReads[]) =>
  rows.filter((row) => row.reads > 0).length >= MIN_DAYS_WITH_READS;

export const fetchSeries = async (from: string, to: string): Promise<DayReads[]> => {
  const { data, error } = await requireSupabaseClient().rpc("admin_reads_series", {
    p_from: from,
    p_to: to,
  });
  if (error) throw error;
  return fillMissingDays((data ?? []) as DayReads[], from, to);
};

export const fetchRanking = async (
  dimension: "article" | "category" | "author",
  from: string,
  to: string,
): Promise<RankRow[]> => {
  const { data, error } = await requireSupabaseClient().rpc("admin_reads_by", {
    p_dimension: dimension,
    p_from: from,
    p_to: to,
  });
  if (error) throw error;
  return ((data ?? []) as RankRow[]).map((row) => ({ ...row, reads: Number(row.reads) }));
};
