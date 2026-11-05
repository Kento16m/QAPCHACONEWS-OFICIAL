import type { ArticleStatus } from "@/lib/admin";
import { requireSupabaseClient } from "@/lib/supabase";

const TIME_ZONE = "America/Asuncion";
// shortcut: Paraguay has kept UTC-3 all year since 2024; read the offset from the zone if that changes.
const OFFSET = "-03:00";
const DAY_MS = 86_400_000;

const formatDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const formatTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export type CalendarNote = {
  id: string;
  title: string;
  status: ArticleStatus;
  published_at: string | null;
  scheduled_at: string | null;
};

/** For a list: today and what is coming, then what already went out. Today is always there. */
export const agendaDays = (days: string[], month: string, today: string) => {
  const shown = new Set(days.filter((day) => day.startsWith(month)));
  if (today.startsWith(month)) shown.add(today);
  const sorted = [...shown].sort();
  return [
    ...sorted.filter((day) => day >= today),
    ...sorted.filter((day) => day < today).reverse(),
  ];
};

/** The day a moment falls on in Paraguay, as YYYY-MM-DD. */
export const dayKey = (iso: string) => formatDay.format(new Date(iso));

const utcDay = (year: number, month: number, day: number) => Date.UTC(year, month - 1, day);
const toKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Whole weeks, Monday first, as YYYY-MM-DD: a day without time cannot slip across time zones. */
export const monthGrid = (year: number, month: number): string[][] => {
  const first = utcDay(year, month, 1);
  const last = utcDay(year, month + 1, 0);
  const start = first - ((new Date(first).getUTCDay() + 6) % 7) * DAY_MS;

  const weeks: string[][] = [];
  for (let monday = start; monday <= last; monday += 7 * DAY_MS) {
    weeks.push(Array.from({ length: 7 }, (_, index) => toKey(monday + index * DAY_MS)));
  }
  return weeks;
};

export const monthRange = (year: number, month: number) => {
  const days = monthGrid(year, month).flat();
  const end = Date.parse(`${days.at(-1)}T00:00:00Z`) + DAY_MS;
  return {
    from: new Date(`${days[0]}T00:00:00${OFFSET}`).toISOString(),
    to: new Date(`${toKey(end)}T00:00:00${OFFSET}`).toISOString(),
  };
};

export const moveToDay = (iso: string, day: string) =>
  new Date(`${day}T${formatTime.format(new Date(iso))}:00${OFFSET}`).toISOString();

export const canMove = (
  note: Pick<CalendarNote, "status" | "scheduled_at">,
  day: string,
  now: Date,
) =>
  note.status === "scheduled" &&
  Boolean(note.scheduled_at) &&
  new Date(moveToDay(note.scheduled_at as string, day)) > now;

export const listCalendar = async (from: string, to: string): Promise<CalendarNote[]> => {
  const within = (column: string) => `${column}.gte."${from}",${column}.lt."${to}"`;
  const { data, error } = await requireSupabaseClient()
    .from("articles")
    .select("id, title, status, published_at, scheduled_at")
    .or(
      `and(status.eq.published,${within("published_at")}),and(status.eq.scheduled,${within("scheduled_at")})`,
    );
  if (error) throw error;
  return data ?? [];
};

export const moveScheduled = async (id: string, scheduledAt: string) => {
  const { data, error } = await requireSupabaseClient()
    .from("articles")
    .update({ scheduled_at: scheduledAt })
    .eq("id", id)
    .eq("status", "scheduled")
    .select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("Esa nota ya no está programada.");
};
