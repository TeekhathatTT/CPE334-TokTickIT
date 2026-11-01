import AxeBuilder from "@axe-core/playwright";
import { expect } from "@playwright/test";
import { apiStatus, loginWithRotation, test } from "../lab-03/helpers";

const REQUESTER = "michael.chen@example.com";
const ZERO_REQUESTER = "kevin.thompson@example.com";
const STAFF = "lisa.garcia@example.com";
const ADMIN = "alice.admin@example.com";

async function loginAs(page: import("@playwright/test").Page, email: string, tag: string, role: RegExp) {
  await loginWithRotation(page, email, tag, role);
}

async function expectAccessible(page: import("@playwright/test").Page, screen: string) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, `${screen} accessibility violations`).toEqual([]);
}

test("requester dashboard has seeded metrics and cannot call staff dashboard", async ({ page }) => {
  await loginAs(page, REQUESTER, "lab04-dashboard-requester", /My Tickets/);

  expect(await apiStatus(page, "/api/dashboard/staff")).toBe(403);
  await page.getByRole("navigation").getByRole("button", { name: "Dashboard" }).click();

  await expect(page.getByRole("article", { name: "Total submitted" }).locator(".metric-card__value")).toHaveText("2");
  await expect(page.getByRole("article", { name: "Open tickets" }).locator(".metric-card__value")).toHaveText("1");
  await expectAccessible(page, "requester dashboard");
});

test("requester, staff, and admin screens pass axe checks", async ({ page }) => {
  await loginAs(page, ZERO_REQUESTER, "lab04-dashboard-zero", /My Tickets/);
  await page.getByRole("navigation").getByRole("button", { name: "Dashboard" }).click();
  await expect(page.getByRole("article", { name: "Total submitted" }).locator(".metric-card__value")).toHaveText("0");
  await expectAccessible(page, "zero-ticket requester dashboard");

  await page.getByRole("button", { name: "Logout" }).click();
  await loginAs(page, REQUESTER, "lab04-dashboard-detail", /My Tickets/);
  await page.getByRole("navigation").getByRole("button", { name: "Dashboard" }).click();
  await page.getByRole("button", { name: "TKT-2026-000002" }).click();
  await expect(page.getByRole("heading", { name: "Ticket Details" })).toBeVisible();
  await expectAccessible(page, "requester ticket detail");

  await page.getByRole("button", { name: "Logout" }).click();
  await loginAs(page, STAFF, "lab04-dashboard-staff", /Ticket Queue/);
  await page.getByRole("navigation").getByRole("button", { name: "Dashboard" }).click();
  await expect(page.getByRole("article", { name: "Pending follow-up" })).toBeVisible();
  await expectAccessible(page, "staff dashboard");

  await page.getByRole("navigation").getByRole("button", { name: "Ticket Queue" }).click();
  await page.getByLabel("Search queue").fill("TKT-2026-000002");
  await page.getByRole("button", { name: "TKT-2026-000002" }).first().click();
  await expect(page.getByRole("heading", { name: "Actions Taken" })).toBeVisible();
  await expectAccessible(page, "staff Actions Taken");

  await page.getByRole("button", { name: "Logout" }).click();
  await loginAs(page, ADMIN, "lab04-dashboard-admin", /User Management/);
  await expectAccessible(page, "admin user management");
});
