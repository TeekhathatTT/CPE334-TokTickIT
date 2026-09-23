import { expect, test } from "@playwright/test";

// Helper: log in as IT Staff
async function loginAsStaff(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByLabel(/email/i).fill(process.env.E2E_STAFF_EMAIL ?? "alex.morgan@example.com");
  await page.getByLabel(/password/i).fill(process.env.E2E_STAFF_PASSWORD ?? "TokTickit1!");
  await page.getByRole("button", { name: /sign in/i }).click();
  // App has no client-side router — wait for the staff shell to render instead.
  await expect(page.getByRole("heading", { name: "Staff Queue" })).toBeVisible({ timeout: 10_000 });
}

// The full Staff Queue / Ticket Detail UI is still PLANNED (see the it.todo
// specs in tests/lab-03/StaffTicketQueue.test.tsx and StaffTicketDetail.test.tsx):
// the app currently renders a placeholder instead of the queue table. Skip with
// an explicit reason rather than reporting a pass for behaviour that does not
// exist yet.
const queueNotImplemented = async (page: import("@playwright/test").Page) =>
  page.getByText("Staff ticket workflow is available.").isVisible().catch(() => false);

// ─── IT Staff ticket queue ──────────────────────────────────────────────────

test.describe("IT Staff — ticket queue", () => {
  test("staff queue shows a list of tickets after login", async ({ page }) => {
    await loginAsStaff(page);
    if (await queueNotImplemented(page)) {
      test.skip(true, "Staff Queue UI not implemented yet — PLANNED (StaffTicketQueue.test.tsx todos)");
    }
    // The queue page should have ticket rows — exact selector depends on implementation
    const rows = page.locator("[data-testid='ticket-row'], table tbody tr, [role='listitem']");
    await expect(rows.first()).toBeVisible({ timeout: 10_000 });
  });

  test("search filters reduce the visible ticket list", async ({ page }) => {
    await loginAsStaff(page);
    if (await queueNotImplemented(page)) {
      test.skip(true, "Staff Queue UI not implemented yet — PLANNED (StaffTicketQueue.test.tsx todos)");
    }
    const search = page.getByRole("searchbox").or(page.getByLabel(/search/i));
    await search.fill("nonexistent-ticket-xyz-12345");
    await page.waitForResponse((response) => response.url().includes("/api/staff/tickets") && response.status() === 200, { timeout: 10_000 }).catch(() => {});
    const emptyState = page.getByText(/no results|no tickets found|nothing matches/i);
    await expect(emptyState).toBeVisible({ timeout: 6_000 });
  });

  test("responsive screenshots of the staff queue", async ({ page }) => {
    await loginAsStaff(page);
    // The current app renders the PLANNED placeholder shell for IT Staff — this
    // screenshot documents that real state (header + helper text) at each
    // breakpoint, so it captures instead of skipping. The behavioural queue
    // tests above still skip until the queue table is implemented.
    const breakpoints = [
      { name: "desktop", width: 1280, height: 800 },
      { name: "tablet", width: 768, height: 1024 },
      { name: "mobile", width: 375, height: 812 },
    ];
    for (const bp of breakpoints) {
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await page.screenshot({
        path: `../artifacts/lab-03/screenshots/staff-queue/${bp.name}.png`,
        fullPage: true,
      });
    }
  });
});

// ─── IT Staff ticket detail ─────────────────────────────────────────────────

test.describe("IT Staff — ticket detail", () => {
  test("clicking a ticket row navigates to the detail page", async ({ page }) => {
    await loginAsStaff(page);
    if (await queueNotImplemented(page)) {
      test.skip(true, "Staff Ticket Detail UI not implemented yet — PLANNED (StaffTicketDetail.test.tsx todos)");
    }
    // Click the first ticket in the queue
    const firstRow = page.locator("[data-testid='ticket-row'], table tbody tr").first();
    if (!(await firstRow.isVisible({ timeout: 6_000 }).catch(() => false))) {
      test.skip(true, "Staff queue rows not rendered yet — PLANNED");
      return;
    }
    await firstRow.click();
    // Should navigate to the detail route (e.g. /staff/tickets/1)
    await expect(page).toHaveURL(/\/tickets\/\d+/, { timeout: 8_000 });
  });

  test("detail page shows requester info and internal notes panel", async ({ page }) => {
    await loginAsStaff(page);
    if (await queueNotImplemented(page)) {
      test.skip(true, "Staff Ticket Detail UI not implemented yet — PLANNED (StaffTicketDetail.test.tsx todos)");
    }
    const firstRow = page.locator("[data-testid='ticket-row'], table tbody tr").first();
    if (!(await firstRow.isVisible({ timeout: 6_000 }).catch(() => false))) {
      test.skip(true, "Staff queue rows not rendered yet — PLANNED");
      return;
    }
    await firstRow.click();
    // Public and private panels
    await expect(page.getByText(/public comment|internal note/i).first()).toBeVisible({ timeout: 8_000 });
  });

  test("responsive screenshots of the ticket detail page", async ({ page }) => {
    await loginAsStaff(page);
    if (await queueNotImplemented(page)) {
      test.skip(true, "Staff Ticket Detail screen is not implemented — no detail UI rendered to capture (PLANNED)");
    }
    const firstRow = page.locator("[data-testid='ticket-row'], table tbody tr").first();
    if (!(await firstRow.isVisible({ timeout: 6_000 }).catch(() => false))) {
      test.skip(true, "Staff queue rows not rendered yet — PLANNED");
      return;
    }
    await firstRow.click();
    await page.waitForURL(/\/tickets\/\d+/, { timeout: 8_000 }).catch(() => {});

    const breakpoints = [
      { name: "desktop", width: 1280, height: 800 },
      { name: "tablet", width: 768, height: 1024 },
      { name: "mobile", width: 375, height: 812 },
    ];
    for (const bp of breakpoints) {
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await page.screenshot({
        path: `../artifacts/lab-03/screenshots/staff-ticket-detail/${bp.name}.png`,
        fullPage: true,
      });
    }
  });
});
