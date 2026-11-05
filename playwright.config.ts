import { defineConfig } from "@playwright/test";

const PORT = 4179;
const { E2E_SUPABASE_URL, E2E_ANON_KEY } = process.env;

export default defineConfig({
  testDir: "./e2e",
  testIgnore: "admin/**",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: { baseURL: `http://127.0.0.1:${PORT}`, viewport: { width: 1280, height: 900 } },
  webServer: {
    // Built against the target given to the test, never whatever .env points to.
    command: `npx vite build --outDir .playwright/dist --emptyOutDir && npx vite preview --outDir .playwright/dist --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}`,
    timeout: 180_000,
    reuseExistingServer: false,
    env: { VITE_SUPABASE_URL: E2E_SUPABASE_URL ?? "", VITE_SUPABASE_ANON_KEY: E2E_ANON_KEY ?? "" },
  },
});
