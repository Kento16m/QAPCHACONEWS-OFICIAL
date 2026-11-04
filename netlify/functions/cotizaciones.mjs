import { createRatesFetcher } from "../shared/maxicambios.mjs";

const fetchRates = createRatesFetcher();

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export default async function handler(request) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    const { rates, source } = await fetchRates();
    return Response.json(
      { rates, source, updatedAt: new Date().toISOString() },
      { headers: { ...CORS_HEADERS, "cache-control": "public, max-age=300" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo cargar la cotización.";
    return Response.json({ error: message }, { status: 502, headers: { ...CORS_HEADERS, "cache-control": "no-store" } });
  }
}
