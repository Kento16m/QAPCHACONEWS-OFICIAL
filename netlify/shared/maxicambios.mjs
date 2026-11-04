// The one exchange-rate scraper, used by the Netlify function, the build script and the dev server.
import { load } from "cheerio";

const MAXICAMBIOS_URLS = ["https://www.maxicambios.com.py", "https://maxicambios.com.py"];
const PUBLIC_RATES_URL = "https://open.er-api.com/v6/latest/USD";
const PUBLIC_CODES = [
  "USD",
  "ARS",
  "BRL",
  "EUR",
  "UYU",
  "GBP",
  "JPY",
  "CAD",
  "AUD",
  "CHF",
  "CLP",
  "PYG",
];
const CACHE_MS = 20 * 60 * 1000;
const TIMEOUT_MS = 20_000;

const CODE_BY_LABEL = { dolar: "USD", euro: "EUR", real: "BRL", peso: "ARS" };

const normalizeNumber = (value) => {
  const cleaned = value.replace(/\s+/g, "").replace(/[^0-9,.]/g, "");
  if (!cleaned) return null;

  let normalized = cleaned;
  if (cleaned.includes(",") && cleaned.includes(".")) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (cleaned.includes(",")) {
    const [whole, fraction = "0"] = cleaned.split(",");
    normalized = fraction.length <= 2 ? `${whole}.${fraction}` : `${whole}${fraction}`;
  } else if (cleaned.includes(".")) {
    // Paraguayan amounts use the dot for thousands: 5.700 means 5700.
    const parts = cleaned.split(".");
    normalized = (parts.at(-1) ?? "").length <= 2 ? cleaned : parts.join("");
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const flagCode = (card) => {
  const src = card.find("img[src*='flags/']").first().attr("src") ?? "";
  return (
    src
      .match(/[/\\](USD|EUR|BRL|ARS|UYU|JPY|GBP|CLP|CHF|CAD|AUD|CNY)\.(?:png|jpg|jpeg|svg)/i)?.[1]
      ?.toUpperCase() ?? null
  );
};

const parseCard = (card) => {
  const label = card.find("p").last().text().trim().toLowerCase();
  const code =
    flagCode(card) ?? Object.entries(CODE_BY_LABEL).find(([key]) => label.includes(key))?.[1];
  if (!code) return null;

  const amounts = Array.from(card.text().matchAll(/\d+(?:[.,]\d+)?/g))
    .map((match) => normalizeNumber(match[0]))
    .filter((value) => value !== null);
  if (amounts.length < 2) return null;

  return { code, buy: amounts[0], sell: amounts[1] };
};

export const parseMaxicambiosHtml = (html) => {
  const $ = load(html);
  const root =
    [
      $("#cotizacion-carousel").first(),
      $("#cotizacion-carousel-xs").first(),
      $("#monedas").first(),
      $(".cotizDivSmall").first().closest(".row"),
    ].find((node) => node.length > 0) ?? $.root();

  const rates = {};
  root.find(".cotizDivSmall").each((_, element) => {
    const item = parseCard($(element));
    if (item) rates[item.code] = { buy: item.buy, sell: item.sell };
  });
  return rates;
};

export const convertUsdRatesToPyg = (usdRates) => {
  const pygPerUsd = Number(usdRates.PYG);
  const rates = {};
  if (!Number.isFinite(pygPerUsd) || pygPerUsd <= 0) return rates;

  for (const code of PUBLIC_CODES) {
    const value = Number(usdRates[code]);
    if (!Number.isFinite(value) || value <= 0) continue;
    const inGuaranies = code === "PYG" ? 1 : pygPerUsd / value;
    rates[code] = { buy: inGuaranies, sell: inGuaranies };
  }
  return rates;
};

const fromMaxicambios = async (http) => {
  let lastError = new Error("No se pudo contactar a Maxicambios.");

  for (const url of MAXICAMBIOS_URLS) {
    try {
      const response = await http(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "es-ES,es;q=0.9",
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`Maxicambios respondió ${response.status}.`);

      const rates = parseMaxicambiosHtml(await response.text());
      if (Object.keys(rates).length > 0) return rates;
      lastError = new Error("No se pudo leer ninguna cotización válida de Maxicambios.");
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
};

const fromPublicApi = async (http) => {
  const response = await http(PUBLIC_RATES_URL, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error("La API pública de cotizaciones no respondió correctamente.");

  const payload = await response.json();
  const rates = convertUsdRatesToPyg(payload.rates ?? {});
  if (Object.keys(rates).length === 0)
    throw new Error("La API pública no devolvió cotizaciones válidas.");
  return rates;
};

export const createRatesFetcher = (http = fetch) => {
  let last = null;
  let lastAt = 0;

  return async () => {
    if (last && Date.now() - lastAt < CACHE_MS) return last;

    try {
      last = { rates: await fromMaxicambios(http), source: "maxicambios.com.py" };
    } catch (maxicambiosError) {
      try {
        last = { rates: await fromPublicApi(http), source: "open.er-api.com" };
      } catch {
        // Slightly old rates are better than none for a header widget.
        if (last) return last;
        const reason =
          maxicambiosError instanceof Error ? maxicambiosError.message : "error desconocido";
        throw new Error(`No se pudo cargar la cotización: ${reason}`);
      }
    }

    lastAt = Date.now();
    return last;
  };
};
