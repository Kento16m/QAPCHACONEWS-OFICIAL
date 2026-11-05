import { useMemo, useState, type DragEvent, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  agendaDays,
  canMove,
  dayKey,
  listCalendar,
  monthGrid,
  monthRange,
  moveScheduled,
  moveToDay,
  type CalendarNote,
} from "../lib/calendar";
import { Skeleton } from "../ui/Field";

export const Route = createFileRoute("/calendario")({ component: CalendarPage });

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const monthName = new Intl.DateTimeFormat("es-PY", {
  timeZone: "UTC",
  month: "long",
  year: "numeric",
});
const timeOf = new Intl.DateTimeFormat("es-PY", {
  timeZone: "America/Asuncion",
  hour: "2-digit",
  minute: "2-digit",
});

const dayName = new Intl.DateTimeFormat("es-PY", {
  timeZone: "UTC",
  weekday: "long",
  day: "numeric",
  month: "long",
});

const noteMoment = (note: CalendarNote) =>
  (note.status === "scheduled" ? note.scheduled_at : note.published_at) ?? "";

function NoteChip({
  note,
  onAskMove,
}: {
  note: CalendarNote;
  onAskMove: (note: CalendarNote) => void;
}) {
  const scheduled = note.status === "scheduled";
  return (
    <li
      draggable={scheduled}
      onDragStart={(event) => event.dataTransfer.setData("text/plain", note.id)}
      className={cn(
        "group flex items-start gap-1 rounded-md px-1.5 py-1 text-xs leading-snug",
        scheduled
          ? "cursor-grab bg-accent text-accent-foreground active:cursor-grabbing"
          : "bg-muted text-foreground",
      )}
    >
      <Link to="/articulos/$id" params={{ id: note.id }} className="min-w-0 flex-1 hover:underline">
        <span className="font-medium">{timeOf.format(new Date(noteMoment(note)))}</span>{" "}
        <span className="line-clamp-2">{note.title}</span>
      </Link>
      {scheduled && (
        <button
          type="button"
          aria-label={`Cambiar la fecha de ${note.title}`}
          title="Cambiar la fecha"
          onClick={() => onAskMove(note)}
          className="shrink-0 rounded p-0.5 hover:bg-card"
        >
          <CalendarClock className="size-3.5" aria-hidden />
        </button>
      )}
    </li>
  );
}

function CalendarPage() {
  const queryClient = useQueryClient();
  const today = dayKey(new Date().toISOString());
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const [month, setMonth] = useState(Number(today.slice(5, 7)));
  const [over, setOver] = useState<string | null>(null);
  const [moving, setMoving] = useState<CalendarNote | null>(null);
  const [newDay, setNewDay] = useState("");

  const weeks = useMemo(() => monthGrid(year, month), [year, month]);
  const range = useMemo(() => monthRange(year, month), [year, month]);
  const prefix = `${year}-${String(month).padStart(2, "0")}`;

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["admin", "calendar", prefix],
    queryFn: () => listCalendar(range.from, range.to),
    placeholderData: keepPreviousData,
  });

  const byDay = useMemo(() => {
    const days = new Map<string, CalendarNote[]>();
    for (const note of [...(data ?? [])].sort((a, b) =>
      noteMoment(a).localeCompare(noteMoment(b)),
    )) {
      const key = dayKey(noteMoment(note));
      days.set(key, [...(days.get(key) ?? []), note]);
    }
    return days;
  }, [data]);

  const agenda = useMemo(
    () => agendaDays([...byDay.keys()], prefix, today),
    [byDay, prefix, today],
  );

  const move = useMutation({
    mutationFn: ({ note, day }: { note: CalendarNote; day: string }) =>
      moveScheduled(note.id, moveToDay(note.scheduled_at as string, day)),
    onSuccess: () => {
      toast.success("Fecha cambiada.");
      setMoving(null);
    },
    onError: (error) => toast.error(error.message),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["admin", "calendar"] }),
  });

  const tryMove = (note: CalendarNote, day: string) => {
    if (dayKey(note.scheduled_at as string) === day) return;
    if (!canMove(note, day, new Date())) {
      toast.error("Elegí un momento que todavía no haya pasado.");
      return;
    }
    move.mutate({ note, day });
  };

  const onDrop = (event: DragEvent, day: string) => {
    event.preventDefault();
    setOver(null);
    const note = data?.find((item) => item.id === event.dataTransfer.getData("text/plain"));
    if (note) tryMove(note, day);
  };

  const step = (delta: number) => {
    const date = new Date(Date.UTC(year, month - 1 + delta, 1));
    setYear(date.getUTCFullYear());
    setMonth(date.getUTCMonth() + 1);
  };

  const askMove = (note: CalendarNote) => {
    setNewDay(dayKey(note.scheduled_at as string));
    setMoving(note);
  };

  const submitMove = (event: FormEvent) => {
    event.preventDefault();
    if (moving && newDay) tryMove(moving, newDay);
  };

  return (
    <>
      <header className="mb-5 flex min-h-10 flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Calendario</h1>
        <p className="text-muted-foreground first-letter:uppercase">
          {monthName.format(new Date(Date.UTC(year, month - 1, 1)))}
        </p>
        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            size="icon"
            className="size-10 rounded-lg"
            aria-label="Mes anterior"
            onClick={() => step(-1)}
          >
            <ChevronLeft className="size-5" />
          </Button>
          <Button
            variant="outline"
            className="h-10 rounded-lg"
            onClick={() => {
              setYear(Number(today.slice(0, 4)));
              setMonth(Number(today.slice(5, 7)));
            }}
          >
            Hoy
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-10 rounded-lg"
            aria-label="Mes siguiente"
            onClick={() => step(1)}
          >
            <ChevronRight className="size-5" />
          </Button>
        </div>
      </header>

      {isError ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border p-5">
          <p>No pudimos cargar el calendario.</p>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            Reintentar
          </Button>
        </div>
      ) : isPending ? (
        <Skeleton className="h-[34rem]" />
      ) : (
        <>
          <section className="space-y-3 lg:hidden">
            {agenda.length === 0 && (
              <p className="rounded-2xl border bg-card p-5 text-muted-foreground">
                No hay notas este mes.
              </p>
            )}
            {agenda.map((day) => (
              <div key={day} className="rounded-2xl border bg-card p-3">
                <h2 className="mb-2 flex items-center gap-2 font-medium">
                  <span className="inline-block first-letter:uppercase">
                    {dayName.format(new Date(`${day}T00:00:00Z`))}
                  </span>
                  {day === today && (
                    <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                      Hoy
                    </span>
                  )}
                </h2>
                {byDay.has(day) ? (
                  <ul className="space-y-1.5">
                    {byDay.get(day)?.map((note) => (
                      <NoteChip key={note.id} note={note} onAskMove={askMove} />
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">Nada para hoy.</p>
                )}
              </div>
            ))}
          </section>
          <section className="hidden overflow-x-auto rounded-2xl border bg-card lg:block">
            <table className="w-full min-w-[720px] table-fixed border-collapse">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  {WEEKDAYS.map((day) => (
                    <th key={day} scope="col" className="py-2 font-normal">
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weeks.map((week) => (
                  <tr key={week[0]}>
                    {week.map((day) => (
                      <td
                        key={day}
                        data-day={day}
                        onDragOver={(event) => {
                          event.preventDefault();
                          setOver(day);
                        }}
                        onDragLeave={() => setOver(null)}
                        onDrop={(event) => onDrop(event, day)}
                        className={cn(
                          "h-28 border border-border p-1.5 align-top transition-colors duration-150",
                          !day.startsWith(prefix) && "bg-muted/40",
                          over === day && "bg-accent",
                        )}
                      >
                        <span
                          className={cn(
                            "mb-1 inline-flex size-6 items-center justify-center rounded-full text-xs",
                            day === today
                              ? "bg-primary font-semibold text-primary-foreground"
                              : !day.startsWith(prefix) && "text-muted-foreground",
                          )}
                        >
                          {Number(day.slice(8))}
                        </span>
                        <ul className="space-y-1">
                          {byDay.get(day)?.map((note) => (
                            <NoteChip key={note.id} note={note} onAskMove={askMove} />
                          ))}
                        </ul>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}

      <Dialog open={moving !== null} onOpenChange={(open) => !open && setMoving(null)}>
        <DialogContent>
          <form onSubmit={submitMove}>
            <DialogHeader>
              <DialogTitle>Cambiar la fecha</DialogTitle>
              <DialogDescription>
                {moving?.title}. Se publica a la misma hora, en el día que elijas.
              </DialogDescription>
            </DialogHeader>
            <label className="mt-4 block font-medium">
              Nueva fecha
              <Input
                type="date"
                required
                min={today}
                value={newDay}
                onChange={(event) => setNewDay(event.target.value)}
                className="mt-1.5"
              />
            </label>
            <DialogFooter className="mt-5">
              <Button type="button" variant="outline" onClick={() => setMoving(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={move.isPending}>
                Cambiar fecha
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
