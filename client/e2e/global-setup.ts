import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * Playwright global setup: reseed the database once before the E2E suite so
 * every run starts from the documented seed (all users on the local-dev
 * initial password with `mustChangePassword=true`).
 *
 * The reseed makes the suite hermetic when a database is available; without
 * one the E2E specs cannot run at all (they exercise the real API).
 * Set `E2E_SEED=0` to skip (e.g. hand-managed grading data), in which case
 * the specs assume an equivalently fresh seed.
 */
async function globalSetup(): Promise<void> {
  // Cross-test shared state (rotated passwords, mid-file created users) is
  // always stale on a new run: the database is reseeded below, so any
  // previous run's values would authenticate against the wrong passwords.
  const { clearSharedState } = await import("./lab-03/helpers.js");
  clearSharedState();

  if (process.env.E2E_SEED === "0") {
    console.log("[e2e] E2E_SEED=0 — skipping database reseed.");
    return;
  }

  const here = path.dirname(fileURLToPath(import.meta.url));
  const serverDir = path.resolve(here, "..", "..", "server");
  console.log("[e2e] Reseeding the database from", serverDir);

  // The seed assumes tables exist: migrate first so a fresh database works
  // with a bare `npm run test:e2e` (no manual prisma steps). The Node
  // processes below do not load server/.env on their own, so pass an
  // explicit DATABASE_URL (same default as the webServer entry in
  // playwright.config.ts and server/.env).
  const env = {
    ...process.env,
    DATABASE_URL:
      process.env.DATABASE_URL ??
      "postgresql://toktickit:toktickit@127.0.0.1:5434/toktickit?schema=public",
  };

  try {
    // Invoke the Prisma CLI through node directly (`npx` is a shell shim
    // that child_process cannot spawn without a shell on Windows).
    const prismaBin = path.resolve(serverDir, "node_modules", "prisma", "build", "index.js");
    await execFileAsync(process.execPath, [prismaBin, "migrate", "deploy"], {
      cwd: serverDir,
      timeout: 180000,
      env,
    });
    const { stdout, stderr } = await execFileAsync("node", ["prisma/seed.mjs"], {
      cwd: serverDir,
      timeout: 180000,
      env,
    });
    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);
  } catch (error) {
    throw new Error(
      `[e2e] Database reseed failed — is Postgres reachable (see server/.env DATABASE_URL)? ` +
        `Set E2E_SEED=0 to skip when the database is managed externally. Cause: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export default globalSetup;
