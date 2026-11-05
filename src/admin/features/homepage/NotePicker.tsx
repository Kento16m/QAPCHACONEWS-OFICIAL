import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ImageOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/hooks/use-news";
import { searchPublished, type SlotNote } from "../../lib/homepage-admin";
import { Skeleton } from "../../ui/Field";

export function NotePicker({
  open,
  title,
  exclude,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  title: string;
  exclude: string[];
  onOpenChange: (open: boolean) => void;
  onPick: (note: SlotNote) => void;
}) {
  const [term, setTerm] = useState("");
  const debounced = useDebouncedValue(term, 300);
  const { data, isPending, isError } = useQuery({
    queryKey: ["admin", "published-search", debounced],
    queryFn: () => searchPublished(debounced),
    enabled: open,
  });
  const notes = data?.filter((note) => !exclude.includes(note.id)) ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Solo aparecen notas publicadas.</DialogDescription>
        </DialogHeader>
        <Input
          type="search"
          autoFocus
          aria-label="Buscar nota"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Buscar por título"
        />
        <ul className="max-h-[50svh] overflow-y-auto">
          {open && isPending && <Skeleton className="h-40" />}
          {isError && (
            <li role="alert" className="py-3 text-destructive-text">
              No pudimos buscar las notas.
            </li>
          )}
          {!isPending && notes.length === 0 && !isError && (
            <li className="py-3 text-muted-foreground">Ninguna nota coincide.</li>
          )}
          {notes.map((note) => (
            <li key={note.id}>
              <button
                type="button"
                onClick={() => {
                  onPick(note);
                  onOpenChange(false);
                  setTerm("");
                }}
                className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors duration-150 hover:bg-muted"
              >
                {note.cover_image_url ? (
                  <img
                    src={note.cover_image_url}
                    alt=""
                    loading="lazy"
                    className="h-11 w-16 shrink-0 rounded-md bg-muted object-cover"
                  />
                ) : (
                  <span className="flex h-11 w-16 shrink-0 items-center justify-center rounded-md bg-muted">
                    <ImageOff className="size-4" aria-hidden />
                  </span>
                )}
                <span className="font-medium">{note.title}</span>
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
