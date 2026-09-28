import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  reporter: "html",
  use: {
    // NOTE (lab3-e2e-integration): the API's CORS/CSRF contract allows exactly
    // one web origin (`CLIENT_URL`, default `http://localhost:5173`). Running
    // the suite from 127.0.0.1 makes the browser send
    // `Origin: http://127.0.0.1:5173`, which the API rejects, so every
    // session/authenticated call fails with "Failed to fetch". The baseURL
    // must therefore be the localhost origin (test-harness alignment only —
    // no application behavior is changed). `CLIENT_URL` remains the escape
    // hatch for environments that serve the client elsewhere.
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: [
    {
      command: "npm run dev -- --host 127.0.0.1",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
    {
      command: "npm run dev",
      cwd: "../server",
      url: "http://127.0.0.1:3000/api/health",
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
      // Explicit E2E environment for the API (mirrors server/.env): Node
      // does not load server/.env on its own, so a server started here
      // without these would boot with no DATABASE_URL and every Prisma
      // route would fail its database connection.
      env: {
        ...process.env,
        DATABASE_URL:
          process.env.DATABASE_URL ??
          "postgresql://toktickit:toktickit@127.0.0.1:5434/toktickit?schema=public",
        CLIENT_URL: process.env.CLIENT_URL ?? "http://localhost:5173",
        PORT: process.env.PORT ?? "3000",
      },
    },
  ],
});
