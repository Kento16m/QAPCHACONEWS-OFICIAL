import { defineConfig } from "@playwright/test";

const PORT = 4180;
const { E2E_SUPABASE_URL, E2E_ANON_KEY } = process.env;
const CONFIG = "--config vite.admin.config.ts --outDir ../../.playwright/dist-admin";

export default defineConfig({
  testDir: "./e2e/admin",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: { baseURL: `http://127.0.0.1:${PORT}`, viewport: { width: 1280, height: 900 } },
  webServer: {
    command: `npx vite build ${CONFIG} --emptyOutDir && npx vite preview ${CONFIG} --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}`,
    timeout: 180_000,
    reuseExistingServer: false,
    env: { VITE_SUPABASE_URL: E2E_SUPABASE_URL ?? "", VITE_SUPABASE_ANON_KEY: E2E_ANON_KEY ?? "" },
  },
});
