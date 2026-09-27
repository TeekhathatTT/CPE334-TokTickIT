import { expect, test, type Page } from "@playwright/test";
import {
  apiGet,
  apiPatch,
  expectNoHorizontalOverflow,
  loginKnown,
  rotatePassword,
  runToken,
} from "./helpers";

/**
 * Lab 3 staff ticket-flow E2E (AC-06, AC-07, AC-08, AC-09, AC-18, AC-19;
 * RESP-01). Owns seed accounts: priya.patel (IT Staff), jennifer.anderson.
 * Requires a freshly seeded database (see helpers.ts).
 *
 * Seed tickets used:
 * - TKT-2026-000001: NEW, unassigned, no IT priority — the worked ticket.
 * - TKT-2026-000002: OPEN, owned by Priya — the disallowed-transition ticket.
 * - TKT-2026-000005: RESOLVED with a Requester resolved-signal — indicator.
 */

const STAFF = "priya.patel@example.com";
const REQUESTER = "jennifer.anderson@example.com";

interface QueueResponse {
  data: Array<{ id: number; ticketNumber: string }>;
}

async function openSeedTicket(page: Page, ticketNumber: string): Promise<void> {
  await expect(page.getByRole("heading", { name: "Ticket Queue" })).toBeVisible();
  await page.getByLabel("Search queue").fill(ticketNumber);
  await page.getByRole("button", { name: ticketNumber }).first().click();
  await expect(page.getByText("Ticket Details")).toBeVisible();
}

test("staff works a ticket end to end: queue, claim, priority, comments, notes, status", async ({
  page,
}) => {
  const token = runToken();
  await loginKnown(page, STAFF);
  await rotatePassword(page, STAFF, "staff-flow");
  await expect(page.getByRole("heading", { name: "Ticket Queue" })).toBeVisible();

  // Queue search narrows to the seeded NEW ticket …
  await page.getByLabel("Search queue").fill("TKT-2026-000001");
  await expect(page.getByRole("button", { name: "TKT-2026-000001" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "TKT-2026-000002" })).toHaveCount(0);

  // … status filter applies, and Clear Filters restores the full queue.
  await page.getByLabel("Search queue").fill("");
  await page.getByLabel("Queue status").selectOption("NEW");
  await expect(page.getByRole("button", { name: "TKT-2026-000001" }).first()).toBeVisible();
  await page.getByRole("button", { name: "Clear Filters" }).first().click();
  await expect(page.getByRole("button", { name: "TKT-2026-000002" }).first()).toBeVisible();

  // Open the ticket and claim ownership.
  await page.getByLabel("Search queue").fill("TKT-2026-000001");
  await page.getByRole("button", { name: "TKT-2026-000001" }).first().click();
  await expect(page.getByText("Ticket Details")).toBeVisible();
  await page.getByRole("button", { name: "Claim (assign to me)" }).click();
  await expect(page.getByText("Ticket claimed.")).toBeVisible();
  await expect(page.getByText(/Current owner: Priya Patel/)).toBeVisible();

  // Set the IT Priority (Requested Priority stays read-only).
  await page.getByLabel("IT Priority", { exact: true }).selectOption("HIGH");
  await expect(page.getByText("IT Priority updated.")).toBeVisible();

  // Post a public comment and an internal note with run-unique content.
  const comment = `E2E public comment ${token}`;
  await page.getByLabel("Add a public comment").fill(comment);
  await page.getByRole("button", { name: "Post comment" }).click();
  await expect(page.getByText(comment)).toBeVisible();

  const note = `E2E internal note ${token}`;
  await page.getByLabel("Add an internal note (staff only)").fill(note);
  await page.getByRole("button", { name: "Post internal note" }).click();
  await expect(page.getByText(note)).toBeVisible();

  // Move through a valid transition (NEW → OPEN per the api-spec matrix).
  const statusSelect = page.getByLabel("Change status");
  await statusSelect.selectOption("OPEN");
  await expect(page.getByText("Status updated.")).toBeVisible();
  await expect(statusSelect).toHaveValue("OPEN");

  // The seeded RESOLVED ticket surfaces the Requester resolved-signal.
  await page.getByRole("button", { name: "Back to Ticket Queue" }).click();
  await openSeedTicket(page, "TKT-2026-000005");
  await expect(page.getByText("Requester flagged this problem as appearing resolved")).toBeVisible();
});

test("a disallowed status transition is rejected and never offered", async ({ page }) => {
  await loginKnown(page, STAFF);
  await expect(page.getByRole("heading", { name: "Ticket Queue" })).toBeVisible();

  // Resolve the numeric id through the staff queue API (same session).
  const found = await apiGet<QueueResponse>(page, "/api/staff/tickets?search=TKT-2026-000002");
  expect(found.status).toBe(200);
  const ticketId = found.body.data[0].id;

  // OPEN → CLOSED skips the matrix (OPEN allows In Progress / Waiting for
  // Requester / Resolved / Cancelled): the server answers 409 (AC-08/AC-19).
  const rejected = await apiPatch(page, `/api/staff/tickets/${ticketId}/status`, {
    status: "CLOSED",
  });
  expect(rejected.status).toBe(409);

  // The UI reflects the rejection surface honestly: CLOSED is not offered,
  // the helper names the constraint, and the status is unchanged on reload.
  await openSeedTicket(page, "TKT-2026-000002");
  const statusSelect = page.getByLabel("Change status");
  await expect(statusSelect.getByRole("option", { name: "Closed" })).toHaveCount(0);
  await expect(page.getByText("Only the transitions permitted from Open are offered.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Change status")).toHaveValue("OPEN");
});

test("a requester never sees internal-note content or staff routes", async ({ page }) => {
  await loginKnown(page, REQUESTER);
  await rotatePassword(page, REQUESTER, "staff-flow-requester");
  await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();

  // Open the requester's own first ticket.
  const mine = await apiGet<QueueResponse>(page, "/api/tickets");
  expect(mine.status).toBe(200);
  const ticketNumber = mine.body.data[0].ticketNumber;
  await page.getByRole("button", { name: ticketNumber }).first().click();
  await expect(page.getByText("Ticket Details")).toBeVisible();

  // Public collaboration is visible …
  await expect(page.getByRole("heading", { name: "Public Comments" })).toBeVisible();
  // … but no internal-note surface exists anywhere (API-level leak coverage
  // already lives in comments-notes.api.test.ts; this is the UI guarantee).
  await expect(page.getByText("Internal Notes")).toHaveCount(0);
  await expect(page.getByText("staff only")).toHaveCount(0);
  await expect(page.getByRole("navigation").getByText("Ticket Queue")).toHaveCount(0);
  await expect(page.getByRole("navigation").getByText("User Management")).toHaveCount(0);
});

for (const viewport of [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 834, height: 1112 },
  { name: "desktop", width: 1280, height: 900 },
]) {
  test(`staff queue has no horizontal overflow at ${viewport.name} (RESP-01)`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await loginKnown(page, STAFF);
    await expect(page.getByRole("heading", { name: "Ticket Queue" })).toBeVisible();
    // Tablet/mobile render stacked cards while the table is hidden (and vice
    // versa on desktop), so only match the visible representation.
    const ticketLink = page.locator("button:visible", { hasText: /TKT-2026-/ }).first();
    await expect(ticketLink).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
}
