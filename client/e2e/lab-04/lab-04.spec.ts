import { expect, type Page } from "@playwright/test";
import {
  apiGet,
  apiPatch,
  expectNoHorizontalOverflow,
  loginKnown,
  rotatePassword,
  runToken,
  test,
} from "../lab-03/helpers";

/**
 * Lab 4 E2E (AC-04, AC-05, AC-07, AC-09, AC-10, AC-13).
 *
 * Owns seed accounts: lisa.garcia (IT Staff) and kevin.thompson (Requester
 * with zero tickets). Both are disjoint from the Lab 2 / Lab 3 spec accounts
 * listed in `../lab-03/helpers.ts`. The Playwright global setup reseeds the
 * database before the run, so every assertion starts from the documented
 * seed state (other spec files may still mutate unrelated tickets in
 * parallel, so dashboard values are compared to the live API response rather
 * than hard-coded counts).
 *
 * Seed rows used:
 * - TKT-2026-000002: OPEN, one pending follow-up (dashboard drill-down).
 * - TKT-2026-000004: WAITING_FOR_REQUESTER, owned by Lisa, existing action
 *   authored by Lisa (create/edit/resolve/gate flow).
 * - TKT-2026-000005: RESOLVED (dashboard drill-down).
 * - TKT-2026-000007: REOPENED, owned by Lisa (stale-write recovery).
 * - Kevin Thompson: no tickets (requester dashboard zero state, then a newly
 *   created ticket for the populated state and read-only Actions Taken).
 */

const STAFF = "lisa.garcia@example.com";
const REQUESTER = "kevin.thompson@example.com";

interface CurrentUserResponse {
  data: { user: { id: number; name: string; email: string; role: string } };
}

interface StaffDashboardData {
  unassignedActive: number;
  assignedToMe: number;
  waitingForRequester: number;
  pendingFollowUp: number;
  pendingFollowUpTicketIds: number[];
  resolvedPendingClose: number;
  newToday: number;
  newTodaySince: string;
}

interface RequesterDashboardData {
  openTickets: number;
  awaitingMyResponse: number;
  recentlyResolved: number;
  recentlyResolvedSince: string;
  totalSubmitted: number;
  recentTickets: Array<{ id: number; ticketNumber: string; summary: string; status: string; updatedAt: string }>;
}

interface ActionTaken {
  id: number;
  description: string;
  result: string;
  followUpRequired: boolean;
  followUpResolvedAt: string | null;
  updatedAt: string;
}

interface ActionListResponse {
  data: ActionTaken[];
}

interface TicketDetailResponse {
  data: { id: number; ticketNumber: string; status: string; updatedAt: string; pendingFollowUpCount: number };
}

async function loginWithRotation(page: Page, email: string, tag: string, home: RegExp): Promise<void> {
  await loginKnown(page, email);
  await expect(page.getByRole("heading", { name: /Change your password|Dashboard|My Tickets|Ticket Queue/ })).toBeVisible();
  if ((await page.getByRole("heading", { name: "Change your password" }).count()) > 0) {
    await rotatePassword(page, email, tag);
  }
  await expect(page.getByRole("heading", { name: home })).toBeVisible();
}

async function openDashboard(page: Page): Promise<void> {
  const dashboard = page.getByRole("navigation").getByRole("button", { name: "Dashboard" });
  if (!(await dashboard.isVisible())) {
    await page.getByRole("button", { name: "Open navigation menu" }).click();
  }
  await dashboard.click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.locator(".metric-card__value").first()).toBeVisible();
}

async function openSeedTicket(page: Page, ticketNumber: string): Promise<void> {
  await expect(page.getByRole("heading", { name: "Ticket Queue" })).toBeVisible();
  await page.getByLabel("Search queue").fill(ticketNumber);
  await page.getByRole("button", { name: ticketNumber }).first().click();
  await expect(page.getByRole("heading", { name: "Ticket Details" })).toBeVisible();
}

async function seedTicketId(page: Page, ticketNumber: string): Promise<number> {
  const found = await apiGet<{ data: Array<{ id: number; ticketNumber: string }> }>(
    page,
    `/api/staff/tickets?search=${encodeURIComponent(ticketNumber)}`,
  );
  expect(found.status).toBe(200);
  const row = found.body.data.find((ticket) => ticket.ticketNumber === ticketNumber);
  expect(row, `seed ticket ${ticketNumber} must exist`).toBeTruthy();
  return row!.id;
}

function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

test("staff dashboard cards match the live API and each card opens its documented drill-down", async ({ page }) => {
  await loginWithRotation(page, STAFF, "lab04-staff-dashboard", /Ticket Queue/);
  const consoleErrors = collectConsoleErrors(page);
  await openDashboard(page);

  const me = await apiGet<CurrentUserResponse>(page, "/api/auth/me");
  expect(me.status).toBe(200);
  const data = await apiGet<{ data: StaffDashboardData }>(page, "/api/dashboard/staff");
  expect(data.status).toBe(200);

  const expected: Record<string, number> = {
    "Unassigned active": data.body.data.unassignedActive,
    "Assigned to me": data.body.data.assignedToMe,
    "Waiting for requester": data.body.data.waitingForRequester,
    "Pending follow-up": data.body.data.pendingFollowUp,
    "Resolved pending close": data.body.data.resolvedPendingClose,
    "New today": data.body.data.newToday,
  };
  for (const [label, value] of Object.entries(expected)) {
    await expect(page.getByRole("article", { name: label }).locator(".metric-card__value")).toHaveText(String(value));
  }
  async function drill(card: string): Promise<URL> {
    const requestPromise = page.waitForRequest(
      (request) => request.method() === "GET" && request.url().includes("/api/staff/tickets?"),
    );
    await page.getByRole("article", { name: card }).getByRole("button", { name: "View queue" }).click();
    const requestUrl = new URL((await requestPromise).url());
    await expect(page.getByRole("heading", { name: "Ticket Queue" })).toBeVisible();
    return requestUrl;
  }

  let url = await drill("Unassigned active");
  expect(url.searchParams.get("ownerId")).toBe("unassigned");
  expect(url.searchParams.getAll("status")).toEqual([
    "NEW",
    "OPEN",
    "IN_PROGRESS",
    "WAITING_FOR_REQUESTER",
    "REOPENED",
  ]);

  await openDashboard(page);
  url = await drill("Assigned to me");
  expect(url.searchParams.get("ownerId")).toBe(String(me.body.data.user.id));
  expect(url.searchParams.getAll("status")).toContain("RESOLVED");

  await openDashboard(page);
  url = await drill("Waiting for requester");
  expect(url.searchParams.getAll("status")).toEqual(["WAITING_FOR_REQUESTER"]);

  await openDashboard(page);
  url = await drill("Pending follow-up");
  expect(url.searchParams.get("hasPendingFollowUp")).toBe("true");

  await openDashboard(page);
  url = await drill("Resolved pending close");
  expect(url.searchParams.getAll("status")).toEqual(["RESOLVED"]);

  await openDashboard(page);
  url = await drill("New today");
  expect(url.searchParams.getAll("status")).toEqual(["NEW"]);
  expect(url.searchParams.get("createdSince")).toBe(data.body.data.newTodaySince);

  expect(consoleErrors, "normal dashboard navigation must not log console errors").toEqual([]);
});

test("staff dashboard API failure shows a safe panel and Retry recovers", async ({ page }) => {
  await loginWithRotation(page, STAFF, "lab04-staff-dashboard", /Ticket Queue/);

  let failing = true;
  await page.route("**/*", async (route) => {
    if (failing && new URL(route.request().url()).pathname === "/api/dashboard/staff") {
      await route.abort();
      return;
    }
    await route.continue();
  });

  await page.getByRole("navigation").getByRole("button", { name: "Dashboard" }).click();
  await expect(page.getByRole("alert")).toContainText(/Failed to fetch|Unable to load dashboard/);
  failing = false;
  await page.getByRole("alert").getByRole("button", { name: "Retry" }).click();
  await expect(page.locator(".metric-card__value").first()).toBeVisible();
  await expect(page.getByRole("article", { name: "Pending follow-up" })).toBeVisible();
});

test("requester dashboard renders every zero state, then populated data after creating a ticket", async ({
  page,
}) => {
  await loginWithRotation(page, REQUESTER, "lab04-requester-dashboard", /My Tickets/);
  await openDashboard(page);

  const zero = await apiGet<{ data: RequesterDashboardData }>(page, "/api/dashboard/requester");
  expect(zero.status).toBe(200);
  expect(zero.body.data.totalSubmitted).toBe(0);

  const zeroCards: Record<string, string> = {
    "Open tickets": "You have no open tickets.",
    "Awaiting my response": "Nothing is waiting on you.",
    "Recently resolved": "No tickets resolved in the last 30 days.",
    "Total submitted": "You have not submitted any tickets yet.",
  };
  for (const [label, copy] of Object.entries(zeroCards)) {
    const card = page.getByRole("article", { name: label });
    await expect(card.locator(".metric-card__value")).toHaveText("0");
    await expect(card.locator(".metric-card__helper")).toContainText(copy);
  }
  await expect(page.getByText("No recent tickets.")).toBeVisible();
  // totalSubmitted zero offers the Create path (documented exact drill-down).
  await page.getByRole("article", { name: "Total submitted" }).getByRole("button", { name: "Create a ticket" }).click();
  await expect(page.getByRole("heading", { name: "Create Ticket" })).toBeVisible();

  const token = runToken();
  const summary = `E2E Lab 4 requester ticket ${token}`;
  await page.getByLabel("Category").selectOption({ index: 1 });
  await page.getByLabel("Related System").selectOption({ index: 1 });
  await page.getByLabel("Requested Priority").selectOption("MEDIUM");
  await page.getByLabel("Summary").fill(summary);
  await page.getByLabel("Description").fill("Created by the Lab 4 requester dashboard E2E flow.");
  await page.getByRole("main").getByRole("button", { name: "Create Ticket" }).click();
  await expect(page.getByRole("heading", { name: "Ticket Created" })).toBeVisible();
  const ticketNumber = (await page.locator(".success-panel__number").textContent())?.trim() ?? "";
  expect(ticketNumber).toMatch(/TKT-\d{4}-\d{6}/);

  await page.getByRole("navigation").getByRole("button", { name: "Dashboard" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  const populated = await apiGet<{ data: RequesterDashboardData }>(page, "/api/dashboard/requester");
  expect(populated.status).toBe(200);
  expect(populated.body.data.totalSubmitted).toBe(1);
  expect(populated.body.data.openTickets).toBe(1);
  await expect(page.getByRole("article", { name: "Total submitted" }).locator(".metric-card__value")).toHaveText("1");
  await expect(page.getByRole("article", { name: "Open tickets" }).locator(".metric-card__value")).toHaveText("1");
  await expect(page.getByRole("button", { name: ticketNumber })).toBeVisible();
  await expect(page.getByText(summary)).toBeVisible();
  // The recent-ticket link opens the detail; the requester's Actions Taken
  // area is read-only (no Record action / Edit / resolve controls).
  await page.getByRole("button", { name: ticketNumber }).click();
  await expect(page.getByRole("heading", { name: "Ticket Details" })).toBeVisible();
  const actions = page.locator(".detail-section", { has: page.getByRole("heading", { name: "Actions Taken" }) });
  await expect(actions).toBeVisible();
  await expect(actions.getByText(/read-only/)).toBeVisible();
  await expect(actions.getByText("No actions recorded yet.")).toBeVisible();
  await expect(actions.getByRole("button", { name: "Record action" })).toHaveCount(0);
  await expect(actions.getByRole("button", { name: "Edit" })).toHaveCount(0);
  await expect(actions.getByText("Mark follow-up resolved")).toHaveCount(0);
});

test("staff records, edits, and resolves Actions Taken; the resolution gate blocks then releases", async ({
  page,
}) => {
  const token = runToken();
  const description = `E2E Lab 4 action ${token}`;
  const editedDescription = `${description} (edited)`;
  const followUpNote = "Confirm with the requester that the VPN prompts stopped.";
  const duplicateDescription = `E2E Lab 4 duplicate click ${token}`;

  await loginWithRotation(page, STAFF, "lab04-actions", /Ticket Queue/);
  const actionTicketId = await seedTicketId(page, "TKT-2026-000004");
  await openSeedTicket(page, "TKT-2026-000004");

  const form = page.locator(".action-form");
  await expect(page.getByRole("heading", { name: "Actions Taken" })).toBeVisible();

  // A failed create keeps the draft (input is not lost); a retry succeeds.
  let failCreateOnce = true;
  await page.route("**/api/staff/tickets/*/actions-taken", async (route) => {
    if (route.request().method() === "POST" && failCreateOnce) {
      failCreateOnce = false;
      await route.abort();
      return;
    }
    await route.continue();
  });

  await form.getByLabel("Description").fill(description);
  await form.getByLabel("Result").selectOption("ESCALATED");
  await form.getByLabel("Follow-up required").check();
  await form.getByLabel("Follow-up note").fill(followUpNote);
  await form.getByRole("button", { name: "Record action" }).click();
  await expect(form.getByRole("alert")).toContainText(/Failed to fetch|Unable to record the action/);
  await expect(form.getByLabel("Description")).toHaveValue(description);
  await expect(form.getByLabel("Follow-up note")).toHaveValue(followUpNote);

  await form.getByRole("button", { name: "Record action" }).click();
  await expect(page.getByText(description)).toBeVisible();
  await expect(form.getByLabel("Description")).toHaveValue("");

  const actionRows = await apiGet<ActionListResponse>(page, `/api/staff/tickets/${actionTicketId}/actions-taken`);
  expect(actionRows.status).toBe(200);
  expect(actionRows.body.data.filter((row) => row.description === description)).toHaveLength(1);

  // Double-clicking Record action still creates exactly one row.
  await form.getByLabel("Description").fill(duplicateDescription);
  await form.getByLabel("Result").selectOption("RESOLVED_STEP");
  await form.getByRole("button", { name: "Record action" }).dblclick();
  const duplicateRow = page.locator("li.comment-card--action", { hasText: duplicateDescription });
  await expect(duplicateRow).toHaveCount(1);
  const afterDuplicate = await apiGet<ActionListResponse>(
    page,
    `/api/staff/tickets/${actionTicketId}/actions-taken`,
  );
  expect(afterDuplicate.body.data.filter((row) => row.description === duplicateDescription)).toHaveLength(1);

  // The pending follow-up blocks the matrix-legal -> Resolved edge.
  await expect(page.getByText("Resolution is blocked")).toBeVisible();
  const detail = await apiGet<TicketDetailResponse>(page, `/api/staff/tickets/${actionTicketId}`);
  const blocked = await apiPatch<
    { status: string; expectedUpdatedAt: string },
    { error: { code: string } }
  >(page, `/api/staff/tickets/${actionTicketId}/status`, {
    status: "RESOLVED",
    expectedUpdatedAt: detail.body.data.updatedAt,
  });
  expect(blocked.status).toBe(409);
  expect(blocked.body.error.code).toBe("RESOLUTION_BLOCKED");

  // Edit is available for the author and updates the row in place.
  const createdRow = page.locator("li.comment-card--action", { hasText: description });
  await createdRow.getByRole("button", { name: "Edit" }).click();
  await createdRow.getByLabel("Description").fill(editedDescription);
  await createdRow.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText(editedDescription)).toBeVisible();
  await expect(page.getByText(description, { exact: true })).toHaveCount(0);

  // Any staff member may resolve a pending follow-up; once resolved the gate
  // releases and the status transition succeeds.
  const editedRow = page.locator("li.comment-card--action", { hasText: editedDescription });
  await editedRow.getByRole("button", { name: "Mark follow-up resolved" }).click();
  await expect(editedRow.getByText("Follow-up resolved")).toBeVisible();
  await expect(page.getByText("Resolution is blocked")).toHaveCount(0);
  await page.getByLabel("Change status").selectOption("RESOLVED");
  await expect(page.getByText("Status updated.")).toBeVisible();
  await expect(page.getByLabel("Change status")).toHaveValue("RESOLVED");
});

test("a stale ticket write shows the conflict panel and recovers without replaying silently", async ({ page }) => {
  await loginWithRotation(page, STAFF, "lab04-actions", /Ticket Queue/);
  const staleTicketId = await seedTicketId(page, "TKT-2026-000007");
  await openSeedTicket(page, "TKT-2026-000007");

  const detail = await apiGet<TicketDetailResponse>(page, `/api/staff/tickets/${staleTicketId}`);
  expect(detail.status).toBe(200);

  // Another writer changes the ticket after this page loaded.
  const external = await apiPatch<
    { itPriority: string; expectedUpdatedAt: string },
    { data: { itPriority: string; updatedAt: string } }
  >(page, `/api/staff/tickets/${staleTicketId}/priority`, {
    itPriority: "LOW",
    expectedUpdatedAt: detail.body.data.updatedAt,
  });
  expect(external.status).toBe(200);

  // The page still holds the old version, so its next write is rejected.
  await page.getByLabel("IT Priority", { exact: true }).selectOption("MEDIUM");
  await expect(page.getByRole("alert").filter({ hasText: "Someone else changed this ticket." })).toBeVisible();

  await page.getByRole("button", { name: "Reload ticket" }).click();
  await expect(page.getByText(/Ticket reloaded\. Your change .* was not applied/)).toBeVisible();
  await expect(page.getByLabel("IT Priority", { exact: true })).toHaveValue("LOW");

  await page.getByRole("button", { name: /Retry my change/ }).click();
  await expect(page.getByText("Your change was applied to the current version.")).toBeVisible();
  await expect(page.getByLabel("IT Priority", { exact: true })).toHaveValue("MEDIUM");
});

test("Lab 4 screens are responsive and keyboard reachable without console errors", async ({ page }) => {
  await loginWithRotation(page, STAFF, "lab04-actions", /Ticket Queue/);

  for (const viewport of [
    { name: "mobile", width: 375, height: 812 },
    { name: "tablet", width: 834, height: 1112 },
    { name: "desktop", width: 1280, height: 900 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await openDashboard(page);
    await expect(page.getByRole("article", { name: "New today" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("navigation").getByRole("button", { name: "Ticket Queue" }).click();
  await openSeedTicket(page, "TKT-2026-000004");
  await expect(page.getByRole("heading", { name: "Actions Taken" })).toBeVisible();

  const description = page.locator(".action-form").getByLabel("Description");
  await description.focus();
  await expect(description).toBeFocused();
  const focusVisible = await page.evaluate(() => {
    const active = document.activeElement;
    if (!active) return false;
    const style = getComputedStyle(active);
    return (
      (style.outlineStyle !== "none" && style.outlineWidth !== "0px") ||
      style.boxShadow !== "none"
    );
  });
  expect(focusVisible).toBe(true);
  await expect(page.locator(".action-form").getByLabel("Result")).toBeVisible();
  await expect(page.locator(".action-form").getByLabel("Follow-up required")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
