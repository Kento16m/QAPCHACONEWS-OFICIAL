import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";

const root = path.resolve(__dirname, "src/admin");

export default defineConfig({
  root,
  envDir: __dirname,
  plugins: [
    TanStackRouterVite({
      target: "react",
      autoCodeSplitting: true,
      routesDirectory: path.join(root, "routes"),
      generatedRouteTree: path.join(root, "routeTree.gen.ts"),
    }),
    react(),
    tailwindcss(),
  ],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  appType: "spa",
  server: { port: 5174 },
  preview: { port: 4180 },
  build: {
    outDir: path.resolve(__dirname, "dist-admin"),
    emptyOutDir: true,
    sourcemap: false,
  },
});
