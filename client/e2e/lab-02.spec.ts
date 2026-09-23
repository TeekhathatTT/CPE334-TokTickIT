import { expect, test } from "@playwright/test";

// The Lab 3 app replaced the Lab 2 requester-selection screen with real
// authentication: the requester identity comes from the signed-in session.
async function loginAsRequester(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByLabel(/email/i).fill(process.env.E2E_REQUESTER_EMAIL ?? "jennifer.anderson@example.com");
  await page.getByLabel(/password/i).fill(process.env.E2E_REQUESTER_PASSWORD ?? "TokTickit1!");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible({ timeout: 10_000 });
}

test("happy path creates a ticket and shows the official ticket number", async ({ page }) => {
  await loginAsRequester(page);
  await page.getByRole("button", { name: /create ticket/i }).first().click();
  await page.getByLabel("Category").selectOption({ index: 1 });
  await page.getByLabel("Related System").selectOption({ index: 1 });
  await page.getByLabel("Requested Priority").selectOption("MEDIUM");
  await page.getByLabel("Summary").fill("E2E ticket summary");
  await page.getByLabel("Description").fill("This ticket was created by the Lab 2 end to end flow.");
  // The "Create Ticket" nav tab and the submit button share a name — scope to the main region.
  await page.getByRole("main").getByRole("button", { name: "Create Ticket" }).click();
  await expect(page.getByRole("heading", { name: "Ticket Created" })).toBeVisible();
  await expect(page.locator(".success-panel__number")).toHaveText(/TKT-\d{4}-\d{6}/);
});

test("validation prevents an invalid ticket submission", async ({ page }) => {
  await loginAsRequester(page);
  await page.getByRole("button", { name: /create ticket/i }).first().click();
  await page.getByRole("main").getByRole("button", { name: "Create Ticket" }).click();
  await expect(page.getByText("Summary must be between 5 and 120 characters.")).toBeVisible();
  await expect(page.getByText("Description must be between 10 and 2000 characters.")).toBeVisible();
});

test("requester can search and clear My Tickets filters", async ({ page }) => {
  await loginAsRequester(page);
  await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
  await page.getByLabel("Search tickets").fill("does-not-exist");
  await expect(page.getByText("No tickets match your filters.")).toBeVisible();
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
    await loginAsRequester(page);
    await page.getByRole("button", { name: /create ticket/i }).first().click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page).toHaveScreenshot(`create-ticket-${viewport.name}.png`, { fullPage: true });
  });
}
