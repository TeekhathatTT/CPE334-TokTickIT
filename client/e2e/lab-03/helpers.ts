import { expect, type Page } from "@playwright/test";

/**
 * Shared Lab 3 E2E helpers (Playwright — same tool as `lab-02.spec.ts`).
 *
 * PREREQUISITE: every spec in this folder assumes a freshly seeded database
 * (`npm run prisma:seed` in `server/`; all seed users share the local-dev
 * password below with `mustChangePassword=true`). The Playwright
 * `globalSetup` reseeds automatically unless `E2E_SEED=0` is set.
 *
 * ACCOUNT PARTITIONING (do not break): specs rotate the passwords of the seed
 * accounts they use, and Playwright may run spec files in parallel workers
 * against one shared database. Each file therefore owns disjoint accounts:
 * - authentication.spec.ts: michael.chen, tom.nguyen, sarah.williams,
 *   david.brown (inactive), plus a nonexistent address.
 * - staff-ticket-flow.spec.ts: priya.patel (IT Staff), jennifer.anderson.
 * - user-administration.spec.ts: alice.admin, plus freshly created `e2e.*`
 *   users with run-unique emails.
 * Adding a seed-account login to a file that does not own that account will
 * cause order-dependent failures.
 */

/** Local-dev-only seed password (see `server/prisma/seed.mjs`). */
export const SEED_PASSWORD = "Password123!";

/**
 * Passwords rotated by earlier tests in the same file. Tests in one spec file
 * run sequentially in a single worker, so a rotation performed by test N is
 * visible to test N+1 through this store; a fresh seed always starts from
 * `SEED_PASSWORD`, keeping reruns deterministic.
 */
const knownPasswords = new Map<string, string>();

export function passwordFor(email: string): string {
  return knownPasswords.get(email) ?? SEED_PASSWORD;
}

export function rememberPassword(email: string, password: string): void {
  knownPasswords.set(email, password);
}

/** A password that satisfies the documented policy (8+, upper, lower, digit, special). */
export function rotationPassword(tag: string): string {
  const stamp = Date.now().toString(36);
  return `E2e-${tag}-${stamp}!1Aa`;
}

/** Short unique token so rows created by a run never collide with leftovers. */
export function runToken(): string {
  return Date.now().toString(36);
}

export async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
}

/**
 * Completes the mandatory password-change screen that every freshly seeded
 * account is gated behind (FR-02/BR-02) and waits until the role shell loads.
 */
export async function completeForcedPasswordChange(
  page: Page,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await expect(page.getByRole("heading", { name: "Change your password" })).toBeVisible();
  await page.getByLabel("Current password", { exact: true }).fill(currentPassword);
  await page.getByLabel("New password", { exact: true }).fill(newPassword);
  await page.getByLabel("Confirm new password", { exact: true }).fill(newPassword);
  await page.getByRole("button", { name: "Save new password" }).click();
}

/** Logs in with the seed password or a password rotated by an earlier test. */
export async function loginKnown(page: Page, email: string): Promise<void> {
  await login(page, email, passwordFor(email));
}

/**
 * Rotates `email` through the forced-change screen to a fresh policy-valid
 * password and records it for later tests in the same file.
 */
export async function rotatePassword(page: Page, email: string, tag: string): Promise<string> {
  const next = rotationPassword(tag);
  await completeForcedPasswordChange(page, passwordFor(email), next);
  rememberPassword(email, next);
  return next;
}

/**
 * Base URL of the API under test. The app itself calls the API through an
 * absolute `VITE_API_URL` (there is no Vite dev proxy), so these helpers must
 * do the same — a relative `fetch("/api/...")` would execute in the browser
 * at the Vite origin (`:5173`) and answer 404 instead of reaching the API.
 * Override with `VITE_API_URL=http://host:port npm run test:e2e` when the API
 * does not run at the default.
 */
export const API_URL = process.env.VITE_API_URL ?? "http://localhost:3000";

function apiUrl(path: string): string {
  return `${API_URL}${path}`;
}

async function readJson(response: { json(): Promise<unknown> }): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * GET against the API returning only the HTTP status. Uses `page.request`,
 * which shares the browser context's session cookie and runs from Node, so
 * it is not subject to the browser's CORS policy.
 */
export async function apiStatus(page: Page, path: string): Promise<number> {
  const response = await page.request.get(apiUrl(path), {
    headers: { Accept: "application/json" },
  });
  return response.status();
}

/** GET against the API returning `{ status, body }` as JSON. */
export async function apiGet<T>(page: Page, path: string): Promise<{ status: number; body: T }> {
  const response = await page.request.get(apiUrl(path), {
    headers: { Accept: "application/json" },
  });
  return { status: response.status(), body: (await readJson(response)) as T };
}

/** PATCH against the API with a JSON body, returning `{ status, body }`. */
export async function apiPatch<B, T>(
  page: Page,
  path: string,
  payload: B,
): Promise<{ status: number; body: T }> {
  const response = await page.request.patch(apiUrl(path), {
    headers: { Accept: "application/json" },
    data: payload,
  });
  return { status: response.status(), body: (await readJson(response)) as T };
}

/** Asserts the page has no unintended horizontal overflow at its viewport. */
export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, "page must not scroll horizontally").toBeLessThanOrEqual(0);
}
