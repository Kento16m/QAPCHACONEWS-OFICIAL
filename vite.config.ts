import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
// @ts-expect-error plain JavaScript module shared with the Netlify function
import { createRatesFetcher } from "./netlify/shared/maxicambios.mjs";
// @ts-expect-error plain JavaScript module shared with the Netlify function
import { proxyWeather } from "./netlify/shared/openweather.mjs";

const fetchRates = createRatesFetcher();

function maxicambiosProxyPlugin(): Plugin {
  const handle = async (req: any, res: any) => {
    try {
      const { rates, source } = await fetchRates();
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.end(
        JSON.stringify({
          rates,
          updatedAt: new Date().toISOString(),
          source,
        }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo cargar la cotización.";
      res.statusCode = 502;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.end(JSON.stringify({ error: message }));
    }
  };

  // Same behavior as netlify/functions/clima.mjs while developing locally.
  const handleWeather = async (req: any, res: any) => {
    const apiKey = loadEnv("development", process.cwd(), "")["OPENWEATHER_API_KEY"]?.trim() ?? "";
    const response = await proxyWeather(`http://localhost${req.url}`, apiKey);
    res.statusCode = response.status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(await response.text());
  };

  return {
    name: "maxicambios-proxy",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url?.startsWith("/api/cotizaciones")) {
          await handle(req, res);
          return;
        }
        if (req.url?.startsWith("/api/clima")) {
          await handleWeather(req, res);
          return;
        }
        next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url?.startsWith("/api/cotizaciones")) {
          await handle(req, res);
          return;
        }
        if (req.url?.startsWith("/api/clima")) {
          await handleWeather(req, res);
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [
    TanStackRouterVite({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    tsconfigPaths(),
    maxicambiosProxyPlugin(),
  ],
  appType: "spa",
  // The panel has its own entry and build: the site must not scan it.
  optimizeDeps: { entries: ["index.html"] },
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: false,
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
    strictPort: false,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
  },
});
