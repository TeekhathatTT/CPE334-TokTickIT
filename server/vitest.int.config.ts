import { defineConfig } from "vitest/config";

// Integration test config: runs tests/int/** against a real PostgreSQL database
// (see docker-compose.yml). These tests are NOT part of `npm test` — they need
// DATABASE_URL to point at a migrated schema, so they run via `npm run test:int`
// (locally or in a dedicated CI job that provisions the database first).
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/int/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
});