import { useEffect, useState, type DragEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  fetchBreaking,
  fetchSlots,
  moveSlot,
  saveSlots,
  setBreaking,
  SLOT_COUNT,
  toLocalInput,
  fromLocalInput,
  inHours,
  type SlotNote,
} from "../lib/homepage-admin";
import { NotePicker } from "../features/homepage/NotePicker";
import { Skeleton, Thumb } from "../ui/Field";

export const Route = createFileRoute("/portada")({ component: HomepagePage });

function Slot({
  index,
  note,
  large = false,
  onChoose,
  onClear,
  onMove,
  onDropFrom,
}: {
  index: number;
  note: SlotNote | null;
  large?: boolean;
  onChoose: () => void;
  onClear: () => void;
  onMove: (to: number) => void;
  onDropFrom: (from: number) => void;
}) {
  const [over, setOver] = useState(false);
  const name = index === 0 ? "Nota principal" : `Destacada ${index}`;

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setOver(false);
    const from = Number(event.dataTransfer.getData("text/plain"));
    if (!Number.isNaN(from)) onDropFrom(from);
  };

  return (
    <article
      aria-label={name}
      draggable={Boolean(note)}
      onDragStart={(event) => event.dataTransfer.setData("text/plain", String(index))}
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border bg-card transition-colors duration-150",
        over && "border-primary bg-accent",
        note && "cursor-grab active:cursor-grabbing",
      )}
    >
      <div className="relative">
        <span className="absolute left-2 top-2 z-[1] rounded-md border bg-card px-2 py-0.5 text-xs font-medium">
          {name}
        </span>
        {note?.cover_image_url ? (
          <Thumb
            src={note.cover_image_url}
            className={cn("w-full bg-muted object-cover", large ? "aspect-[21/9]" : "aspect-video")}
          />
        ) : (
          <div
            className={cn(
              "flex w-full items-center justify-center bg-muted text-muted-foreground",
              large ? "aspect-[21/9]" : "aspect-video",
            )}
          >
            {note ? "Sin foto" : "Libre"}
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <p className={cn("font-medium", large && "text-lg font-semibold")}>
          {note?.title ?? "Se rellena con lo más reciente"}
        </p>
        <div className="mt-auto flex flex-wrap items-center gap-1">
          <Button variant="outline" size="sm" onClick={onChoose}>
            {note ? "Cambiar" : "Elegir"}
          </Button>
          {note && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={`Subir ${name}`}
                disabled={index === 0}
                onClick={() => onMove(index - 1)}
              >
                <ArrowUp className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={`Bajar ${name}`}
                disabled={index === SLOT_COUNT - 1}
                onClick={() => onMove(index + 1)}
              >
                <ArrowDown className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto size-8"
                aria-label={`Quitar ${name}`}
                onClick={onClear}
              >
                <X className="size-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

function UntilField({
  until,
  expired,
  onSave,
}: {
  until: string | null;
  expired: boolean;
  onSave: (until: string | null) => void;
}) {
  const saved = toLocalInput(until);
  const [draft, setDraft] = useState(saved);
  useEffect(() => setDraft(saved), [saved]);

  return (
    <label className="text-[0.8125rem] text-muted-foreground">
      {expired ? "Venció" : "Hasta"}
      <Input
        type="datetime-local"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
        onBlur={() => {
          // Typing a date passes through empty and half-written values. Only "Quitar" removes.
          if (!draft) setDraft(saved);
          else if (draft !== saved) onSave(fromLocalInput(draft));
        }}
        className="mt-1 h-9 rounded-lg text-sm text-foreground md:text-sm"
      />
    </label>
  );
}

function Breaking() {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const { data, isPending, isError } = useQuery({
    queryKey: ["admin", "breaking"],
    queryFn: fetchBreaking,
  });

  const change = useMutation({
    mutationFn: ({ id, until }: { id: string; until: string | null }) => setBreaking(id, until),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "breaking"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
    },
    onError: (error) => toast.error(error.message),
  });

  const now = Date.now();

  return (
    <section id="ultima-hora" className="scroll-mt-20 rounded-2xl border bg-card p-5 lg:col-span-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Última hora</h2>
        <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
          Agregar
        </Button>
      </div>
      <p className="mt-1 text-muted-foreground">
        Salen solas al vencer. Por defecto duran 24 horas.
      </p>
      {isPending && <Skeleton className="mt-3 h-24" />}
      {isError && (
        <p role="alert" className="mt-3 text-destructive-text">
          No pudimos cargar la última hora.
        </p>
      )}
      {data?.length === 0 && <p className="mt-3 text-muted-foreground">No hay ninguna ahora.</p>}
      <ul className="mt-2">
        {data?.map((note) => {
          const expired = note.breaking_until
            ? new Date(note.breaking_until).getTime() < now
            : false;
          return (
            <li key={note.id} className="border-t py-3 first:border-t-0">
              <p className="font-medium">{note.title}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <UntilField
                  until={note.breaking_until}
                  expired={expired}
                  onSave={(until) => change.mutate({ id: note.id, until })}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="self-end"
                  disabled={change.isPending}
                  onClick={() => change.mutate({ id: note.id, until: null })}
                >
                  Quitar
                </Button>
              </div>
              {!note.breaking_until && (
                <p className="mt-1 text-[0.8125rem] text-warning">
                  Sin vencimiento. Elegí hasta cuándo o quitala.
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <NotePicker
        open={adding}
        onOpenChange={setAdding}
        title="Agregar a última hora"
        exclude={data?.map((note) => note.id) ?? []}
        onPick={(note) => change.mutate({ id: note.id, until: inHours(24) })}
      />
    </section>
  );
}

function HomepagePage() {
  const queryClient = useQueryClient();
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["admin", "homepage-slots"],
    queryFn: fetchSlots,
  });
  const [slots, setSlots] = useState<(SlotNote | null)[]>(Array(SLOT_COUNT).fill(null));
  const [dirty, setDirty] = useState(false);
  const [choosing, setChoosing] = useState<number | null>(null);

  useEffect(() => {
    if (data && !dirty) setSlots(data);
    // Only fresh data replaces the screen, and never over changes not yet saved.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // The chosen notes above it take their height only once loaded.
  useEffect(() => {
    if (!isPending && window.location.hash === "#ultima-hora") {
      document.getElementById("ultima-hora")?.scrollIntoView();
    }
  }, [isPending]);

  const edit = (next: (SlotNote | null)[]) => {
    setSlots(next);
    setDirty(true);
  };

  const save = useMutation({
    mutationFn: () => saveSlots(slots),
    onSuccess: () => {
      setDirty(false);
      toast.success("Portada actualizada.");
      void queryClient.invalidateQueries({ queryKey: ["admin", "homepage-slots"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
    },
    onError: (error) => toast.error(error.message),
  });

  const slotProps = (index: number) => ({
    index,
    note: slots[index] ?? null,
    onChoose: () => setChoosing(index),
    onClear: () => edit(slots.map((note, position) => (position === index ? null : note))),
    onMove: (to: number) => edit(moveSlot(slots, index, to)),
    onDropFrom: (from: number) => edit(moveSlot(slots, from, index)),
  });

  return (
    <>
      <header className="mb-5 flex min-h-10 flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Portada</h1>
        <p aria-live="polite" className="text-muted-foreground">
          {dirty ? "Cambios sin guardar" : "Lo que ves es lo que hay en el sitio"}
        </p>
        <Button
          size="lg"
          className="ml-auto rounded-lg px-4"
          disabled={!dirty || save.isPending}
          onClick={() => save.mutate()}
        >
          {save.isPending ? "Guardando…" : "Guardar portada"}
        </Button>
      </header>

      <div className="grid items-start gap-4 lg:grid-cols-12">
        <section className="lg:col-span-8">
          <h2 className="text-lg font-semibold">Notas elegidas</h2>
          <p className="mt-1 text-muted-foreground">
            Arrastrá una nota a otro lugar, o usá las flechas. “Lo más reciente” y la tira de arriba
            siguen por fecha.
          </p>
          {isError ? (
            <div role="alert" className="mt-4 flex flex-wrap items-center gap-3">
              <p>No pudimos cargar la portada.</p>
              <Button variant="outline" size="sm" onClick={() => void refetch()}>
                Reintentar
              </Button>
            </div>
          ) : isPending ? (
            <Skeleton className="mt-4 h-96" />
          ) : (
            <div className="mt-4 space-y-3">
              <Slot {...slotProps(0)} large />
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: SLOT_COUNT - 1 }, (_, offset) => (
                  <Slot key={offset + 1} {...slotProps(offset + 1)} />
                ))}
              </div>
            </div>
          )}
        </section>
        <Breaking />
      </div>

      <NotePicker
        open={choosing !== null}
        onOpenChange={(open) => !open && setChoosing(null)}
        title={choosing === 0 ? "Elegir nota principal" : "Elegir destacada"}
        exclude={slots.flatMap((note) => (note ? [note.id] : []))}
        onPick={(note) =>
          edit(slots.map((current, position) => (position === choosing ? note : current)))
        }
      />
    </>
  );
}
