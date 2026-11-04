import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchExchangeRates } from "@/lib/exchange-rate";

const rates = (buy: number) => ({ USD: { buy, sell: buy + 100 } });
const json = (body: unknown, ok = true) => ({ ok, json: async () => body }) as Response;

const http = vi.fn();

beforeEach(() => {
  http.mockReset();
  vi.stubGlobal("fetch", http);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchExchangeRates", () => {
  it("prefers live rates over the file generated at build time", async () => {
    http.mockImplementation(async (url: string) => json({ rates: rates(url === "/api/cotizaciones" ? 7000 : 5000) }));

    expect(await fetchExchangeRates()).toEqual(rates(7000));
    expect(http).toHaveBeenCalledTimes(1);
  });

  it("uses the generated file when the live service fails", async () => {
    http.mockImplementation(async (url: string) => (url === "/api/cotizaciones" ? json({}, false) : json({ rates: rates(5000) })));

    expect(await fetchExchangeRates()).toEqual(rates(5000));
  });

  it("uses the generated file when the network request throws", async () => {
    http.mockImplementation(async (url: string) => {
      if (url === "/api/cotizaciones") throw new TypeError("Failed to fetch");
      return json({ rates: rates(5000) });
    });

    expect(await fetchExchangeRates()).toEqual(rates(5000));
  });

  it("treats an empty answer as a failure", async () => {
    http.mockImplementation(async (url: string) => json({ rates: url === "/api/cotizaciones" ? {} : rates(5000) }));

    expect(await fetchExchangeRates()).toEqual(rates(5000));
  });

  it("fails clearly when nothing is available", async () => {
    http.mockResolvedValue(json({}, false));

    await expect(fetchExchangeRates()).rejects.toThrow("No se pudo cargar la cotización.");
  });

  it("never contacts other sites from the browser", async () => {
    http.mockResolvedValue(json({}, false));
    await fetchExchangeRates().catch(() => {});

    expect(http.mock.calls.map(([url]) => url)).toEqual(["/api/cotizaciones", "/cotizaciones.json"]);
  });
});
