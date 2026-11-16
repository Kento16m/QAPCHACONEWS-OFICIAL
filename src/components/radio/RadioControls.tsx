import { LoaderCircle, Pause, Play } from "lucide-react";
import { toggleRadio, useRadio, type RadioStatus } from "@/lib/radio";
import { cn } from "@/lib/utils";

const ICON_CLASS =
  "absolute inset-0 m-auto size-[45%] transition duration-200 ease-out motion-reduce:transition-none";

const isBusy = (status: RadioStatus) => status === "loading" || status === "reconnecting";

export function RadioPlayButton({ className }: { className?: string }) {
  const { status } = useRadio();
  const busy = isBusy(status);
  const showPause = status === "playing";
  const showPlay = !busy && !showPause;

  return (
    <button
      type="button"
      onClick={toggleRadio}
      aria-label={busy || showPause ? "Pausar radio" : "Reproducir radio"}
      className={cn(
        "relative shrink-0 cursor-pointer rounded-full bg-primary text-primary-foreground shadow-soft transition-transform duration-150 ease-out hover:scale-105 active:scale-95",
        className,
      )}
    >
      <Play
        aria-hidden
        className={cn(
          ICON_CLASS,
          "fill-current translate-x-[6%]",
          showPlay ? "scale-100 opacity-100" : "scale-50 opacity-0",
        )}
      />
      <Pause
        aria-hidden
        className={cn(
          ICON_CLASS,
          "fill-current",
          showPause ? "scale-100 opacity-100" : "scale-50 opacity-0",
        )}
      />
      <LoaderCircle
        aria-hidden
        className={cn(ICON_CLASS, busy ? "animate-spin opacity-100" : "opacity-0")}
      />
    </button>
  );
}

export function LiveDot({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("relative flex size-1.5", className)}>
      <span className="absolute inset-0 animate-ping rounded-full bg-current opacity-75" />
      <span className="relative size-1.5 rounded-full bg-current" />
    </span>
  );
}

const BARS = ["0s", "-0.45s", "-0.2s", "-0.7s"];

// Bars instead of a real analyser: Web Audio would make playback depend on the stream's CORS header,
// and iOS can mute it with the screen locked.
export function Equalizer({ active, className }: { active: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex items-end gap-[3px] transition-opacity duration-200 ease-out motion-reduce:hidden",
        !active && "opacity-0",
        className,
      )}
    >
      {BARS.map((delay) => (
        <span
          key={delay}
          style={{ animationDelay: delay }}
          className={cn(
            "h-full w-[3px] origin-bottom scale-y-[0.25] rounded-full bg-current",
            active && "animate-equalizer",
          )}
        />
      ))}
    </span>
  );
}
