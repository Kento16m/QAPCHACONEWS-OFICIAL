// Keeps the OpenWeather key on the server. Only the calls the site needs can pass through.
const BASE_URL = "https://api.openweathermap.org/data/2.5";
const ALLOWED_ENDPOINTS = new Set(["/weather", "/forecast", "/uvi", "/air_pollution"]);
const ALLOWED_PARAMS = ["q", "lat", "lon", "units", "lang", "cnt"];

const json = (body, status, cacheControl = "no-store") =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": cacheControl },
  });

// shortcut: anyone can spend our daily quota through this; add per-IP limits if it is ever exhausted.
export const proxyWeather = async (requestUrl, apiKey, http = fetch) => {
  const { searchParams } = new URL(requestUrl);
  const endpoint = searchParams.get("endpoint") ?? "";

  if (!ALLOWED_ENDPOINTS.has(endpoint))
    return json({ message: "Consulta de clima no permitida." }, 400);
  if (!apiKey) return json({ message: "El servicio de clima no está configurado." }, 500);

  const upstream = new URLSearchParams();
  for (const name of ALLOWED_PARAMS) {
    const value = searchParams.get(name);
    if (value) upstream.set(name, value);
  }
  upstream.set("appid", apiKey);

  try {
    const response = await http(`${BASE_URL}${endpoint}?${upstream}`, {
      signal: AbortSignal.timeout(15_000),
    });
    const body = await response.text();
    return new Response(body, {
      status: response.status,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": response.ok ? "public, max-age=600" : "no-store",
      },
    });
  } catch {
    // The error may contain the URL, and therefore the key: never pass it on.
    return json({ message: "No se pudo obtener la información del clima." }, 502);
  }
};
