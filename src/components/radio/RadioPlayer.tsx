import { Volume1, Volume2, VolumeX } from "lucide-react";
import { useState } from "react";
import {
  ON_AIR_HOURS,
  STATION_NAME,
  canChangeVolume,
  setRadioVolume,
  songText,
  useNowPlaying,
  useRadio,
  type RadioStatus,
} from "@/lib/radio";
import { Equalizer, LiveDot, RadioPlayButton } from "./RadioControls";

const statusText = (status: RadioStatus, online: boolean | undefined) => {
  switch (status) {
    case "loading":
      return "Conectando…";
    case "playing":
      return "Sonando";
    case "paused":
      return "En pausa";
    case "reconnecting":
      return "Sin conexión. Reintentando…";
    case "failed":
      return online === false
        ? `La radio no está al aire. Salimos ${ON_AIR_HOURS}.`
        : "Sin conexión. Revisá tu internet y tocá play para reintentar.";
    default:
      return online === false
        ? `Ahora no estamos al aire. Salimos ${ON_AIR_HOURS}.`
        : "Tocá play para escuchar";
  }
};

function LiveBadge({ online }: { online: boolean | undefined }) {
  if (online === undefined)
    return (
      <span className="inline-flex rounded-full bg-navy-border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-navy-muted">
        Comprobando señal
      </span>
    );
  if (!online)
    return (
      <span className="inline-flex rounded-full bg-navy-border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-navy-foreground">
        Fuera del aire
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-primary-foreground">
      <LiveDot />
      En vivo
    </span>
  );
}

function VolumeControl() {
  const { volume } = useRadio();
  // Only runs on the first render; iOS has no page-controlled volume, so no dead slider there.
  const [available] = useState(canChangeVolume);
  if (!available) return null;
  const Icon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <label className="flex h-11 w-full max-w-64 items-center gap-3 text-navy-muted">
      <Icon aria-hidden className="size-5 shrink-0" />
      <span className="sr-only">Volumen</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={volume}
        onChange={(event) => setRadioVolume(Number(event.target.value))}
        className="h-11 w-full cursor-pointer accent-primary [color-scheme:dark] focus-visible:outline-navy-foreground"
      />
    </label>
  );
}

export function RadioPlayer() {
  const { status } = useRadio();
  const nowPlaying = useNowPlaying(true);
  const online = status === "playing" ? true : nowPlaying?.online;
  const song = songText(nowPlaying) ?? "Programación en vivo";

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <section className="bg-auth-panel animate-in fade-in slide-in-from-bottom-2 grid gap-6 rounded-3xl p-6 text-navy-foreground duration-300 ease-out sm:p-10 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] md:items-center md:gap-10">
        <img
          src="/radio-cover.webp"
          alt="Logo de QAP ChacoNews"
          width={512}
          height={512}
          fetchPriority="high"
          className="mx-auto aspect-square size-40 rounded-2xl shadow-lift sm:size-56 md:h-auto md:w-full"
        />

        <div className="flex min-w-0 flex-col items-center text-center md:items-start md:text-left">
          <LiveBadge online={online} />
          <h1 className="mt-3 font-display text-3xl font-bold leading-tight text-balance sm:text-4xl lg:text-[2.75rem]">
            {STATION_NAME}
          </h1>

          <div className="mt-5 min-h-[3.25rem] w-full">
            <h2 className="text-sm font-semibold text-navy-muted">Ahora suena</h2>
            <p aria-live="polite" className="mt-1 overflow-hidden text-lg font-semibold">
              <span
                key={song}
                className="animate-in fade-in slide-in-from-bottom-1 block break-words duration-300 ease-out"
              >
                {song}
              </span>
            </p>
          </div>

          <div className="mt-5 flex items-center gap-4">
            <RadioPlayButton className="size-20 focus-visible:outline-navy-foreground" />
            <Equalizer active={status === "playing"} className="h-8 text-primary-foreground" />
          </div>

          <p role="status" className="mt-3 min-h-5 text-sm text-navy-muted">
            {statusText(status, online)}
          </p>

          <div className="mt-3 flex w-full justify-center md:justify-start">
            <VolumeControl />
          </div>
        </div>
      </section>
    </div>
  );
}
