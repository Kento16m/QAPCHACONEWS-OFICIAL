import type { ReactElement } from "react";
import type { HourlyForecastPoint } from "@/lib/weather";
import { useMemo, useState } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { fetchWeatherSnapshotForCity } from "@/lib/weather";

type ThemeMode = "dark" | "light";

type CityWeather = {
  id: string;
  name: string;
  state: string;
  condition: string;
  temp: number;
  min: number;
  max: number;
  feelsLike: number;
  humidity: number;
  wind: number;
  uv: number;
  visibility: number;
  rain: number;
  sunrise: string;
  sunset: string;
  airQuality: number;
  avgHigh: number;
  avgLow: number;
};

type WeatherGlyph =
  | "sun"
  | "sun-cloud"
  | "moon"
  | "cloud"
  | "cloud-sun"
  | "cloud-moon"
  | "overcast"
  | "fog"
  | "rain-light"
  | "rain"
  | "rain-heavy"
  | "showers"
  | "storm"
  | "storm-electric"
  | "snow"
  | "hail"
  | "wind"
  | "droplet"
  | "sparkles";

type DailyForecast = {
  day: string;
  icon: WeatherGlyph;
  condition: string;
  high: number;
  low: number;
  progress: number;
};

type MetricCard = {
  key: string;
  label: string;
  value: string;
  description: string;
  icon: "sun" | "cloud" | "rain" | "wind" | "droplet" | "eye" | "thermometer" | "sparkles";
};

const cities = [
  { id: "Asuncion,PY", label: "Asunción" },
  { id: "Mariscal Estigarribia,PY", label: "Mariscal Estigarribia" },
  { id: "Ciudad del Este,PY", label: "Ciudad del Este" },
  { id: "Encarnacion,PY", label: "Encarnación" },
  { id: "Concepcion,PY", label: "Concepción" },
  { id: "Pedro Juan Caballero,PY", label: "Pedro Juan Caballero" },
] as const;
const weatherIcons = {
  sun: (
    <svg
      viewBox="0 0 24 24"
      className="h-full w-full"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2v2.2M12 19.8V22M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2 12h2.2M19.8 12H22M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6" />
    </svg>
  ),
  "sun-cloud": (
    <svg
      viewBox="0 0 24 24"
      className="h-full w-full"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle cx="12" cy="8" r="3.4" />
      <path d="M12 2v1.6M12 14.4V22M6.5 5.5l1.1 1.1M16.4 15.4l1.1 1.1M2 8h1.9M20.1 8H22M5 12.2l1.2-1.2M17.8 12.2l1.2-1.2" />
      <path d="M8.5 18h7.2a3.8 3.8 0 0 0 .4-7.6A5.3 5.3 0 0 0 7 12.5 3.3 3.3 0 0 0 8.5 18Z" />
    </svg>
  ),
  moon: (
    <svg
      viewBox="0 0 24 24"
      className="h-full w-full"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M19 15.4A7.5 7.5 0 0 1 8.6 5 7.5 7.5 0 1 0 19 15.4Z" />
    </svg>
  ),
  cloud: (
    <svg
      viewBox="0 0 24 24"
      className="h-full w-full"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M7 18h9.2a3.8 3.8 0 0 0 .5-7.6A5.4 5.4 0 0 0 6.7 12a3.3 3.3 0 0 0 .3 6Z" />
    </svg>
  ),
  "cloud-sun": (
    <svg
      viewBox="0 0 24 24"
      className="h-full w-full"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle cx="9.2" cy="8" r="3.2" />
      <path d="M9.2 2.6v1.7M9.2 13.7v1.7M5.1 5.4l1.1 1.1M13.3 13.6l1.2 1.2M2.9 8.1h1.7M15.6 8.1h1.7M5.1 12.2l1.1-1.1M13.3 10.9l1.2-1.2" />
      <path d="M7.7 17.8h8.8a3.8 3.8 0 0 0 .2-7.6A5.4 5.4 0 0 0 7 12.1a3.2 3.2 0 0 0 .7 5.7Z" />
    </svg>
  ),
  "cloud-moon": (
    <svg
      viewBox="0 0 24 24"
      className="h-full w-full"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M14.2 4.5A5.4 5.4 0 0 0 9 9.3a5.6 5.6 0 0 0 9.6 3.4 5.2 5.2 0 0 1-4.4-8.2Z" />
      <path d="M7.4 18h8.7a3.8 3.8 0 0 0 .4-7.6A5.4 5.4 0 0 0 7 12.1a3.3 3.3 0 0 0 .4 5.9Z" />
    </svg>
  ),
  overcast: (
    <svg
      viewBox="0 0 24 24"
      className="h-full w-full"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M4.5 17.5h12.8a3.9 3.9 0 0 0 .4-7.8A5.1 5.1 0 0 0 7.4 7.5 4 4 0 0 0 4.5 17.5Z" />
      <path d="M18 18.7h1.2" />
    </svg>
  ),
  fog: (
    <svg
      viewBox="0 0 24 24"
      className="h-full w-full"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M4 9.8h14M4 13h14M4 16.2h10" />
      <path d="M7 6.5h10.5" />
    </svg>
  ),
  "rain-light": (
    <svg
      viewBox="0 0 24 24"
      className="h-full w-full"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M7 18h9.2a3.8 3.8 0 0 0 .5-7.6A5.4 5.4 0 0 0 6.7 12a3.3 3.3 0 0 0 .3 6Z" />
      <path d="M9 18.3v2M12 18.3v2.3M15 18.3v2" />
    </svg>
  ),
  rain: (
    <svg
      viewBox="0 0 24 24"
      className="h-full w-full"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M7 18h9.2a3.8 3.8 0 0 0 .5-7.6A5.4 5.4 0 0 0 6.7 12a3.3 3.3 0 0 0 .3 6Z" />
      <path d="M8.5 18.5v2.2M12 18.5v2.6M15.5 18.5v2.2" />
    </svg>
  ),
  "rain-heavy": (
    <svg
      viewBox="0 0 24 24"
      className="h-full w-full"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M7 18h9.2a3.8 3.8 0 0 0 .5-7.6A5.4 5.4 0 0 0 6.7 12a3.3 3.3 0 0 0 .3 6Z" />
      <path d="M8 20.1 7 22M12 19.8l-1.5 2.8M16 20.1l-1.4 2.8" />
    </svg>
  ),
  showers: (
    <svg
      viewBox="0 0 24 24"
      className="h-full w-full"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M8 18h9a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.6 1.8A3.5 3.5 0 0 0 8 18Z" />
      <path d="M9 19.5v2M12.2 19.5v2M15.5 19.5v2" />
    </svg>
  ),
  storm: (
    <svg
      viewBox="0 0 24 24"
      className="h-full w-full"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M7 18h9a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.5 1.7A3.5 3.5 0 0 0 7 18Z" />
      <path d="M12 18 10.2 14.8H13l-1.5-3.2H15l-2.5 3.3h1.8L12 18Z" />
    </svg>
  ),
  "storm-electric": (
    <svg
      viewBox="0 0 24 24"
      className="h-full w-full"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M7 18h9a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.5 1.7A3.5 3.5 0 0 0 7 18Z" />
      <path d="M12.4 14.2h2.8L12.8 18l1.3 0-2 3.4-1.2-3.1h-2l2-4.1Z" />
    </svg>
  ),
  snow: (
    <svg
      viewBox="0 0 24 24"
      className="h-full w-full"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M7 18h9.2a3.8 3.8 0 0 0 .5-7.6A5.4 5.4 0 0 0 6.7 12a3.3 3.3 0 0 0 .3 6Z" />
      <path d="M12 16v3M10.2 17.2l3.6 0M9 18.8l6 0M12 19v3" />
    </svg>
  ),
  hail: (
    <svg
      viewBox="0 0 24 24"
      className="h-full w-full"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M7 18h9.2a3.8 3.8 0 0 0 .5-7.6A5.4 5.4 0 0 0 6.7 12a3.3 3.3 0 0 0 .3 6Z" />
      <circle cx="9.2" cy="19.1" r="0.9" />
      <circle cx="12.1" cy="20.1" r="0.9" />
      <circle cx="15.1" cy="19.1" r="0.9" />
    </svg>
  ),
  wind: (
    <svg
      viewBox="0 0 24 24"
      className="h-full w-full"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M3 9h10a3 3 0 0 1 0 6H8M3 15h12a3 3 0 1 0 0-6H6" />
    </svg>
  ),
  droplet: (
    <svg
      viewBox="0 0 24 24"
      className="h-full w-full"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M12 2.5c2.8 3 5 5.5 5 8.3A5 5 0 0 1 7 11c0-2.8 2.2-5.3 5-8.5Z" />
    </svg>
  ),
  eye: (
    <svg
      viewBox="0 0 24 24"
      className="h-full w-full"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  thermometer: (
    <svg
      viewBox="0 0 24 24"
      className="h-full w-full"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M14 4.5a2 2 0 1 0-4 0V13a4 4 0 1 0 4 0V4.5Z" />
      <path d="M12 17v3.5" />
    </svg>
  ),
  sparkles: (
    <svg
      viewBox="0 0 24 24"
      className="h-full w-full"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M12 2.5 13.8 8l5.7 1.8-5.7 1.8L12 18.5l-1.8-6.9L4.5 9.8 10.2 8 12 2.5Z" />
    </svg>
  ),
} satisfies Record<string, ReactElement>;

function mapWeatherCodeToIcon(code?: string): WeatherGlyph {
  const normalized = (code ?? "01d").toLowerCase();

  if (normalized === "01d") return "sun";
  if (normalized === "01n") return "moon";
  if (normalized === "02d") return "sun-cloud";
  if (normalized === "02n") return "cloud-moon";
  if (normalized === "03d" || normalized === "03n") return "cloud";
  if (normalized === "04d" || normalized === "04n") return "overcast";
  if (normalized === "09d" || normalized === "09n") return "rain-light";
  if (normalized === "10d") return "rain";
  if (normalized === "10n") return "rain";
  if (normalized === "11d" || normalized === "11n") return "storm-electric";
  if (normalized === "13d" || normalized === "13n") return "snow";
  if (normalized === "50d" || normalized === "50n") return "fog";

  return normalized.endsWith("n") ? "moon" : "sun";
}

function WeatherIcon({
  type,
  size = "md",
  variant = "plain",
}: {
  type: WeatherGlyph | string | undefined;
  size?: "sm" | "md" | "lg";
  variant?: "plain" | "badge";
}) {
  const safeType = (type && type in weatherIcons ? type : "sun") as keyof typeof weatherIcons;
  const sizeClass = {
    sm: "h-5 w-5 sm:h-6 sm:w-6",
    md: "h-7 w-7 sm:h-8 sm:w-8",
    lg: "h-9 w-9 sm:h-10 sm:w-10",
  }[size];

  const paletteClass =
    {
      sun: "text-amber-300",
      "sun-cloud": "text-amber-300",
      moon: "text-sky-200",
      cloud: "text-slate-300",
      "cloud-sun": "text-amber-300",
      "cloud-moon": "text-sky-200",
      overcast: "text-slate-300",
      fog: "text-slate-300",
      "rain-light": "text-cyan-300",
      rain: "text-cyan-400",
      "rain-heavy": "text-cyan-500",
      showers: "text-cyan-400",
      storm: "text-indigo-300",
      "storm-electric": "text-violet-300",
      snow: "text-cyan-100",
      hail: "text-sky-200",
      wind: "text-slate-200",
      droplet: "text-cyan-300",
      eye: "text-sky-300",
      thermometer: "text-orange-300",
      sparkles: "text-violet-300",
    }[safeType] ?? "text-amber-300";

  const badgeClass =
    variant === "badge"
      ? "rounded-2xl bg-slate-900/60 p-2 ring-1 ring-white/10 shadow-[0_0_18px_rgba(56,189,248,0.18)]"
      : "bg-transparent";

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center drop-shadow-[0_0_18px_rgba(56,189,248,0.24)]",
        sizeClass,
        badgeClass,
        paletteClass,
      )}
    >
      {weatherIcons[safeType]}
    </span>
  );
}

function SearchInput({ isDark }: { isDark: boolean }) {
  return (
    <div className="relative">
      <input
        placeholder="Buscar ciudad o municipio..."
        className={cn(
          "h-11 w-full rounded-full border pl-11 pr-4 text-sm outline-none ring-0 transition",
          isDark
            ? "border-slate-700/80 bg-slate-900/60 text-slate-100 placeholder:text-slate-400 focus:border-slate-500"
            : "border-slate-200 bg-slate-200/90 text-slate-700 placeholder:text-slate-500 focus:border-sky-300",
        )}
      />
      <span
        className={cn(
          "pointer-events-none absolute left-4 top-1/2 -translate-y-1/2",
          isDark ? "text-slate-400" : "text-slate-500",
        )}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="6" />
          <path d="m16 16 5 5" />
        </svg>
      </span>
    </div>
  );
}

function CitySelectorButton({
  city,
  active,
  onSelect,
  previewTemp,
  previewMax,
  previewMin,
  previewState,
  isDark,
}: {
  city: { id: string; label: string };
  active: boolean;
  onSelect: (id: string) => void;
  previewTemp?: number | null;
  previewMax?: number | null;
  previewMin?: number | null;
  previewState?: string | null;
  isDark: boolean;
}) {
  const tempDisplay = typeof previewTemp === "number" ? `${previewTemp}°` : "--°";
  const highDisplay = typeof previewMax === "number" ? `H:${previewMax}°` : "H:--°";
  const lowDisplay = typeof previewMin === "number" ? `L:${previewMin}°` : "L:--°";
  const stateText = previewState ?? "Sin datos";

  return (
    <button
      type="button"
      onClick={() => onSelect(city.id)}
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-2xl border px-3 py-3 text-left transition-all",
        active
          ? isDark
            ? "border-sky-400/40 bg-sky-500/10 shadow-[inset_0_0_0_1px_rgba(125,211,252,0.18)]"
            : "border-sky-300 bg-sky-50 shadow-[inset_0_0_0_1px_rgba(125,211,252,0.28)]"
          : isDark
            ? "border-slate-700/50 bg-slate-900/40 hover:bg-slate-800/70"
            : "border-slate-200 bg-slate-200/80 hover:bg-slate-300/60",
      )}
    >
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "truncate text-sm font-medium sm:text-base",
            isDark ? "text-slate-100" : "text-slate-800",
          )}
        >
          {city.label}
        </div>
        <div
          className={cn(
            "mt-1 truncate text-[10px] sm:text-xs",
            isDark ? "text-slate-400" : "text-slate-500",
          )}
        >
          {stateText}
        </div>
      </div>

      <div className="shrink-0 text-right">
        <div
          className={cn(
            "text-xl font-light sm:text-2xl",
            isDark ? "text-slate-100" : "text-slate-800",
          )}
        >
          {tempDisplay}
        </div>
        <div
          className={cn(
            "mt-1 flex items-center gap-2 text-[9px] sm:text-[10px]",
            isDark ? "text-slate-400" : "text-slate-500",
          )}
        >
          <span>{highDisplay}</span>
          <span>{lowDisplay}</span>
        </div>
      </div>
    </button>
  );
}

function mapWeatherCodeToFontIcon(code?: string): string {
  const normalized = (code ?? "01d").toLowerCase();

  if (normalized === "01d" || normalized === "sun") return "wi wi-day-sunny";
  if (normalized === "01n" || normalized === "moon") return "wi wi-night-clear";
  if (normalized === "02d" || normalized === "sun-cloud") return "wi wi-day-cloudy";
  if (normalized === "02n" || normalized === "cloud-moon") return "wi wi-night-alt-cloudy";
  if (normalized === "03d" || normalized === "03n" || normalized === "cloud") return "wi wi-cloud";
  if (normalized === "04d" || normalized === "04n" || normalized === "overcast")
    return "wi wi-cloudy";
  if (normalized === "09d" || normalized === "09n" || normalized === "rain-light")
    return "wi wi-showers";
  if (normalized === "10d" || normalized === "rain") return "wi wi-day-rain";
  if (normalized === "10n") return "wi wi-night-alt-rain";
  if (normalized === "11d" || normalized === "11n" || normalized === "storm-electric")
    return "wi wi-thunderstorm";
  if (normalized === "13d" || normalized === "13n" || normalized === "snow") return "wi wi-snow";
  if (normalized === "50d" || normalized === "50n" || normalized === "fog") return "wi wi-fog";
  if (normalized === "storm") return "wi wi-storm-showers";
  if (normalized === "showers") return "wi wi-showers";
  if (normalized === "hail") return "wi wi-hail";
  if (normalized === "wind") return "wi wi-windy";

  return normalized.endsWith("n") ? "wi wi-night-clear" : "wi wi-day-sunny";
}

function HourlyCard({ item, isDark }: { item: HourlyForecastPoint; isDark: boolean }) {
  return (
    <div
      className={cn(
        "min-w-[76px] shrink-0 rounded-2xl border px-2.5 py-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
        isDark
          ? "border-slate-700/60 bg-gradient-to-b from-slate-900/80 to-slate-800/60"
          : "border-slate-200 bg-gradient-to-b from-slate-100 to-slate-200",
      )}
    >
      <div
        className={cn(
          "text-[10px] font-semibold uppercase tracking-[0.12em]",
          isDark ? "text-slate-400" : "text-slate-500",
        )}
      >
        {item.label}
      </div>
      <div className={cn("mt-2 flex justify-center", isDark ? "text-slate-100" : "text-slate-700")}>
        <span
          className={cn(
            "text-2xl leading-none",
            isDark ? "text-cyan-300" : "text-cyan-600",
            mapWeatherCodeToFontIcon(item.icon),
          )}
          aria-hidden="true"
        />
      </div>
      <div
        className={cn("mt-2 text-lg font-semibold", isDark ? "text-slate-100" : "text-slate-800")}
      >
        {item.temp}°
      </div>
    </div>
  );
}

function DailyForecastRow({ item, isDark }: { item: DailyForecast; isDark: boolean }) {
  return (
    <div className="grid grid-cols-[60px_28px_1fr_34px] items-center gap-2 py-1.5">
      <div className={cn("text-xs font-medium", isDark ? "text-slate-200" : "text-slate-700")}>
        {item.day}
      </div>

      <div className={cn("flex justify-center", isDark ? "text-slate-100" : "text-slate-700")}>
        <span
          className={cn(
            "text-xl leading-none",
            isDark ? "text-cyan-300" : "text-cyan-600",
            mapWeatherCodeToFontIcon(item.icon),
          )}
          aria-hidden="true"
        />
      </div>

      <div className="flex items-center gap-2">
        <div
          className={cn(
            "h-2 flex-1 overflow-hidden rounded-full",
            isDark ? "bg-slate-700/80" : "bg-slate-200",
          )}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-300 via-orange-400 to-rose-500"
            style={{ width: `${item.progress}%` }}
          />
        </div>
      </div>

      <div
        className={cn(
          "text-right text-xs font-medium",
          isDark ? "text-slate-200" : "text-slate-700",
        )}
      >
        {item.high}°
      </div>
    </div>
  );
}

function MetricCard({ metric, isDark }: { metric: MetricCard; isDark: boolean }) {
  return (
    <div
      className={cn(
        "flex h-[125px] flex-col justify-between rounded-2xl border p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
        isDark
          ? "border-slate-700/60 bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-slate-800/80"
          : "border-slate-200 bg-gradient-to-br from-slate-100 via-slate-100 to-slate-200",
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between gap-1 text-[9px] font-medium uppercase tracking-[0.12em]",
          isDark ? "text-slate-300" : "text-slate-600",
        )}
      >
        <span
          className={cn("flex items-center gap-2", isDark ? "text-slate-200" : "text-slate-700")}
        >
          <WeatherIcon type={metric.icon} size="sm" />
          {metric.label}
        </span>
      </div>

      <div className="mt-2">
        <div
          className={cn(
            "text-2xl font-light tracking-tight",
            isDark ? "text-slate-100" : "text-slate-800",
          )}
        >
          {metric.value}
        </div>
        <div className={cn("mt-1 text-[11px]", isDark ? "text-slate-400" : "text-slate-500")}>
          {metric.description}
        </div>
      </div>

      <div className="mt-2 h-1" aria-hidden="true" />
    </div>
  );
}

export function WeatherDashboard({
  theme = "dark",
  variant = "page",
}: {
  theme?: ThemeMode;
  variant?: "page" | "modal";
}) {
  const [selectedCity, setSelectedCity] = useState("Asuncion,PY");
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const cityMeta = cities.find((city) => city.id === selectedCity) ?? cities[0];

  const cityWeatherQueries = useQueries({
    queries: cities.map((city) => ({
      queryKey: ["weather-dashboard-city", city.id],
      queryFn: () => fetchWeatherSnapshotForCity(city.id),
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    })),
  });

  const cityWeatherMap = useMemo(() => {
    const map = new Map<string, Awaited<ReturnType<typeof fetchWeatherSnapshotForCity>>>();
    cityWeatherQueries.forEach((result, index) => {
      if (result.data) {
        map.set(cities[index]!.id, result.data);
      }
    });
    return map;
  }, [cityWeatherQueries]);

  const weatherQuery = useQuery({
    queryKey: ["weather-dashboard", selectedCity],
    queryFn: () => fetchWeatherSnapshotForCity(selectedCity),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const snapshot = cityWeatherMap.get(selectedCity) ?? weatherQuery.data;
  const currentWeather = snapshot?.current;
  const hourly = snapshot?.hourly ?? [];
  const forecastFromApi = snapshot?.forecast ?? [];

  const daily = useMemo<DailyForecast[]>(() => {
    if (!forecastFromApi.length) return [];

    return forecastFromApi.map((item, index) => {
      const high = Math.round(item.tempMax ?? 0);
      const low = Math.round(item.tempMin ?? 0);
      const progress = Math.min(
        100,
        Math.max(24, Math.round(((high - low) / 12) * 100 + 30 + index * 2)),
      );

      return {
        day: item.day,
        icon: mapWeatherCodeToIcon(item.icon ?? "01d"),
        condition: item.description ?? "Sin descripción",
        high,
        low,
        progress,
      };
    });
  }, [forecastFromApi]);

  const metrics = useMemo<MetricCard[]>(() => {
    if (!currentWeather) return [];

    const avgDelta = Math.abs((currentWeather.feelsLike ?? 0) - (currentWeather.temperature ?? 0));
    const visibilityKm =
      currentWeather.visibility > 0 ? (currentWeather.visibility / 1000).toFixed(1) : "0.0";
    const sunriseLabel = new Date(
      (currentWeather.sunrise ?? Math.floor(Date.now() / 1000)) * 1000,
    ).toLocaleTimeString("es-PY", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const sunsetLabel = new Date(
      (currentWeather.sunset ?? Math.floor(Date.now() / 1000)) * 1000,
    ).toLocaleTimeString("es-PY", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const uvReading = snapshot?.uvIndex ?? null;
    const airReading = snapshot?.airQuality ?? null;
    const uvValue = Math.min(15, Math.max(0, Math.round(uvReading ?? 0)));
    const airQualityValue = Math.min(300, Math.max(0, Math.round(airReading ?? 0)));

    return [
      {
        key: "uv",
        label: "Índice UV",
        value: uvReading === null ? "—" : `${uvValue}`,
        description:
          uvReading === null
            ? "No disponible"
            : uvValue < 3
              ? "Bajo"
              : uvValue < 6
                ? "Moderado"
                : uvValue < 8
                  ? "Alto"
                  : "Muy alto",
        icon: "sun",
      },
      {
        key: "sunrise",
        label: "Amanecer",
        value: sunriseLabel,
        description: `Puesta ${sunsetLabel}`,
        icon: "sun",
      },
      {
        key: "visibility",
        label: "Visibilidad",
        value: `${visibilityKm} km`,
        description: "Vista clara",
        icon: "eye",
      },
      {
        key: "feelsLike",
        label: "Sensación",
        value: `${Math.round(currentWeather.feelsLike ?? currentWeather.temperature ?? 0)}°`,
        description: "Similar a la temperatura real",
        icon: "thermometer",
      },
      {
        key: "avg",
        label: "Promedio",
        value: `+${Math.round(avgDelta)}°`,
        description: "Por encima del promedio diario",
        icon: "sparkles",
      },
      {
        key: "rain",
        label: "Precipitación",
        value: `${Math.round(Math.max(0, currentWeather.humidity / 15))} mm`,
        description: "Estimación de humedad",
        icon: "rain",
      },
      {
        key: "wind",
        label: "Viento",
        value: `${(currentWeather.windSpeed ?? 0).toFixed(1)} km/h`,
        description: "Brisa suave",
        icon: "wind",
      },
      {
        key: "airQuality",
        label: "Calidad del aire",
        value: airReading === null ? "—" : `${airQualityValue}`,
        description:
          airReading === null
            ? "No disponible"
            : airQualityValue < 50
              ? "Buena"
              : airQualityValue < 100
                ? "Moderada"
                : "Mala",
        icon: "sparkles",
      },
      {
        key: "humidity",
        label: "Humedad",
        value: `${Math.round(currentWeather.humidity ?? 0)}%`,
        description: `Punto de rocío ${Math.max(10, Math.round(currentWeather.temperature ?? 0) - 6)}° ahora`,
        icon: "droplet",
      },
    ];
  }, [currentWeather, snapshot]);

  const currentDisplay = currentWeather
    ? {
        name: cityMeta.label,
        state: (currentWeather.description ?? "Sin descripción").replace(/^\w/, (letter) =>
          letter.toUpperCase(),
        ),
        temp: Math.round(currentWeather.temperature ?? 0),
        min: forecastFromApi[0]?.tempMin ? Math.round(forecastFromApi[0].tempMin) : 0,
        max: forecastFromApi[0]?.tempMax ? Math.round(forecastFromApi[0].tempMax) : 0,
        condition: (currentWeather.description ?? "Sin descripción").replace(/^\w/, (letter) =>
          letter.toUpperCase(),
        ),
        icon: mapWeatherCodeToIcon(currentWeather.icon),
      }
    : null;

  const isDark = theme === "dark";
  const isModal = variant === "modal";

  const handleCitySelect = (cityId: string) => {
    setSelectedCity(cityId);
    setIsDetailOpen(true);
  };

  if (weatherQuery.isLoading) {
    return (
      <div
        className={cn(
          "flex h-full w-full items-center justify-center",
          isDark ? "bg-slate-950 text-slate-100" : "bg-slate-100 text-slate-900",
        )}
      >
        <div className="flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-900/50 px-4 py-3 text-sm text-slate-300">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-500 border-t-sky-400" />
          Cargando clima...
        </div>
      </div>
    );
  }

  if (
    weatherQuery.isError ||
    !currentWeather ||
    !currentDisplay ||
    !daily.length ||
    !hourly.length
  ) {
    return (
      <div
        className={cn(
          "flex h-full w-full items-center justify-center p-6",
          isDark ? "bg-slate-950 text-slate-100" : "bg-slate-100 text-slate-900",
        )}
      >
        <div className="max-w-md rounded-2xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-200">
          No se pudo cargar el clima en tiempo real. Volvé a intentar en unos minutos.
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "h-full w-full overflow-hidden",
        isDark ? "bg-slate-950 text-slate-100" : "bg-slate-100 text-slate-900",
      )}
    >
      <div
        className={cn(
          "flex h-full w-[200%] transition-transform duration-300 ease-in-out md:w-full",
          isDetailOpen ? "-translate-x-1/2 md:translate-x-0" : "translate-x-0",
        )}
      >
        <aside
          className={cn(
            "h-full w-1/2 shrink-0 overflow-y-auto border-b p-3 md:w-[300px] md:border-b-0 md:border-r",
            isDark ? "border-slate-800 bg-slate-900/40" : "border-slate-200 bg-slate-50/90",
          )}
        >
          <div className="mb-3 border-b border-slate-700/60 pb-3 md:hidden">
            <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400">
              Pronóstico del tiempo
            </div>
          </div>

          <div>
            <SearchInput isDark={isDark} />
          </div>

          <div className="mt-3 space-y-2">
            {cities.map((city) => {
              const previewSnapshot = cityWeatherMap.get(city.id);
              const previewTemp = previewSnapshot?.current
                ? Math.round(previewSnapshot.current.temperature)
                : null;
              const previewMax = previewSnapshot?.forecast[0]
                ? Math.round(previewSnapshot.forecast[0].tempMax)
                : null;
              const previewMin = previewSnapshot?.forecast[0]
                ? Math.round(previewSnapshot.forecast[0].tempMin)
                : null;
              const previewState = previewSnapshot?.current
                ? (previewSnapshot.current.description ?? "Sin descripción").replace(
                    /^\w/,
                    (letter) => letter.toUpperCase(),
                  )
                : "Sin datos";

              return (
                <CitySelectorButton
                  key={city.id}
                  city={city}
                  active={selectedCity === city.id}
                  onSelect={handleCitySelect}
                  previewTemp={previewTemp}
                  previewMax={previewMax}
                  previewMin={previewMin}
                  previewState={previewState}
                  isDark={isDark}
                />
              );
            })}
          </div>

          <div className="mt-auto hidden items-center justify-end pt-3 text-xs text-slate-400 md:flex">
            <div className="flex items-center gap-2">
              <button className="rounded-full border border-slate-700 p-2" aria-label="Tema oscuro">
                ◔
              </button>
              <button className="rounded-full border border-slate-700 p-2" aria-label="Tema claro">
                ☼
              </button>
            </div>
          </div>
        </aside>

        <main
          className={cn(
            "h-full w-1/2 shrink-0 overflow-y-auto p-4 md:flex-1 md:p-3",
            isDark ? "bg-slate-950" : "bg-slate-100",
          )}
        >
          <div className="md:hidden">
            {isDetailOpen && (
              <button
                onClick={() => setIsDetailOpen(false)}
                className="mb-3 flex items-center gap-1 text-sm text-slate-400"
              >
                ← Volver a ciudades
              </button>
            )}
          </div>

          <div className="grid min-h-0 grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div className="space-y-3">
              <div
                className={cn(
                  "rounded-[22px] border p-3",
                  isDark ? "border-slate-700/60 bg-slate-900/50" : "border-slate-200 bg-white/80",
                )}
              >
                <div className="flex items-center justify-between">
                  <div
                    className={cn(
                      "text-[10px] font-medium uppercase tracking-[0.18em] sm:text-xs",
                      isDark ? "text-slate-400" : "text-slate-500",
                    )}
                  >
                    {currentDisplay.name.toUpperCase()} · {currentDisplay.state}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <div
                    className={cn(
                      "text-5xl font-light tracking-[-0.07em] sm:text-6xl",
                      isDark ? "text-slate-100" : "text-slate-900",
                    )}
                  >
                    {currentDisplay.temp}°
                  </div>

                  <div
                    className={cn(
                      "flex items-center gap-3 rounded-full border px-3 py-2 shadow-[0_8px_18px_rgba(15,23,42,0.08)]",
                      isDark
                        ? "border-slate-700/60 bg-slate-800/80"
                        : "border-slate-200 bg-slate-100/90",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-flex rounded-full p-1.5",
                        isDark
                          ? "bg-slate-900/70 text-amber-300"
                          : "bg-white text-sky-500 shadow-sm ring-1 ring-slate-200",
                      )}
                    >
                      <WeatherIcon type={currentDisplay.icon} size="lg" />
                    </span>
                    <div className="flex flex-col">
                      <span
                        className={cn(
                          "text-sm font-semibold sm:text-base",
                          isDark ? "text-slate-200" : "text-slate-700",
                        )}
                      >
                        {currentDisplay.condition}
                      </span>
                      <span
                        className={cn(
                          "text-[10px] uppercase tracking-[0.16em]",
                          isDark ? "text-slate-400" : "text-slate-500",
                        )}
                      >
                        Datos en vivo · OpenWeatherMap
                      </span>
                    </div>
                  </div>
                </div>

                <div
                  className={cn(
                    "mt-3 flex items-center gap-2 text-[10px] sm:text-xs",
                    isDark ? "text-slate-400" : "text-slate-500",
                  )}
                >
                  <span>Min {currentDisplay.min}°</span>
                  <span>•</span>
                  <span>Max {currentDisplay.max}°</span>
                </div>
              </div>

              <div
                className={cn(
                  "rounded-[22px] border p-3",
                  isDark ? "border-slate-700/60 bg-slate-900/50" : "border-slate-200 bg-white/80",
                )}
              >
                <div
                  className={cn(
                    "mb-3 text-[10px] font-medium uppercase tracking-[0.18em] sm:text-xs",
                    isDark ? "text-slate-400" : "text-slate-500",
                  )}
                >
                  Por horas
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1">
                  {hourly.map((item) => (
                    <HourlyCard key={`${selectedCity}-${item.time}`} item={item} isDark={isDark} />
                  ))}
                </div>
              </div>

              <div
                className={cn(
                  "rounded-[22px] border p-3",
                  isDark ? "border-slate-700/60 bg-slate-900/50" : "border-slate-200 bg-white/80",
                )}
              >
                <div
                  className={cn(
                    "mb-3 text-[10px] font-medium uppercase tracking-[0.18em] sm:text-xs",
                    isDark ? "text-slate-400" : "text-slate-500",
                  )}
                >
                  5 días
                </div>

                <div className="space-y-1.5">
                  {daily.map((item) => (
                    <DailyForecastRow
                      key={`${selectedCity}-${item.day}`}
                      item={item}
                      isDark={isDark}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              {metrics.map((metric) => (
                <MetricCard key={metric.key} metric={metric} isDark={isDark} />
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default WeatherDashboard;
