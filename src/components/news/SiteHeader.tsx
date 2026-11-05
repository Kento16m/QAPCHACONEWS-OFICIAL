import { Link, lazyRouteComponent, useNavigate } from "@tanstack/react-router";
import { Deferred } from "@/components/Deferred";
import { useQuery } from "@tanstack/react-query";
import { User, Menu, Moon, Search, Sun, CloudSun, MapPin, LoaderCircle, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useCategories, useDebouncedValue } from "@/hooks/use-news";
import { Logo } from "./primitives";
import { Ticker } from "./Ticker";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { SheetClose } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { searchArticles } from "@/lib/api";
import { useSearchContext } from "@/contexts/SearchContext";
import {
  trackCategoryView,
  trackMobileSearchOpen,
  trackSearch,
  trackSearchResultClick,
} from "@/lib/analytics";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  fetchCurrentWeather,
  fetchForecastWeather,
  type ForecastDay,
  type WeatherCurrent,
} from "@/lib/weather";
import { CURRENCY_MODAL_LIST, CURRENCY_PREVIEW, fetchExchangeRates } from "@/lib/exchange-rate";

// Only signed-in people see this menu, and its libraries are heavy.
const UserMenu = lazyRouteComponent(() => import("@/components/auth/UserMenu"), "UserMenu");

// The full forecast is only downloaded when someone opens it.
const WeatherDashboard = lazyRouteComponent(
  () => import("@/components/weather/WeatherDashboard"),
  "WeatherDashboard",
);

function AuthControl() {
  const { user, loading, openAuthDialog } = useAuth();
  if (loading)
    return <span className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-secondary" />;
  if (user)
    return (
      <Deferred
        fallback={<span className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-secondary" />}
      >
        <UserMenu />
      </Deferred>
    );
  return (
    <>
      <Button
        onClick={() => openAuthDialog("login")}
        className="hidden h-10 rounded-full px-5 font-bold sm:inline-flex"
      >
        Iniciar sesión
      </Button>
      <button
        onClick={() => openAuthDialog("login")}
        aria-label="Iniciar sesión"
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground sm:hidden"
      >
        <User className="h-4 w-4" />
      </button>
    </>
  );
}

function DrawerAuth() {
  const { user, openAuthDialog } = useAuth();
  if (user) return null;
  return (
    <SheetClose asChild>
      <Button
        onClick={() => openAuthDialog("login")}
        className="mt-6 h-11 w-full rounded-full font-bold"
      >
        Iniciar sesión
      </Button>
    </SheetClose>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
      <path d="M13.5 22v-8h2.7l.4-3.1h-3.1V7.2c0-.9.3-1.5 1.6-1.5H17V2.8c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.5-4 4.2V11H8v3.1h2.6v8h2.9Z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
      <path d="M18.9 2h3.7l-8.1 9.2L22.8 22h-7.3l-5.7-8.1L4 22H.3l8.7-9.9L1.2 2h7.4l5.2 7.4L18.9 2Zm-1.3 18.1h2L7.2 3.8H4.9l12.7 16.3Z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
      <path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7Zm10.5 2.5a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4ZM12 6.5A5.5 5.5 0 1 1 12 17.5 5.5 5.5 0 0 1 12 6.5Zm0 2A3.5 3.5 0 1 0 12 15.5 3.5 3.5 0 0 0 12 8.5Z" />
    </svg>
  );
}

function YouTubeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
      <path d="M21.6 7.2a2.9 2.9 0 0 0-2-2.1C17.9 4.7 12 4.7 12 4.7s-5.9 0-7.6.4A2.9 2.9 0 0 0 2.4 7.2 30.5 30.5 0 0 0 2 12a30.5 30.5 0 0 0 .4 4.8 2.9 2.9 0 0 0 2 2.1c1.7.4 7.6.4 7.6.4s5.9 0 7.6-.4a2.9 2.9 0 0 0 2-2.1A30.5 30.5 0 0 0 22 12a30.5 30.5 0 0 0-.4-4.8ZM10 15.5v-7l6 3.5-6 3.5Z" />
    </svg>
  );
}

export const socials = [
  {
    icon: FacebookIcon,
    label: "Facebook",
    href: "https://www.facebook.com/qapchaconews",
    color: "bg-[#1877F2]",
  },
  { icon: XIcon, label: "X", href: "https://x.com/qapchaconews", color: "bg-[#0F172A]" },
  {
    icon: InstagramIcon,
    label: "Instagram",
    href: "https://www.instagram.com/qapchaco/",
    color: "bg-gradient-to-br from-[#F9CE34] via-[#EE2A7B] to-[#6228D7]",
  },
  {
    icon: YouTubeIcon,
    label: "YouTube",
    href: "https://www.youtube.com/@QAPChacoNews-26",
    color: "bg-[#FF0000]",
  },
];

function useToday() {
  const [d, setD] = useState("");
  useEffect(() => {
    const s = new Date().toLocaleDateString("es-PY", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    setD(s.charAt(0).toUpperCase() + s.slice(1));
  }, []);
  return d;
}

function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const stored = localStorage.getItem("theme") === "dark";
    setDark(stored);
    document.documentElement.classList.toggle("dark", stored);
  }, []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };
  return (
    <button
      onClick={toggle}
      aria-label={dark ? "Activar modo claro" : "Activar modo oscuro"}
      className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary transition hover:bg-accent"
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

function formatPyg(value: number | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return "--";
  return new Intl.NumberFormat("es-PY", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function CountryFlag({
  className,
  label,
  size = "sm",
}: {
  className: string;
  label: string;
  size?: "sm" | "lg";
}) {
  const dimension = size === "lg" ? "1.75rem" : "1.1rem";

  return (
    <span
      className={`fi ${className} inline-block rounded-[4px] border border-white/20 bg-cover bg-center shadow-sm`}
      aria-label={label}
      title={label}
      style={{ width: dimension, height: dimension }}
    />
  );
}

export function CurrencyTicker({ className = "" }: { className?: string }) {
  const [rates, setRates] = useState<Record<string, { buy: number; sell: number }>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadRates = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await fetchExchangeRates();
        if (!isMounted) return;
        setRates(result);
      } catch (catchError) {
        if (!isMounted) return;
        setError(
          catchError instanceof Error ? catchError.message : "No se pudo cargar la cotización.",
        );
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadRates();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (loading || CURRENCY_PREVIEW.length < 2) return;
    const interval = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % CURRENCY_PREVIEW.length);
    }, 4000);
    return () => window.clearInterval(interval);
  }, [loading]);

  const current = CURRENCY_PREVIEW[activeIndex % CURRENCY_PREVIEW.length]!;
  const currentRate = rates[current.code];
  const currentValue = currentRate ? currentRate.sell : undefined;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ver cotización de monedas"
        className={`group inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-white/10 bg-slate-800/70 px-2 py-1.5 text-left text-[10px] text-slate-100 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] transition-all duration-300 hover:border-white/20 hover:bg-slate-700/70 focus:outline-none focus:ring-2 focus:ring-primary/80 sm:gap-2 sm:px-2.5 sm:py-1.5 sm:text-xs ${className}`}
      >
        {loading ? (
          <span className="flex items-center gap-1.5 text-slate-200">
            <span className="h-3 w-3 animate-pulse rounded-full bg-white/20" />
            <span className="font-medium">Cotización…</span>
          </span>
        ) : error ? (
          <span className="flex items-center gap-1.5 text-slate-200">
            <span className="text-sm">💱</span>
            <span className="font-medium">Monedas</span>
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-slate-100 transition-all duration-500">
            <CountryFlag className={current.flagClass} label={current.name} />
            <span className="font-semibold tracking-wide">{current.code}</span>
            <span className="font-medium text-slate-300">₲ {formatPyg(currentValue)}</span>
          </span>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          hideCloseButton
          className="max-h-[92vh] w-[calc(100%-1rem)] max-w-3xl overflow-y-auto rounded-[30px] border border-[#e9e2d9] bg-[radial-gradient(circle_at_top_left,_rgba(14,116,144,0.08),_transparent_26%),linear-gradient(180deg,#f9f7f4_0%,#f3efe9_100%)] p-0 shadow-[0_28px_80px_rgba(15,23,42,0.14)] sm:w-full"
        >
          <div className="flex items-center justify-between border-b border-[#e9e2d9] bg-white/60 px-5 py-4 backdrop-blur-sm">
            <DialogHeader className="space-y-2 text-left">
              <DialogTitle className="text-[2rem] font-black tracking-[-0.05em] text-slate-900">
                Cotización en PYG
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-600">
                Valor de cada moneda frente al guaraní.
              </DialogDescription>
            </DialogHeader>

            <DialogClose asChild>
              <button
                type="button"
                aria-label="Cerrar cotizaciones"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#ddd6cf] bg-white/80 text-xl leading-none text-slate-600 shadow-[0_8px_18px_rgba(15,23,42,0.05)] transition hover:bg-slate-50 hover:text-slate-900"
              >
                <span className="translate-y-[-1px]">×</span>
              </button>
            </DialogClose>
          </div>

          <div className="max-h-[calc(92vh-118px)] overflow-y-auto overscroll-contain p-4 sm:p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              {CURRENCY_MODAL_LIST.map((currency) => {
                const rate = rates[currency.code];

                return (
                  <div
                    key={currency.code}
                    className="group rounded-[26px] border border-[#e7e0d8] bg-white/75 p-3.5 shadow-[0_10px_20px_rgba(15,23,42,0.04)] backdrop-blur-sm transition-all duration-200 hover:-translate-y-1 hover:border-[#d4ece7] hover:shadow-[0_16px_28px_rgba(15,23,42,0.08)]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 via-white to-slate-200 shadow-inner ring-1 ring-slate-200">
                        <CountryFlag
                          className={currency.flagClass}
                          label={currency.name}
                          size="lg"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-base font-black tracking-[0.09em] text-slate-900">
                          {currency.code}
                        </p>
                        <p className="truncate text-[11px] text-slate-500">{currency.name}</p>
                      </div>
                    </div>

                    {rate ? (
                      <div className="mt-3 grid grid-cols-2 gap-2 text-left">
                        <div className="rounded-[18px] border border-[#bfeae2] bg-[#ebfff8] px-2.5 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]">
                          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#0f766e]">
                            Compra
                          </p>
                          <p className="mt-1 text-lg font-black tracking-[-0.04em] text-slate-900">
                            ₲ {formatPyg(rate.buy)}
                          </p>
                        </div>
                        <div className="rounded-[18px] border border-[#f0dfad] bg-[#fff8de] px-2.5 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]">
                          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#b45309]">
                            Venta
                          </p>
                          <p className="mt-1 text-lg font-black tracking-[-0.04em] text-slate-900">
                            ₲ {formatPyg(rate.sell)}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 rounded-[18px] border border-dashed border-slate-300 bg-slate-100/70 px-2 py-2.5 text-sm text-slate-500">
                        Sin datos
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function getWeatherFontIcon(icon: string): string {
  const normalized = (icon ?? "01d").toLowerCase();

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

function WeatherIcon({
  icon,
  description,
  size = "md",
  className = "",
}: {
  icon: string;
  description: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeClasses = {
    sm: "text-lg",
    md: "text-3xl",
    lg: "text-5xl",
  };

  return (
    <span
      aria-label={description}
      title={description}
      className={`${sizeClasses[size]} ${getWeatherFontIcon(icon)} block leading-none ${className}`}
      style={{ color: "currentColor" }}
    />
  );
}

function WeatherSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`flex animate-pulse items-center gap-2 ${className}`}>
      <span className="h-4 w-4 rounded-full bg-white/20" />
      <span className="h-3 w-12 rounded-full bg-white/20" />
    </div>
  );
}

function WeatherQuickView({ onOpen, className = "" }: { onOpen: () => void; className?: string }) {
  const [weather, setWeather] = useState<WeatherCurrent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadWeather = async () => {
      setLoading(true);
      setError(null);
      try {
        const current = await fetchCurrentWeather();
        if (!active) return;
        setWeather(current);
      } catch (cause) {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "Sin datos");
      } finally {
        if (active) setLoading(false);
      }
    };

    loadWeather();
    return () => {
      active = false;
    };
  }, []);

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Ver pronóstico del clima"
      className={`inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-700/80 bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 px-2.5 py-1.5 text-left text-[10px] text-slate-100 shadow-[0_10px_24px_rgba(15,23,42,0.18)] transition duration-200 hover:-translate-y-0.5 hover:border-sky-400/50 hover:shadow-[0_12px_28px_rgba(14,116,144,0.2)] focus:outline-none focus:ring-2 focus:ring-sky-400/70 sm:gap-2.5 sm:px-3 sm:py-1.75 sm:text-xs ${className}`}
    >
      {loading ? (
        <WeatherSkeleton />
      ) : weather?.icon ? (
        <WeatherIcon
          icon={weather.icon}
          description={weather.description}
          size="sm"
          className="text-sky-300 drop-shadow-[0_0_12px_rgba(125,211,252,0.45)]"
        />
      ) : (
        <CloudSun className="h-4 w-4 text-sky-300 sm:h-5 sm:w-5" />
      )}

      <span className="inline-flex items-center gap-1.5 font-semibold tracking-tight text-slate-100">
        <MapPin className="h-3 w-3 text-sky-300 opacity-90 sm:h-3.5 sm:w-3.5" />
        <span>{error ? "Sin datos" : `${Math.round(weather?.temperature ?? 0)}°C`}</span>
      </span>
    </button>
  );
}

function WeatherForecastModal() {
  const [open, setOpen] = useState(false);
  const [weather, setWeather] = useState<WeatherCurrent | null>(null);
  const [forecast, setForecast] = useState<ForecastDay[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(() =>
    document.documentElement.classList.contains("dark"),
  );

  useEffect(() => {
    const syncTheme = () => {
      setIsDarkMode(document.documentElement.classList.contains("dark"));
    };

    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    let active = true;

    const loadDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const [current, nextDays] = await Promise.all([
          fetchCurrentWeather(),
          fetchForecastWeather(),
        ]);
        if (!active) return;
        setWeather(current);
        setForecast(nextDays);
      } catch (cause) {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "No pudimos cargar el clima.");
      } finally {
        if (active) setLoading(false);
      }
    };

    loadDetails();
    return () => {
      active = false;
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      document.body.style.overflow = "";
    }
  }, [open]);

  return (
    <>
      <WeatherQuickView onOpen={() => setOpen(true)} className="bg-slate-800/70" />

      {open && (
        <div
          className="fixed inset-0 z-[9999] flex h-screen w-screen items-center justify-center bg-black/70 p-2 backdrop-blur-sm sm:p-4"
          style={{ animation: "modal-overlay-in 0.22s ease-out forwards" }}
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div
            className={cn(
              "relative flex h-[min(88vh,820px)] w-[min(98vw,1280px)] max-h-[820px] max-w-[1280px] origin-center overflow-hidden rounded-3xl border shadow-2xl",
              isDarkMode
                ? "border-slate-800 bg-slate-950 text-white"
                : "border-slate-200 bg-white text-slate-900",
            )}
            style={{ animation: "modal-panel-in 0.26s cubic-bezier(0.22, 1, 0.36, 1) forwards" }}
          >
            <div className="flex w-full flex-col">
              <div
                className={cn(
                  "flex items-center justify-between border-b px-4 py-3 sm:px-5",
                  isDarkMode ? "border-slate-800 bg-slate-950/95" : "border-slate-200 bg-white/95",
                )}
              >
                <div className="space-y-1 text-left">
                  <div
                    className={cn(
                      "text-lg font-bold sm:text-xl",
                      isDarkMode ? "text-slate-100" : "text-slate-900",
                    )}
                  >
                    Pronóstico del tiempo
                  </div>
                </div>

                <button
                  type="button"
                  aria-label="Cerrar pronóstico del clima"
                  onClick={() => setOpen(false)}
                  className={cn(
                    "inline-flex h-9 w-9 items-center justify-center rounded-full border p-0 text-xl leading-none transition",
                    isDarkMode
                      ? "border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white"
                      : "border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900",
                  )}
                >
                  <span className="translate-y-[-1px]">×</span>
                </button>
              </div>

              {loading || error ? (
                <div
                  className={cn(
                    "space-y-4 p-4 sm:p-5",
                    isDarkMode ? "bg-slate-950" : "bg-slate-50",
                  )}
                >
                  {loading ? (
                    <div
                      className={cn(
                        "space-y-5 rounded-[24px] border p-4",
                        isDarkMode
                          ? "border-slate-800 bg-slate-900/40"
                          : "border-slate-200 bg-white",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "h-12 w-12 animate-pulse rounded-full",
                            isDarkMode ? "bg-slate-800" : "bg-slate-200",
                          )}
                        />
                        <div className="flex-1 space-y-2">
                          <div
                            className={cn(
                              "h-4 w-24 animate-pulse rounded-full",
                              isDarkMode ? "bg-slate-800" : "bg-slate-200",
                            )}
                          />
                          <div
                            className={cn(
                              "h-3 w-36 animate-pulse rounded-full",
                              isDarkMode ? "bg-slate-800" : "bg-slate-200",
                            )}
                          />
                        </div>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {Array.from({ length: 4 }).map((_, index) => (
                          <div
                            key={index}
                            className={cn(
                              "h-24 animate-pulse rounded-2xl border",
                              isDarkMode
                                ? "border-slate-800 bg-slate-900/50"
                                : "border-slate-200 bg-slate-100",
                            )}
                          />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div
                      className={cn(
                        "rounded-[24px] border p-4 text-sm",
                        isDarkMode
                          ? "border-red-500/20 bg-red-500/5 text-red-300"
                          : "border-red-200 bg-red-50 text-red-700",
                      )}
                    >
                      {error}
                    </div>
                  )}
                </div>
              ) : (
                <div
                  className={cn(
                    "flex-1 overflow-y-auto",
                    isDarkMode ? "bg-slate-950" : "bg-slate-50",
                  )}
                >
                  <Deferred
                    fallback={<LoaderCircle className="mx-auto mt-10 h-6 w-6 animate-spin" />}
                  >
                    <WeatherDashboard theme={isDarkMode ? "dark" : "light"} variant="modal" />
                  </Deferred>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SearchModal() {
  const navigate = useNavigate();
  const { searchTerm, setSearchTerm, isSearchOpen, setIsSearchOpen } = useSearchContext();
  const trimmed = searchTerm.trim();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isClosing, setIsClosing] = useState(false);

  const debouncedTerm = useDebouncedValue(trimmed, 400);
  const searchQuery = useQuery({
    queryKey: ["search-modal", debouncedTerm],
    queryFn: () => searchArticles(debouncedTerm, 1, 8),
    enabled: isSearchOpen && debouncedTerm.length > 0,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!isSearchOpen) return;
    setIsClosing(false);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 60);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleRequestClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isSearchOpen]);

  const handleRequestClose = () => {
    setIsClosing(true);
    window.setTimeout(() => {
      setIsSearchOpen(false);
      setIsClosing(false);
    }, 180);
  };

  const handleSubmit = (event?: FormEvent) => {
    if (event) event.preventDefault();
    if (!trimmed) return;
    trackSearch(trimmed, "mobile", searchQuery.data?.items.length ?? 0);
    navigate({ to: "/buscar", search: { q: trimmed } });
    handleRequestClose();
  };

  if (!isSearchOpen) return null;
  if (typeof window !== "undefined" && window.innerWidth >= 768) return null;

  return (
    <div
      className={`fixed inset-0 z-[80] bg-background/80 p-4 backdrop-blur-sm transition-opacity duration-300 ${isClosing ? "opacity-0" : "opacity-100"}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) handleRequestClose();
      }}
    >
      <div
        className={`mx-auto flex h-full max-w-3xl flex-col overflow-hidden rounded-[28px] border border-border bg-card shadow-[0_25px_90px_rgba(15,23,42,0.28)] transition-all duration-300 ${isClosing ? "translate-y-[-12px] scale-[0.98] opacity-0" : "translate-y-0 scale-100 opacity-100"}`}
      >
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <label className="relative block flex-1">
            <span className="sr-only">Buscar noticias</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={inputRef}
              autoFocus
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value.slice(0, 100))}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="Buscar en QAP ChacoNews…"
              className="h-12 w-full rounded-full border bg-secondary pl-11 pr-4 text-base outline-none transition focus:border-primary focus:bg-card"
            />
          </label>
          <button
            type="button"
            aria-label="Cerrar búsqueda"
            onClick={handleRequestClose}
            className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
            <span className="hidden sm:inline">Cancelar</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {!trimmed && (
            <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
              Escribí un término para buscar noticias.
            </div>
          )}

          {trimmed && (
            <div className="space-y-3">
              {searchQuery.isLoading ? (
                <div className="space-y-3 pt-1">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-20 animate-pulse rounded-2xl border border-border bg-muted/40"
                    />
                  ))}
                </div>
              ) : searchQuery.data?.items.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                  No se encontraron noticias que coinciden con "{trimmed}".
                </div>
              ) : (
                searchQuery.data?.items.map((article, index) => (
                  <Link
                    key={article.id}
                    to="/noticia/$slug"
                    params={{ slug: article.slug }}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 transition hover:bg-muted"
                    onClick={() => {
                      trackSearchResultClick(trimmed, article.title, index + 1, "mobile");
                      handleRequestClose();
                    }}
                  >
                    <img
                      src={
                        article.cover_image_url ??
                        "https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=600&q=80"
                      }
                      alt={article.title}
                      className="h-16 w-20 rounded-xl object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-semibold text-foreground">
                        {article.title}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        <span>{article.category?.name ?? "General"}</span>
                        <span>•</span>
                        <time>
                          {new Date(article.published_at).toLocaleDateString("es-PY", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </time>
                      </div>
                    </div>
                  </Link>
                ))
              )}

              {trimmed && !searchQuery.isLoading && (
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
                >
                  Ver todos los resultados para "{trimmed}"
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SearchBox({
  className,
  onOpenMobileSearch,
}: {
  className?: string;
  onOpenMobileSearch?: () => void;
}) {
  const navigate = useNavigate();
  const { searchTerm, setSearchTerm, setIsSearchOpen } = useSearchContext();

  const submit = (event?: FormEvent) => {
    if (event) event.preventDefault();
    const term = searchTerm.trim();
    if (!term) return;
    trackSearch(term, "desktop", 0);
    navigate({ to: "/buscar", search: { q: term } });
    setIsSearchOpen(false);
  };

  return (
    <form onSubmit={submit} role="search" className={cn("w-full", className)}>
      <label className="relative block">
        <span className="sr-only">Buscar noticias</span>
        <input
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value.slice(0, 100))}
          onFocus={() => {
            if (typeof window !== "undefined" && window.innerWidth < 768) {
              if (onOpenMobileSearch) {
                onOpenMobileSearch();
              }
              trackMobileSearchOpen();
              setIsSearchOpen(true);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submit();
            }
          }}
          placeholder="Buscar en QAP ChacoNews…"
          className="h-11 w-full rounded-full border bg-secondary pl-5 pr-11 text-sm outline-none transition focus:border-primary focus:bg-card"
        />
        <Search className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      </label>
    </form>
  );
}

export function SiteHeader() {
  const today = useToday();
  const { data: cats } = useCategories();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  const handleMoreCategorySelect = (category: { slug: string; name: string }) => {
    trackCategoryView(category.name, "header_nav_more");
    setMoreMenuOpen(false);
    navigate({ to: "/categoria/$slug", params: { slug: category.slug } });
  };

  const primaryCategories = cats?.slice(0, 8) ?? [];
  const secondaryCategories = cats && cats.length > 8 ? cats.slice(8) : [];

  useEffect(() => {
    if (!moreMenuOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handlePointerDown = (event: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setMoreMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [moreMenuOpen]);

  const goHome = () => {
    setMobileMenuOpen(false);

    if (typeof window !== "undefined") {
      if (window.location.pathname !== "/") {
        window.location.assign("/");
        return;
      }
      window.scrollTo({ top: 0, behavior: "auto" });
    }

    navigate({ to: "/" });
  };

  return (
    <>
      <SearchModal />
      {moreMenuOpen && (
        <div
          ref={moreMenuRef}
          className="fixed inset-0 z-[9999] flex min-h-screen items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setMoreMenuOpen(false);
            }
          }}
        >
          <div
            className="w-full max-w-lg rounded-[30px] border border-border bg-card p-4 shadow-2xl sm:p-5"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-3 px-1">
              <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
                Categorías
              </span>
              <button
                type="button"
                aria-label="Cerrar categorías extra"
                onClick={() => setMoreMenuOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              >
                ×
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {secondaryCategories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleMoreCategorySelect(c)}
                    className="rounded-2xl border border-border bg-secondary/40 px-3 py-2.5 text-left text-sm font-semibold text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="hidden bg-navy text-navy-foreground md:flex">
        <div className="mx-auto flex h-auto min-h-10 max-w-7xl flex-wrap items-center gap-3 px-4 py-2 sm:px-6">
          <span className="shrink-0 text-[11px] text-navy-muted sm:text-xs">{today}</span>
          <div className="min-w-0 flex-1">
            <Ticker />
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <CurrencyTicker />
            {socials.map(({ icon: I, label, href, color }) => (
              <a
                key={label}
                href={href}
                aria-label={label}
                target="_blank"
                rel="noreferrer"
                className={`grid h-8 w-8 place-items-center rounded-full text-white transition hover:scale-105 ${color}`}
              >
                <I />
              </a>
            ))}
          </div>
        </div>
      </div>

      <header className="glass sticky top-0 z-40 border-b">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
          <div className="hidden md:grid md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center md:gap-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={goHome}
                aria-label="QAP ChacoNews, inicio"
                className="inline-flex items-center rounded-xl bg-transparent p-0"
              >
                <Logo className="h-9" variant="auto" />
              </button>
            </div>

            <SearchBox className="mx-auto w-full max-w-md" />

            <div className="flex items-center justify-end gap-2">
              <WeatherForecastModal />
              <ThemeToggle />
              <AuthControl />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 md:hidden">
            <div className="flex items-center gap-2">
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger
                  aria-label="Abrir menú"
                  className="grid h-10 w-10 place-items-center rounded-full hover:bg-secondary"
                  onClick={() => setMobileMenuOpen(true)}
                >
                  <Menu className="h-5 w-5" />
                </SheetTrigger>
                <SheetContent side="left" className="w-80 bg-navy text-navy-foreground">
                  <SheetTitle className="sr-only">Menú</SheetTitle>
                  <Logo className="h-12" variant="dark" />
                  <DrawerAuth />
                  <SearchBox
                    className="mt-6 text-foreground"
                    onOpenMobileSearch={() => setMobileMenuOpen(false)}
                  />
                  <div className="mt-6 space-y-3">
                    <div className="flex items-center gap-2">
                      <CurrencyTicker className="flex-1 justify-center border border-white/10 bg-slate-800/70 text-slate-100 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]" />
                      <WeatherForecastModal />
                    </div>

                    <div className="flex items-center justify-start gap-3 pt-1">
                      {socials.map(({ icon: I, label, href, color }) => (
                        <a
                          key={label}
                          href={href}
                          aria-label={label}
                          target="_blank"
                          rel="noreferrer"
                          className={`grid h-9 w-9 place-items-center rounded-full text-white transition hover:scale-105 ${color}`}
                        >
                          <I />
                        </a>
                      ))}
                    </div>
                  </div>
                  <nav className="mt-6 flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={goHome}
                      className="rounded-xl px-3 py-2.5 text-left font-semibold hover:bg-navy-border"
                    >
                      Inicio
                    </button>
                    {cats?.map((c) => (
                      <Link
                        key={c.id}
                        to="/categoria/$slug"
                        params={{ slug: c.slug }}
                        onClick={() => trackCategoryView(c.name, "mobile_menu")}
                        className="rounded-xl px-3 py-2.5 font-semibold hover:bg-navy-border"
                      >
                        {c.name}
                      </Link>
                    ))}
                  </nav>
                </SheetContent>
              </Sheet>
            </div>

            <div className="flex flex-1 justify-start">
              <button
                type="button"
                onClick={goHome}
                aria-label="QAP ChacoNews, inicio"
                className="inline-flex"
              >
                <Logo className="h-9" variant="auto" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <ThemeToggle />
              <AuthControl />
            </div>
          </div>
        </div>

        <nav
          aria-label="Categorías"
          className="no-scrollbar relative mx-auto hidden max-w-7xl items-center gap-1 overflow-x-auto overflow-y-visible px-4 pb-2 sm:px-6 lg:flex"
        >
          <button
            type="button"
            onClick={goHome}
            className="whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground data-[status=active]:bg-primary data-[status=active]:text-primary-foreground"
          >
            Inicio
          </button>

          {primaryCategories.map((c) => (
            <Link
              key={c.id}
              to="/categoria/$slug"
              params={{ slug: c.slug }}
              onClick={() => trackCategoryView(c.name, "header_nav")}
              className="whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground data-[status=active]:bg-primary data-[status=active]:text-primary-foreground"
            >
              {c.name}
            </Link>
          ))}

          {secondaryCategories.length > 0 && (
            <div ref={moreMenuRef} className="relative shrink-0">
              <button
                type="button"
                aria-expanded={moreMenuOpen}
                onClick={() => setMoreMenuOpen((prev) => !prev)}
                className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
              >
                <span>Más</span>
                <span
                  className={cn("transition-transform duration-200", moreMenuOpen && "rotate-180")}
                >
                  ▾
                </span>
              </button>
            </div>
          )}
        </nav>
      </header>
    </>
  );
}
