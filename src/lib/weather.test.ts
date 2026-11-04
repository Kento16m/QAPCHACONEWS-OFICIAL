import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// @ts-expect-error plain JavaScript module shared with the Netlify function
import { proxyWeather } from "../../netlify/shared/openweather.mjs";
import { fetchCurrentWeatherForCity, fetchWeatherSnapshotForCity } from "@/lib/weather";

const http = vi.fn();

beforeEach(() => {
  http.mockReset();
  vi.stubGlobal("fetch", http);
  window.localStorage.clear();
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("weather requests", () => {
  it("go to our own endpoint and never carry a key", async () => {
    http.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ name: "Asunción", main: { temp: 30 } }),
    });

    await fetchCurrentWeatherForCity("Asuncion,PY").catch(() => {});

    const url = String(http.mock.calls[0]?.[0]);
    expect(url.startsWith("/api/clima?")).toBe(true);
    expect(url).toContain("endpoint=%2Fweather");
    expect(url).not.toContain("appid");
  });

  it("show the server's message when it fails", async () => {
    http.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ message: "El clima no está configurado." }),
    });

    await expect(fetchCurrentWeatherForCity("Lugar sin caché")).rejects.toThrow(
      "El clima no está configurado.",
    );
  });
});

describe("the weather page data, through the real proxy", () => {
  const entry = (hour: number) => ({
    dt: 1_800_000_000 + hour * 3600,
    dt_txt: `2027-01-15 ${String(hour % 24).padStart(2, "0")}:00:00`,
    main: { temp: 30, temp_min: 25, temp_max: 35 },
    weather: [{ description: "soleado", icon: "01d" }],
  });
  const upstreamData: Record<string, unknown> = {
    "/weather": {
      name: "Asunción",
      coord: { lat: -25.3, lon: -57.6 },
      main: { temp: 30, feels_like: 32, humidity: 60 },
      wind: { speed: 3 },
      weather: [{ description: "soleado", icon: "01d" }],
      visibility: 10000,
      sys: { sunrise: 1, sunset: 2 },
    },
    "/forecast": { list: Array.from({ length: 16 }, (_, index) => entry(index * 3)) },
    "/uvi": { value: 7 },
    "/air_pollution": { list: [{ main: { aqi: 2 }, components: { pm2_5: 12 } }] },
  };

  const serve = (failing: string[] = []) => {
    const requested: string[] = [];
    const upstream = async (url: string) => {
      const { pathname, searchParams } = new URL(url);
      const endpoint = pathname.replace("/data/2.5", "");
      requested.push(`${endpoint}:${searchParams.get("appid")}`);
      return failing.includes(endpoint)
        ? new Response('{"message":"caído"}', { status: 503 })
        : new Response(JSON.stringify(upstreamData[endpoint]), { status: 200 });
    };
    http.mockImplementation(async (url: string) =>
      proxyWeather(`https://site.test${url}`, "server-key", upstream),
    );
    return requested;
  };

  it("loads every section using only the server's key", async () => {
    const requested = serve();

    const snapshot = await fetchWeatherSnapshotForCity("Asuncion,PY");

    expect(snapshot.current.city).toBe("Asunción");
    expect(snapshot.forecast.length).toBeGreaterThan(0);
    expect(snapshot.hourly.length).toBeGreaterThan(0);
    expect(snapshot.uvIndex).toBe(7);
    expect(snapshot.airQuality).not.toBeNull();
    expect(new Set(requested.map((item) => item.split(":")[0]))).toEqual(
      new Set(["/weather", "/forecast", "/uvi", "/air_pollution"]),
    );
    expect(requested.every((item) => item.endsWith(":server-key"))).toBe(true);
  });

  it.each([
    ["UV", "/uvi", "uvIndex"],
    ["air quality", "/air_pollution", "airQuality"],
  ] as const)("a failed %s reading does not take the page down", async (_name, endpoint, field) => {
    serve([endpoint]);

    const snapshot = await fetchWeatherSnapshotForCity("Asuncion,PY");

    expect(snapshot[field]).toBeNull();
    expect(snapshot.current.city).toBe("Asunción");
  });

  it("still reports a failure of the main reading", async () => {
    serve(["/weather"]);
    await expect(fetchWeatherSnapshotForCity("Asuncion,PY")).rejects.toThrow("caído");
  });
});
