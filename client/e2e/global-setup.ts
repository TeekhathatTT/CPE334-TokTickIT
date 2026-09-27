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
  if (process.env.E2E_SEED === "0") {
    console.log("[e2e] E2E_SEED=0 — skipping database reseed.");
    return;
  }

  const here = path.dirname(fileURLToPath(import.meta.url));
  const serverDir = path.resolve(here, "..", "..", "server");
  console.log("[e2e] Reseeding the database from", serverDir);

  try {
    const { stdout, stderr } = await execFileAsync("node", ["prisma/seed.mjs"], {
      cwd: serverDir,
      timeout: 180000,
      env: process.env,
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
