// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convertUsdRatesToPyg, createRatesFetcher, parseMaxicambiosHtml } from "./maxicambios.mjs";

const card = (code, buy, sell, label = "Moneda") =>
  `<div class="cotizDivSmall">
    <img src="img/flags/${code}.png">
    <p>${buy}</p>
    <p>${sell}</p>
    <p>${label}</p>
  </div>`;

const page = (...cards) =>
  `<html><body><div id="cotizacion-carousel">${cards.join("")}</div></body></html>`;

describe("parseMaxicambiosHtml", () => {
  it("reads guaraní amounts with thousands separators", () => {
    expect(parseMaxicambiosHtml(page(card("USD", "5.700", "5.950")))).toEqual({
      USD: { buy: 5700, sell: 5950 },
    });
  });

  it("reads decimals with a comma", () => {
    expect(parseMaxicambiosHtml(page(card("ARS", "3,40", "3,80")))).toEqual({
      ARS: { buy: 3.4, sell: 3.8 },
    });
  });

  it("falls back to the label when the flag is unknown", () => {
    const html = page(`<div class="cotizDivSmall">
 <p>6.100</p>
 <p>6.650</p>
 <p>Euro</p>
</div>`);
    expect(parseMaxicambiosHtml(html)).toEqual({ EUR: { buy: 6100, sell: 6650 } });
  });

  it("skips a card without two amounts", () => {
    expect(parseMaxicambiosHtml(page(card("USD", "5.700", "-")))).toEqual({});
  });

  it("returns nothing when the page layout changes", () => {
    expect(parseMaxicambiosHtml("<html><body><p>Mantenimiento</p></body></html>")).toEqual({});
  });
});

describe("convertUsdRatesToPyg", () => {
  it("expresses each currency in guaraníes", () => {
    const rates = convertUsdRatesToPyg({ PYG: 7000, USD: 1, EUR: 0.5 });
    expect(rates.USD).toEqual({ buy: 7000, sell: 7000 });
    expect(rates.EUR).toEqual({ buy: 14000, sell: 14000 });
    expect(rates.PYG).toEqual({ buy: 1, sell: 1 });
  });

  it("returns nothing without a guaraní rate", () => {
    expect(convertUsdRatesToPyg({ USD: 1 })).toEqual({});
  });
});

describe("createRatesFetcher", () => {
  const html = page(card("USD", "5.700", "5.950"));
  const ok = (body) => ({ ok: true, text: async () => body, json: async () => body });

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("uses Maxicambios first and names the source", async () => {
    const fetcher = createRatesFetcher(vi.fn().mockResolvedValue(ok(html)));
    expect(await fetcher()).toMatchObject({
      source: "maxicambios.com.py",
      rates: { USD: { buy: 5700 } },
    });
  });

  it("reuses the result for 20 minutes", async () => {
    const http = vi.fn().mockResolvedValue(ok(html));
    const fetcher = createRatesFetcher(http);

    await fetcher();
    await fetcher();
    expect(http).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(20 * 60 * 1000 + 1);
    await fetcher();
    expect(http).toHaveBeenCalledTimes(2);
  });

  it("falls back to the public rates and says so", async () => {
    const http = vi.fn(async (url) => {
      if (url.includes("maxicambios")) throw new Error("down");
      return ok({ rates: { PYG: 7000, USD: 1 } });
    });
    expect(await createRatesFetcher(http)()).toMatchObject({
      source: "open.er-api.com",
      rates: { USD: { buy: 7000 } },
    });
  });

  it("keeps the last good rates when every source fails", async () => {
    let healthy = true;
    const http = vi.fn(async () => {
      if (!healthy) throw new Error("down");
      return ok(html);
    });
    const fetcher = createRatesFetcher(http);
    await fetcher();

    healthy = false;
    vi.advanceTimersByTime(20 * 60 * 1000 + 1);

    expect(await fetcher()).toMatchObject({ rates: { USD: { buy: 5700 } } });
  });

  it("fails when nothing was ever available", async () => {
    const fetcher = createRatesFetcher(vi.fn().mockRejectedValue(new Error("down")));
    await expect(fetcher()).rejects.toThrow("No se pudo cargar la cotización");
  });
});
