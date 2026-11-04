import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
// @ts-expect-error plain JavaScript module shared with the Netlify function
import { createRatesFetcher } from "./netlify/shared/maxicambios.mjs";

const fetchRates = createRatesFetcher();

function maxicambiosProxyPlugin() {
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

  return {
    name: "maxicambios-proxy",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url?.startsWith("/api/cotizaciones")) {
          await handle(req, res);
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
