import { Link, useLocation } from "@tanstack/react-router";
import { X } from "lucide-react";
import { STATION_NAME, songText, stopRadio, useNowPlaying, useRadio } from "@/lib/radio";
import { Equalizer, RadioPlayButton } from "./RadioControls";

export function MiniPlayer() {
  const { status } = useRadio();
  const { pathname } = useLocation();
  const started = status !== "idle";
  const nowPlaying = useNowPlaying(started);

  if (!started || pathname === "/radio") return null;

  return (
    <>
      {/* Keeps the end of the page reachable above the fixed bar. */}
      <div aria-hidden className="h-16" />
      <aside
        data-mini-player
        aria-label="Reproductor de radio"
        className="glass animate-in slide-in-from-bottom fixed inset-x-0 bottom-0 z-40 border-t duration-300 ease-out"
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <RadioPlayButton className="size-11" />
          <Equalizer active={status === "playing"} className="h-5 text-primary" />
          <Link to="/radio" className="min-w-0 flex-1 hover:underline">
            <span className="block truncate text-sm font-bold">{STATION_NAME}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {songText(nowPlaying) ?? "Programación en vivo"}
            </span>
          </Link>
          <button
            type="button"
            onClick={stopRadio}
            aria-label="Cerrar reproductor"
            className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X aria-hidden className="size-5" />
          </button>
        </div>
      </aside>
    </>
  );
}
