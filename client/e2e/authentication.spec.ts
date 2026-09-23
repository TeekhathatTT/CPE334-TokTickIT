import { expect, test } from "@playwright/test";

// Helper: log in with the given credentials
async function loginAs(page: import("@playwright/test").Page, email: string, password: string) {
  await page.goto("/");
  // The app has no client-side router — the login form renders at "/" for
  // unauthenticated visitors, so there is no /login URL to wait for.
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
}

// Auth fixtures are prepared by e2e/global-setup.ts (known passwords +
// deterministic mustChangePassword state) — no env vars required.
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "morgan.davis@example.com";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "TokTickit1!";
const FORCE_CHANGE_EMAIL = process.env.E2E_FORCE_CHANGE_EMAIL ?? "priya.patel@example.com";
const FORCE_CHANGE_PASSWORD = process.env.E2E_FORCE_CHANGE_PASSWORD ?? "TokTickit1!";

// ─── Login flow ────────────────────────────────────────────────────────────

test.describe("Authentication — login flow", () => {
  test("shows a generic error for wrong credentials without revealing which field failed", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel(/email/i).fill("nobody@example.com");
    await page.getByLabel(/password/i).fill("WrongPass1!");
    await page.getByRole("button", { name: /sign in/i }).click();
    const alert = page.getByRole("alert");
    await expect(alert).toBeVisible();
    // Must NOT say "email not found", "unknown email", etc.
    await expect(alert).not.toContainText(/email not found|unknown email|wrong email/i);
  });

  test("successful login redirects to the main application page", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    // The administrator leaves the login form and lands on User Management.
    await expect(page.getByRole("heading", { name: "User Management" })).toBeVisible({ timeout: 8_000 });
  });
});

// ─── Change-password flow ───────────────────────────────────────────────────

test.describe("Authentication — forced password change", () => {
  test("user with mustChangePassword is redirected to change-password screen", async ({ page }) => {
    await loginAs(page, FORCE_CHANGE_EMAIL, FORCE_CHANGE_PASSWORD);
    await expect(page.getByRole("heading", { name: /change your password/i })).toBeVisible({ timeout: 8_000 });
  });

  test("password rule checklist shows requirements before form submission", async ({ page }) => {
    await loginAs(page, FORCE_CHANGE_EMAIL, FORCE_CHANGE_PASSWORD);
    await expect(page.getByRole("heading", { name: /change your password/i })).toBeVisible({ timeout: 8_000 });
    // The helper text must mention the password rules
    await expect(page.getByText(/at least 8 characters/i)).toBeVisible();
    await expect(page.getByText(/upper and lower case/i)).toBeVisible();
  });
});

// ─── Responsive screenshots ─────────────────────────────────────────────────

test.describe("Authentication — responsive screenshots", () => {
  const breakpoints = [
    { name: "desktop", width: 1280, height: 800 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "mobile", width: 375, height: 812 },
  ];

  for (const bp of breakpoints) {
    test(`login page renders correctly on ${bp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await page.goto("/");
      await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
      await page.screenshot({
        path: `../artifacts/lab-03/screenshots/authentication/${bp.name}.png`,
        fullPage: true,
      });
    });
  }
});
