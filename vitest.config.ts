import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}", "netlify/**/*.test.mjs", "scripts/**/*.test.mjs", "supabase/functions/**/*.test.ts"],
    env: { TZ: "America/Asuncion" },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
