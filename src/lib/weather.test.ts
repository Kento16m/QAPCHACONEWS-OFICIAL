import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchCurrentWeatherForCity } from "@/lib/weather";

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
    http.mockResolvedValue({ ok: true, status: 200, json: async () => ({ name: "Asunción", main: { temp: 30 } }) });

    await fetchCurrentWeatherForCity("Asuncion,PY").catch(() => {});

    const url = String(http.mock.calls[0]?.[0]);
    expect(url.startsWith("/api/clima?")).toBe(true);
    expect(url).toContain("endpoint=%2Fweather");
    expect(url).not.toContain("appid");
  });

  it("show the server's message when it fails", async () => {
    http.mockResolvedValue({ ok: false, status: 500, json: async () => ({ message: "El clima no está configurado." }) });

    await expect(fetchCurrentWeatherForCity("Lugar sin caché")).rejects.toThrow("El clima no está configurado.");
  });
});
