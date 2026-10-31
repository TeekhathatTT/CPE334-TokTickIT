import { expect, type Locator, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  apiGet,
  apiPatch,
  expectNoHorizontalOverflow,
  loginWithRotation,
  runToken,
  test,
} from "../lab-03/helpers";

const SCREENSHOTS = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../artifacts/lab-04/screenshots",
);
const VIEWPORTS = [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 834, height: 1112 },
  { name: "desktop", width: 1280, height: 900 },
] as const;

async function capture(page: Page, folder: string, name: string, target: string | Locator = ".page-card") {
  const directory = path.join(SCREENSHOTS, folder);
  fs.mkdirSync(directory, { recursive: true });
  const element = typeof target === "string" ? page.locator(target).first() : target;
  await element.screenshot({ path: path.join(directory, name) });
}

async function openStaffTicket(page: Page, ticketNumber: string) {
  await page.getByRole("navigation").getByRole("button", { name: "Ticket Queue" }).click();
  await page.getByLabel("Search queue").fill(ticketNumber);
  await page.getByRole("button", { name: ticketNumber }).first().click();
  await expect(page.getByRole("heading", { name: "Ticket Details" })).toBeVisible();
}

async function openRequesterTicket(page: Page, ticketNumber: string) {
  await page.getByRole("navigation").getByRole("button", { name: "Dashboard" }).click();
  await page.getByRole("button", { name: ticketNumber }).click();
  await expect(page.getByRole("heading", { name: "Ticket Details" })).toBeVisible();
}

test("captures requester dashboards and Lab 1–3 regression screens", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await capture(page, "regression", "login-desktop.png", "body");

  await loginWithRotation(page, "michael.chen@example.com", "lab04-visual-requester", /My Tickets/);
  await page.getByRole("navigation").getByRole("button", { name: "Dashboard" }).click();
  const openTickets = page.getByRole("article", { name: "Open tickets" });
  await expect(openTickets).toBeVisible();
  await openTickets.getByRole("button", { name: "View tickets" }).click();
  await expect(page.getByLabel("Active filters")).toContainText("Statuses:");
  await capture(page, "regression", "my-tickets-desktop.png");
  await openRequesterTicket(page, "TKT-2026-000002");
  await expect(page.getByRole("heading", { name: "Attachments" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Public Comments" })).toBeVisible();
  await capture(page, "regression", "ticket-detail-attachments-comments-desktop.png");

  await page.getByRole("button", { name: "Logout" }).click();
  await loginWithRotation(page, "kevin.thompson@example.com", "lab04-visual-zero", /My Tickets/);
  await page.route("**/api/dashboard/requester", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await route.continue();
  });
  await page.getByRole("navigation").getByRole("button", { name: "Dashboard" }).click();
  await expect(page.locator(".loading-state")).toBeVisible();
  await capture(page, "requester-dashboard", "requester-dashboard-loading.png");
  await expect(page.locator(".metric-card__value").first()).toBeVisible();
  await page.unroute("**/api/dashboard/requester");
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await expectNoHorizontalOverflow(page);
    await capture(page, "requester-dashboard", `requester-dashboard-zero-${viewport.name}.png`);
  }
  await page.setViewportSize({ width: 1280, height: 900 });

  await page.getByRole("button", { name: "Logout" }).click();
  await loginWithRotation(page, "michael.chen@example.com", "lab04-visual-requester-repeat", /My Tickets/);
  await page.getByRole("navigation").getByRole("button", { name: "Dashboard" }).click();
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await expect(page.getByRole("article", { name: "Open tickets" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await capture(page, "requester-dashboard", `requester-dashboard-populated-${viewport.name}.png`);
  }
});

test("captures staff dashboard states, Actions Taken, resolution, and admin regression", async ({ page }) => {
  test.setTimeout(120_000);
  await loginWithRotation(page, "lisa.garcia@example.com", "lab04-visual-staff", /Ticket Queue/);

  let mode: "loading" | "forbidden" | "failure" | null = null;
  await page.route("**/api/dashboard/staff", async (route) => {
    if (mode === "loading") {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      await route.continue();
    } else if (mode === "forbidden" || mode === "failure") {
      await route.fulfill({
        status: mode === "forbidden" ? 403 : 500,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            code: mode === "forbidden" ? "FORBIDDEN" : "INTERNAL_ERROR",
            message: mode === "forbidden" ? "You do not have permission to view this dashboard." : "Unable to load dashboard.",
          },
        }),
      });
    } else {
      await route.continue();
    }
  });

  mode = "loading";
  await page.getByRole("navigation").getByRole("button", { name: "Dashboard" }).click();
  await expect(page.locator(".loading-state")).toBeVisible();
  await capture(page, "staff-dashboard", "staff-dashboard-loading.png");

  mode = "forbidden";
  await page.getByRole("navigation").getByRole("button", { name: "Ticket Queue" }).click();
  await page.getByRole("navigation").getByRole("button", { name: "Dashboard" }).click();
  await expect(page.getByRole("alert")).toContainText("permission");
  await capture(page, "staff-dashboard", "staff-dashboard-forbidden-403.png");

  mode = "failure";
  await page.getByRole("navigation").getByRole("button", { name: "Ticket Queue" }).click();
  await page.getByRole("navigation").getByRole("button", { name: "Dashboard" }).click();
  await expect(page.getByRole("alert")).toContainText("Unable to load dashboard");
  await capture(page, "staff-dashboard", "staff-dashboard-safe-failure.png");

  mode = null;
  await page.getByRole("alert").getByRole("button", { name: "Retry" }).click();
  await expect(page.getByRole("article", { name: "Pending follow-up" })).toBeVisible();
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await expectNoHorizontalOverflow(page);
    await capture(page, "staff-dashboard", `staff-dashboard-populated-${viewport.name}.png`);
  }

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("article", { name: "Pending follow-up" }).getByRole("button", { name: "View queue" }).click();
  await expect(page.getByRole("heading", { name: "Ticket Queue" })).toBeVisible();
  await expect(page.getByLabel("Active filters")).toContainText("Pending follow-up: Yes");
  await capture(page, "regression", "staff-queue-drilldown-desktop.png");

  await openStaffTicket(page, "TKT-2026-000002");
  await expect(page.getByRole("heading", { name: "Internal Notes" })).toBeVisible();
  await capture(page, "regression", "staff-ticket-detail-internal-notes-desktop.png");
  await capture(page, "actions-taken", "actions-taken-resolution-blocked.png", ".warning-panel");

  const form = page.locator(".action-form");
  const token = runToken();
  const description = `Visual action ${token}`;
  await form.getByLabel("Description").fill(description);
  await form.getByLabel("Result").selectOption("WORKAROUND");
  await form.getByLabel("Follow-up required").check();
  await expect(form.getByRole("alert")).toContainText("Follow-up note is required");
  await capture(page, "actions-taken", "actions-taken-follow-up-note-validation.png", ".action-form");
  await form.getByLabel("Follow-up note").fill("Recheck the service with the requester.");
  await form.getByRole("button", { name: "Record action" }).click();
  await expect(page.getByText(description)).toBeVisible();

  await page.getByRole("button", { name: "Logout" }).click();
  await loginWithRotation(page, "priya.patel@example.com", "lab04-visual-second-staff", /Ticket Queue/);
  await openStaffTicket(page, "TKT-2026-000002");
  const secondDescription = `Second visual action ${token}`;
  const secondForm = page.locator(".action-form");
  await secondForm.getByLabel("Description").fill(secondDescription);
  await secondForm.getByLabel("Result").selectOption("INFO_REQUESTED");
  await secondForm.getByRole("button", { name: "Record action" }).click();
  await expect(page.getByText(secondDescription)).toBeVisible();

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await expectNoHorizontalOverflow(page);
    const actionsSection = page.locator(".detail-section").filter({
      has: page.getByRole("heading", { name: "Actions Taken" }),
    });
    await capture(page, "actions-taken", `actions-taken-staff-${viewport.name}.png`, actionsSection);
  }

  await page.setViewportSize({ width: 1280, height: 900 });
  await openStaffTicket(page, "TKT-2026-000007");
  const ticket = await apiGet<{ data: { updatedAt: string } }>(page, "/api/staff/tickets/7");
  expect(ticket.status).toBe(200);
  const external = await apiPatch<
    { itPriority: string; expectedUpdatedAt: string },
    { data: { updatedAt: string } }
  >(page, "/api/staff/tickets/7/priority", {
    itPriority: "LOW",
    expectedUpdatedAt: ticket.body.data.updatedAt,
  });
  expect(external.status).toBe(200);
  await page.getByLabel("IT Priority").selectOption("MEDIUM");
  await expect(page.getByRole("alert")).toContainText("Someone else changed this ticket.");
  await capture(page, "regression", "ticket-conflict-409-desktop.png", ".warning-panel");

  await openStaffTicket(page, "TKT-2026-000002");
  const pendingActions = page.getByRole("button", { name: "Mark follow-up resolved" });
  await expect(pendingActions.first()).toBeVisible();
  while (await pendingActions.count()) {
    const pendingCount = await pendingActions.count();
    await pendingActions.first().click();
    await expect(pendingActions).toHaveCount(pendingCount - 1);
  }
  await openStaffTicket(page, "TKT-2026-000002");
  await expect(pendingActions).toHaveCount(0);
  await expect(page.getByText("Resolution is blocked")).toHaveCount(0);
  const statusControl = page.getByLabel("Change status");
  const allowedOptions = await statusControl.locator("option").evaluateAll((options) =>
    options.map((option) => (option as HTMLOptionElement).value),
  );
  expect(allowedOptions).toContain("RESOLVED");
  const statusSection = page.locator(".detail-section").filter({
    has: page.getByRole("heading", { name: "Status" }),
  });
  await capture(page, "actions-taken", "ticket-resolution-permitted-statuses.png", statusSection);
  await statusControl.selectOption("RESOLVED");
  await expect(page.getByText("Status updated.")).toBeVisible();
  await capture(page, "actions-taken", "ticket-resolution-allowed.png", statusSection);

  await page.getByRole("button", { name: "Logout" }).click();
  await loginWithRotation(page, "michael.chen@example.com", "lab04-visual-requester-actions", /My Tickets/);
  await openRequesterTicket(page, "TKT-2026-000002");
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await expectNoHorizontalOverflow(page);
    const actionsSection = page.locator(".detail-section").filter({
      has: page.getByRole("heading", { name: "Actions Taken" }),
    });
    await capture(page, "actions-taken", `actions-taken-requester-read-only-${viewport.name}.png`, actionsSection);
  }

  await page.getByRole("button", { name: "Logout" }).click();
  await loginWithRotation(page, "alice.admin@example.com", "lab04-visual-admin", /User Management/);
  await capture(page, "regression", "admin-user-management-desktop.png");
});
