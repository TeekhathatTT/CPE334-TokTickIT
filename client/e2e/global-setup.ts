import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const serverDir = fileURLToPath(new URL("../../server", import.meta.url));

// Prepare deterministic E2E auth fixtures in the database before the suite runs
// (known passwords + mustChangePassword states). The database itself must
// already be migrated and seeded (docker compose db + prisma migrate reset).
export default function globalSetup() {
  execFileSync(process.execPath, ["scripts/e2e-setup.mjs"], { cwd: serverDir, stdio: "inherit" });
}