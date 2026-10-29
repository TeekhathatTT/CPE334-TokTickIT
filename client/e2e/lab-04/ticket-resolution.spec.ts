import { expect, type Browser, type Page } from "@playwright/test";
import { apiGet, apiPatch, loginWithRotation, test, watchConsoleErrors } from "../lab-03/helpers";

const STAFF = "lisa.garcia@example.com";
const REQUESTER = "michael.chen@example.com";

interface TicketResponse {
  data: { id: number; ticketNumber: string; status: string; updatedAt: string };
}

async function loginAs(page: Page, email: string, tag: string, role: RegExp) {
  await loginWithRotation(page, email, tag, role);
}

async function openStaffTicket(page: Page, ticketNumber: string) {
  await page.getByLabel("Search queue").fill(ticketNumber);
  await page.getByRole("button", { name: ticketNumber }).first().click();
  await expect(page.getByLabel("Change status")).toBeVisible();
}

test("resolution is rejected by direct API while follow-up is pending and allowed after completion", async ({
  page,
}) => {
  await loginAs(page, STAFF, "lab04-resolution-gate", /Ticket Queue/);
  await openStaffTicket(page, "TKT-2026-000002");

  const ticket = await apiGet<TicketResponse>(page, "/api/staff/tickets/2");
  expect(ticket.status).toBe(200);
  const rejected = await apiPatch<
    { status: string; expectedUpdatedAt: string },
    { error: { code: string } }
  >(page, "/api/staff/tickets/2/status", {
    status: "RESOLVED",
    expectedUpdatedAt: ticket.body.data.updatedAt,
  });
  expect(rejected.status).toBe(409);
  expect(rejected.body.error.code).toBe("RESOLUTION_BLOCKED");
  await expect(page.getByLabel("Change status")).not.toHaveValue("RESOLVED");

  const actions = await apiGet<{
    data: Array<{ id: number; followUpRequired: boolean; followUpResolvedAt: string | null; updatedAt: string }>;
  }>(page, "/api/staff/tickets/2/actions-taken");
  const pending = actions.body.data.filter((action) => action.followUpRequired && !action.followUpResolvedAt);
  expect(pending.length).toBeGreaterThan(0);
  for (const action of pending) {
    const resolvedAction = await apiPatch<
      { markFollowUpResolved: boolean; expectedUpdatedAt: string },
      { data: { id: number } }
    >(page, `/api/staff/tickets/2/actions-taken/${action.id}`, {
      markFollowUpResolved: true,
      expectedUpdatedAt: action.updatedAt,
    });
    expect(resolvedAction.status).toBe(200);
  }

  const current = await apiGet<TicketResponse>(page, "/api/staff/tickets/2");
  const resolved = await apiPatch<
    { status: string; expectedUpdatedAt: string },
    { data: { status: string } }
  >(page, "/api/staff/tickets/2/status", {
    status: "RESOLVED",
    expectedUpdatedAt: current.body.data.updatedAt,
  });
  expect(resolved.status).toBe(200);
  expect(resolved.body.data.status).toBe("RESOLVED");
});

test("requester resolved signal leaves ticket status unchanged", async ({ page }) => {
  await loginAs(page, REQUESTER, "lab04-resolution-requester", /My Tickets/);
  await page.getByRole("navigation").getByRole("button", { name: "Dashboard" }).click();
  await page.getByRole("button", { name: "TKT-2026-000002" }).click();

  const before = await apiGet<{ data: Array<{ ticketNumber: string; status: string }> }>(
    page,
    "/api/tickets?search=TKT-2026-000002",
  );
  const statusBefore = before.body.data.find((ticket) => ticket.ticketNumber === "TKT-2026-000002")?.status;
  expect(statusBefore).toBeTruthy();

  await page.getByRole("button", { name: "Problem appears resolved" }).click();
  await expect(page.getByText("You marked this problem as appearing resolved")).toBeVisible();

  const after = await apiGet<{ data: Array<{ ticketNumber: string; status: string }> }>(
    page,
    "/api/tickets?search=TKT-2026-000002",
  );
  expect(after.body.data.find((ticket) => ticket.ticketNumber === "TKT-2026-000002")?.status).toBe(statusBefore);
});

test("second browser context receives a stale-write conflict and only legal statuses are offered", async ({
  browser,
  page,
}: {
  browser: Browser;
  page: Page;
}) => {
  await loginAs(page, STAFF, "lab04-conflict-first", /Ticket Queue/);
  await openStaffTicket(page, "TKT-2026-000007");
  const original = await apiGet<TicketResponse>(page, "/api/staff/tickets/7");

  const otherContext = await browser.newContext();
  const otherPage = await otherContext.newPage();
  const errors = watchConsoleErrors(otherPage);
  try {
    await loginAs(otherPage, STAFF, "lab04-conflict-second", /Ticket Queue/);
    const external = await apiPatch<
      { itPriority: string; expectedUpdatedAt: string },
      { data: { updatedAt: string } }
    >(otherPage, "/api/staff/tickets/7/priority", {
      itPriority: "LOW",
      expectedUpdatedAt: original.body.data.updatedAt,
    });
    expect(external.status).toBe(200);

    await page.getByLabel("IT Priority").selectOption("MEDIUM");
    await expect(page.getByRole("alert")).toContainText("Someone else changed this ticket.");
    const offered = await page.getByLabel("Change status").locator("option").evaluateAll((options) =>
      options.map((option) => (option as HTMLOptionElement).value),
    );
    const transitions = offered.filter((status) => status !== "REOPENED");
    expect(transitions).toEqual(["OPEN", "IN_PROGRESS", "CANCELLED"]);
    expect(transitions).not.toContain("CLOSED");
  } finally {
    expect(errors(), "secondary browser context page errors and console.error calls").toEqual([]);
    await otherContext.close();
  }
});
