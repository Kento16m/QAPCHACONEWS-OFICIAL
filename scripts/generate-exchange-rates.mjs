// Writes the fallback rates served at /cotizaciones.json. A scraper problem must never block a deploy.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRatesFetcher } from "../netlify/shared/maxicambios.mjs";

const OUTPUT_PATH = path.resolve("public/cotizaciones.json");

try {
  const { rates, source } = await createRatesFetcher()();
  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(
    OUTPUT_PATH,
    `${JSON.stringify({ rates, source, updatedAt: new Date().toISOString() }, null, 2)}\n`,
    "utf8",
  );
  console.log(`Cotizaciones guardadas en ${OUTPUT_PATH}`);
} catch (error) {
  console.warn(
    `Se continúa sin actualizar las cotizaciones: ${error instanceof Error ? error.message : error}`,
  );
}
