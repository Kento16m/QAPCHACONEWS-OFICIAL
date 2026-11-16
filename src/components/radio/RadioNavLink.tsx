import { Link } from "@tanstack/react-router";
import { Radio } from "lucide-react";
import { ON_AIR_HOURS, useNowPlaying, useRadio } from "@/lib/radio";
import { cn } from "@/lib/utils";
import { Equalizer, LiveDot, RadioPlayButton } from "./RadioControls";

// The radio's entry in the header: plays right there, and the name opens the radio page.
export function RadioNavLink({ className }: { className?: string }) {
  const { status } = useRadio();
  const nowPlaying = useNowPlaying(true);
  const playing = status === "playing";
  // Off the air a play button could only spin through the retries and fail.
  const offAir = nowPlaying?.online === false && status === "idle";

  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-2 rounded-full border border-navy-border bg-navy py-1 pl-1 pr-3 text-navy-foreground shadow-soft max-[359px]:pr-1",
        // Too narrow for the name, and off the air a lone icon would do nothing.
        offAir && "max-[359px]:hidden",
        className,
      )}
    >
      {offAir ? (
        <span aria-hidden className="grid size-8 place-items-center rounded-full bg-navy-border">
          <Radio className="size-4 text-navy-muted" />
        </span>
      ) : (
        <RadioPlayButton className="size-8" />
      )}
      <Link to="/radio" className="leading-tight hover:underline max-[359px]:hidden">
        <span className="block text-[11px] font-extrabold uppercase tracking-[0.14em]">
          Radio QAP
        </span>
        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-navy-muted">
          {playing ? (
            <Equalizer active className="h-2.5 text-primary" />
          ) : (
            !offAir && <LiveDot className="text-primary" />
          )}
          {playing ? "Sonando" : offAir ? ON_AIR_HOURS : "En vivo"}
        </span>
      </Link>
    </div>
  );
}
