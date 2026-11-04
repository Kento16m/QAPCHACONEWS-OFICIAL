export type CurrencyPrice = {
  buy: number;
  sell: number;
};

export type ExchangeRateRecord = Record<string, CurrencyPrice>;

export type CurrencyListItem = {
  code: string;
  name: string;
  flag: string;
  flagClass: string;
};

const readRates = async (url: string): Promise<ExchangeRateRecord | null> => {
  try {
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) return null;
    const payload = (await response.json()) as { rates?: ExchangeRateRecord };
    return payload.rates && Object.keys(payload.rates).length > 0 ? payload.rates : null;
  } catch {
    return null;
  }
};

// Live first: the file is only as fresh as the last deploy.
export async function fetchExchangeRates(): Promise<ExchangeRateRecord> {
  const rates = (await readRates("/api/cotizaciones")) ?? (await readRates("/cotizaciones.json"));
  if (!rates) throw new Error("No se pudo cargar la cotización.");
  return rates;
}

export const CURRENCY_PREVIEW: CurrencyListItem[] = [
  { code: "USD", name: "Dólar", flag: "🇺🇸", flagClass: "fi fi-us" },
  { code: "ARS", name: "Peso Argentino", flag: "🇦🇷", flagClass: "fi fi-ar" },
  { code: "BRL", name: "Real", flag: "🇧🇷", flagClass: "fi fi-br" },
  { code: "EUR", name: "Euro", flag: "🇪🇺", flagClass: "fi fi-eu" },
];

export const CURRENCY_MODAL_LIST: CurrencyListItem[] = [
  { code: "USD", name: "Dólar Estadounidense", flag: "🇺🇸", flagClass: "fi fi-us" },
  { code: "ARS", name: "Peso Argentino", flag: "🇦🇷", flagClass: "fi fi-ar" },
  { code: "BRL", name: "Real Brasileño", flag: "🇧🇷", flagClass: "fi fi-br" },
  { code: "EUR", name: "Euro", flag: "🇪🇺", flagClass: "fi fi-eu" },
  { code: "UYU", name: "Peso Uruguayo", flag: "🇺🇾", flagClass: "fi fi-uy" },
  { code: "GBP", name: "Libra Esterlina", flag: "🇬🇧", flagClass: "fi fi-gb" },
  { code: "JPY", name: "Yen Japonés", flag: "🇯🇵", flagClass: "fi fi-jp" },
  { code: "CAD", name: "Dólar Canadiense", flag: "🇨🇦", flagClass: "fi fi-ca" },
  { code: "AUD", name: "Dólar Australiano", flag: "🇦🇺", flagClass: "fi fi-au" },
  { code: "CHF", name: "Franco Suizo", flag: "🇨🇭", flagClass: "fi fi-ch" },
  { code: "CLP", name: "Peso Chileno", flag: "🇨🇱", flagClass: "fi fi-cl" },
];
