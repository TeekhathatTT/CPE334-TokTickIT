import { expect } from "@playwright/test";
import { loginWithRotation, runToken, test } from "../lab-03/helpers";

const STAFF_ONE = "lisa.garcia@example.com";
const STAFF_TWO = "priya.patel@example.com";
const REQUESTER = "michael.chen@example.com";
const TICKET = "TKT-2026-000002";

async function loginAs(page: import("@playwright/test").Page, email: string, tag: string, role: RegExp) {
  await loginWithRotation(page, email, tag, role);
}

async function openStaffTicket(page: import("@playwright/test").Page) {
  await page.getByLabel("Search queue").fill(TICKET);
  await page.getByRole("button", { name: TICKET }).first().click();
  await expect(page.getByRole("heading", { name: "Actions Taken" })).toBeVisible();
}

async function recordAction(page: import("@playwright/test").Page, description: string, note?: string) {
  const form = page.locator(".action-form");
  await form.getByLabel("Description").fill(description);
  await form.getByLabel("Result").selectOption("ESCALATED");
  if (note) {
    await form.getByLabel("Follow-up required").check();
    await form.getByLabel("Follow-up note").fill(note);
  }
  await form.getByRole("button", { name: "Record action" }).click();
  await expect(page.locator("li.comment-card--action", { hasText: description })).toBeVisible();
}

test("two staff members author Actions Taken and the requester sees them read-only", async ({ page }) => {
  const token = runToken();
  const firstDescription = `Lisa action ${token}`;
  const secondDescription = `Priya action ${token}`;

  await loginAs(page, STAFF_ONE, "lab04-action-author", /Ticket Queue/);
  await openStaffTicket(page);

  const form = page.locator(".action-form");
  await form.getByLabel("Description").fill(firstDescription);
  await form.getByLabel("Result").selectOption("ESCALATED");
  await form.getByLabel("Follow-up required").check();
  await expect(form.getByLabel("Follow-up note")).toHaveAttribute("aria-invalid", "true");
  await expect(form.getByRole("alert")).toContainText(/Follow-up note is required/);
  await form.getByLabel("Follow-up note").fill("Verify the requester can sign in.");
  await form.getByRole("button", { name: "Record action" }).click();
  await expect(page.locator("li.comment-card--action", { hasText: firstDescription })).toBeVisible();

  await page.getByRole("button", { name: "Logout" }).click();
  await loginAs(page, STAFF_TWO, "lab04-action-second-author", /Ticket Queue/);
  await openStaffTicket(page);
  await recordAction(page, secondDescription);

  await page.getByRole("button", { name: "Logout" }).click();
  await loginAs(page, REQUESTER, "lab04-action-requester", /My Tickets/);
  await page.getByRole("navigation").getByRole("button", { name: "Dashboard" }).click();
  await page.getByRole("button", { name: TICKET }).click();

  const actions = page.locator(".detail-section", {
    has: page.getByRole("heading", { name: "Actions Taken" }),
  });
  await expect(actions.getByText(firstDescription)).toBeVisible();
  await expect(actions.getByText(secondDescription)).toBeVisible();
  await expect(actions.getByText("Recorded by IT — read-only.")).toBeVisible();
  await expect(actions.getByRole("button", { name: "Record action" })).toHaveCount(0);
  await expect(actions.getByRole("button", { name: "Edit" })).toHaveCount(0);
  await expect(actions.getByRole("button", { name: "Mark follow-up resolved" })).toHaveCount(0);
});
