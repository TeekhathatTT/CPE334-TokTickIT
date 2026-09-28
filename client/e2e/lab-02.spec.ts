import { expect, test, type Page } from "@playwright/test";
import {
  expectNoHorizontalOverflow,
  loginKnown,
  rotatePassword,
} from "./lab-03/helpers";

/**
 * Lab 2 regression under Lab 3 authentication.
 *
 * The anonymous "Development Requester" selector this file originally drove
 * was removed by Lab 3 (BR-03/BR-25: ownership comes from the session; the
 * selector UI and `x-requester-id` are gone), so every test now signs in as
 * the seed requester owned by this file (emily.davis — disjoint from the
 * lab-03 spec accounts, see helpers.ts ACCOUNT PARTITIONING) and passes the
 * mandatory first-login password change when the gate appears. Every
 * assertion below is unchanged: ticket creation + official number,
 * validation messages, search/clear filters, and no horizontal overflow at
 * all three viewports.
 */

const REQUESTER = "emily.davis@example.com";

async function loginRequester(page: Page): Promise<void> {
  await page.goto("/");
  await loginKnown(page, REQUESTER);
  // Fresh seeds gate every account behind the password change (FR-02/BR-02);
  // later tests reuse the rotated password via the shared state.
  await expect(page.getByRole("heading", { name: /My Tickets|Change your password/ })).toBeVisible();
  if ((await page.getByRole("heading", { name: "Change your password" }).count()) > 0) {
    await rotatePassword(page, REQUESTER, "lab02");
  }
  await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
}

test("happy path creates a ticket and shows the official ticket number", async ({ page }) => {
  await loginRequester(page);
  await page.getByRole("button", { name: /create ticket/i }).first().click();
  await page.getByLabel("Category").selectOption({ index: 1 });
  await page.getByLabel("Related System").selectOption({ index: 1 });
  await page.getByLabel("Requested Priority").selectOption("MEDIUM");
  await page.getByLabel("Summary").fill("E2E ticket summary");
  await page.getByLabel("Description").fill("This ticket was created by the Lab 2 end to end flow.");
  // Two "Create Ticket" buttons exist (nav tab + form submit): submit via
  // the page header button inside <main>.
  await page.getByRole("main").getByRole("button", { name: "Create Ticket" }).click();
  await expect(page.getByRole("heading", { name: "Ticket Created" })).toBeVisible();
  await expect(page.locator(".success-panel__number")).toHaveText(/TKT-\d{4}-\d{6}/);
});

test("validation prevents an invalid ticket submission", async ({ page }) => {
  await loginRequester(page);
  await page.getByRole("button", { name: /create ticket/i }).first().click();
  await page.getByRole("main").getByRole("button", { name: "Create Ticket" }).click();
  await expect(page.getByText("Summary must be between 5 and 120 characters.")).toBeVisible();
  await expect(page.getByText("Description must be between 10 and 2000 characters.")).toBeVisible();
});

test("requester can search and clear My Tickets filters", async ({ page }) => {
  await loginRequester(page);
  await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
  await page.getByLabel("Search tickets").fill("does-not-exist");
  await expect(page.getByText("No tickets match your filters.")).toBeVisible();
  // Two identical "Clear Filters" buttons exist (list header + empty state)
  // sharing one handler; either clears the search.
  await page.getByRole("button", { name: "Clear Filters" }).first().click();
  await expect(page.getByLabel("Search tickets")).toHaveValue("");
});

for (const viewport of [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 834, height: 1112 },
  { name: "desktop", width: 1280, height: 900 },
]) {
  test(`create ticket has no horizontal overflow at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await loginRequester(page);
    await page.getByRole("button", { name: /create ticket/i }).first().click();
    // Same DOM-measurement method as the Lab 3 RESP-01 tests (no
    // pixel-baseline screenshots, which are OS/font-sensitive): the
    // requirement is no horizontal overflow, and this asserts exactly that.
    await expectNoHorizontalOverflow(page);
  });
}
