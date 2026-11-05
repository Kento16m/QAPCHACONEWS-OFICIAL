import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CornerDownLeft, FileText, Search, User, Zap } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useDebouncedValue } from "@/hooks/use-news";
import { cn } from "@/lib/utils";
import { listArticles } from "../../lib/articles";
import { listUsers } from "../../lib/manage";
import { paletteResults } from "../../lib/palette";

const ICONS = { action: Zap, note: FileText, user: User };

export function CommandPalette({ role }: { role: "editor" | "admin" }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const term = useDebouncedValue(q.trim(), 200);

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const notes = useQuery({
    queryKey: ["admin", "palette-notes", term],
    queryFn: () => listArticles({ page: 1, q: term }),
    enabled: open && term.length >= 2,
  });
  const users = useQuery({
    queryKey: ["admin", "palette-users", term],
    queryFn: () => listUsers(1, term),
    enabled: open && role === "admin" && term.length >= 2,
  });

  const items = useMemo(
    () =>
      paletteResults(
        q,
        role,
        term.length >= 2 ? (notes.data?.rows.slice(0, 6) ?? []) : [],
        term.length >= 2 ? (users.data?.rows.slice(0, 4) ?? []) : [],
      ),
    [q, role, term, notes.data, users.data],
  );

  const go = (index: number) => {
    const item = items[index];
    if (!item) return;
    setOpen(false);
    setQ("");
    void navigate({ href: item.to });
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((value) => Math.min(value + 1, items.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((value) => Math.max(value - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      go(active);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden h-10 w-full max-w-md items-center gap-2.5 rounded-lg border border-input bg-card px-3 text-muted-foreground transition-colors duration-150 hover:bg-muted md:flex"
      >
        <Search className="size-4 shrink-0" aria-hidden />
        <span className="truncate">Buscar notas, usuarios o acciones</span>
        <kbd className="ml-auto rounded-md border font-sans bg-background px-1.5 py-0.5 text-xs">
          Ctrl K
        </kbd>
      </button>
      <button
        type="button"
        aria-label="Buscar"
        onClick={() => setOpen(true)}
        className="flex size-10 items-center justify-center rounded-lg border border-input text-muted-foreground md:hidden"
      >
        <Search className="size-5" aria-hidden />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-[20%] max-w-xl translate-y-0 gap-0 p-0">
          <DialogTitle className="sr-only">Búsqueda rápida</DialogTitle>
          <div className="flex items-center gap-2.5 border-b px-4">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <input
              autoFocus
              role="combobox"
              aria-expanded
              aria-controls="palette-results"
              aria-activedescendant={items[active] ? `palette-${active}` : undefined}
              aria-label="Buscar notas, usuarios o acciones"
              placeholder="Buscar notas, usuarios o acciones"
              value={q}
              onChange={(event) => {
                setQ(event.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              className="h-12 w-full bg-transparent outline-none placeholder:text-muted-foreground"
            />
          </div>
          <ul id="palette-results" role="listbox" className="max-h-[50svh] overflow-y-auto p-2">
            {items.length === 0 && (
              <li className="p-4 text-center text-muted-foreground">Nada coincide con eso.</li>
            )}
            {items.map((item, index) => {
              const Icon = ICONS[item.kind];
              return (
                <li
                  key={`${item.kind}-${item.id}`}
                  id={`palette-${index}`}
                  role="option"
                  aria-selected={index === active}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => go(index)}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2",
                    index === active && "bg-accent text-accent-foreground",
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  <span className={cn("min-w-0 truncate", !item.detail && "flex-1")}>
                    {item.label}
                  </span>
                  {item.detail && (
                    <span className="min-w-0 flex-1 truncate text-right text-[0.8125rem] text-muted-foreground">
                      {item.detail}
                    </span>
                  )}
                  {index === active && <CornerDownLeft className="size-4 shrink-0" aria-hidden />}
                </li>
              );
            })}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
