import { expect, test } from "@playwright/test";
import {
  apiStatus,
  login,
  loginKnown,
  passwordFor,
  rememberPassword,
  rotatePassword,
  rotationPassword,
  runToken,
} from "./helpers";

/**
 * Lab 3 authentication E2E (AC-01, AC-02, AC-05, AC-14, AC-16, AC-17; A11Y-01).
 * Owns seed accounts: michael.chen, tom.nguyen, sarah.williams, david.brown.
 * Requires a freshly seeded database (see helpers.ts).
 */

const REQUESTER = "michael.chen@example.com";
const STAFF = "tom.nguyen@example.com";
const LOGOUT_USER = "sarah.williams@example.com";
const INACTIVE = "david.brown@example.com";
const UNKNOWN = "nobody-here@example.com";

test("valid login rotates the initial password and lands on the requester home", async ({ page }) => {
  await loginKnown(page, REQUESTER);

  // Freshly seeded accounts are gated behind the mandatory change (AC-02/AC-14).
  const nextPassword = rotationPassword("requester");
  await expect(page.getByRole("heading", { name: "Change your password" })).toBeVisible();

  // The rule checklist is text plus state, never color alone (AC-22).
  const checklist = page.getByRole("list", { name: "Password rules" });
  await expect(checklist).toBeVisible();
  await expect(checklist.getByText("(not met)").first()).toBeVisible();
  await page.getByLabel("New password *", { exact: true }).fill(nextPassword);
  await expect(checklist.getByText("(met)").first()).toBeVisible();

  await page.getByLabel("Current password *", { exact: true }).fill(passwordFor(REQUESTER));
  await page.getByLabel("Confirm new password *", { exact: true }).fill(nextPassword);
  await page.getByRole("button", { name: "Save new password" }).click();
  rememberPassword(REQUESTER, nextPassword);

  // Role-based home for a Requester: My Tickets shell, no staff/admin routes.
  await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
  await expect(page.getByText("Michael Chen")).toBeVisible();
  await expect(page.getByRole("navigation").getByText("Ticket Queue")).toHaveCount(0);
  await expect(page.getByRole("navigation").getByText("User Management")).toHaveCount(0);
});

test("invalid credentials show a safe generic error", async ({ page }) => {
  await login(page, UNKNOWN, "WrongPass1!");
  await expect(page.getByText("Unable to log in.")).toBeVisible();
  await expect(page.getByText("Invalid email or password.")).toBeVisible();
  // Still on the login screen — no navigation happened.
  await expect(page.getByRole("heading", { name: "Log in to TokTickIT" })).toBeVisible();
});

test("inactive account gets the same generic error (no account enumeration)", async ({ page }) => {
  await loginKnown(page, INACTIVE);
  // Byte-identical to the invalid-credentials failure above: the UI must not
  // reveal whether the address exists or is deactivated (AC-16/BR-06).
  await expect(page.getByText("Unable to log in.")).toBeVisible();
  await expect(page.getByText("Invalid email or password.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Log in to TokTickIT" })).toBeVisible();
});

test("initial-password login is gated until the password is changed", async ({ page }) => {
  await loginKnown(page, STAFF);

  // Only the change-password screen is reachable: no role shell, no logout,
  // no queue/detail/admin content of any kind.
  await expect(page.getByRole("heading", { name: "Change your password" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ticket Queue" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "My Tickets" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "User Management" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Logout" })).toHaveCount(0);

  // The gate is server-enforced, not just hidden UI: any other API route
  // answers 403 PASSWORD_CHANGE_REQUIRED while the flag is set (BR-02).
  const gated = await apiStatus(page, "/api/tickets");
  expect(gated).toBe(403);

  await rotatePassword(page, STAFF, "staff");

  // After a valid change the staff member lands in the app normally.
  await expect(page.getByRole("heading", { name: "Ticket Queue" })).toBeVisible();
  await expect(page.getByLabel("Signed-in user")).toContainText("Tom Nguyen");
});

test("logout clears the session and the stale session is rejected", async ({ page }) => {
  await loginKnown(page, LOGOUT_USER);
  await rotatePassword(page, LOGOUT_USER, "logout");
  await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();

  await page.getByRole("button", { name: "Logout" }).click();
  await expect(page.getByRole("heading", { name: "Log in to TokTickIT" })).toBeVisible();

  // Direct navigation to a protected view stays on login (client guard) …
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Log in to TokTickIT" })).toBeVisible();

  // … and the API independently rejects the stale session (BR-07, AC-05).
  expect(await apiStatus(page, "/api/auth/me")).toBe(401);
  expect(await apiStatus(page, "/api/tickets")).toBe(401);
});

test("authenticated requester keeps Lab 2 abilities: create, comment, signal resolved (E2E-01)", async ({
  page,
}) => {
  const token = runToken();
  await loginKnown(page, LOGOUT_USER);

  // Order-independent: earlier tests may already have rotated this account.
  await expect(page.getByRole("heading", { name: /My Tickets|Change your password/ })).toBeVisible();
  if ((await page.getByRole("heading", { name: "Change your password" }).count()) > 0) {
    await rotatePassword(page, LOGOUT_USER, "regression");
  }
  await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();

  // Create a ticket; ownership comes from the session (BR-03, AC-15).
  // Two "Create Ticket" buttons exist (nav tab + page header): navigate via
  // the nav tab, submit via the page header button.
  await page.getByRole("navigation").getByRole("button", { name: "Create Ticket" }).click();
  await page.getByLabel("Category").selectOption({ index: 1 });
  await page.getByLabel("Related System").selectOption({ index: 1 });
  await page.getByLabel("Requested Priority").selectOption("MEDIUM");
  await page.getByLabel("Summary").fill(`E2E regression ticket ${token}`);
  await page.getByLabel("Description").fill("Created by the Lab 3 requester-regression flow.");
  await page.getByRole("main").getByRole("button", { name: "Create Ticket" }).click();
  await expect(page.getByRole("heading", { name: "Ticket Created" })).toBeVisible();
  await expect(page.locator(".success-panel__number")).toHaveText(/TKT-\d{4}-\d{6}/);

  // Open it, post a public comment, and record the resolved-signal — the
  // status itself never changes to Resolved/Closed (BR-05, AC-18).
  await page.getByRole("button", { name: "View Ticket" }).click();
  await expect(page.getByText("Ticket Details")).toBeVisible();
  const comment = `E2E regression comment ${token}`;
  await page.getByLabel("Add a public comment").fill(comment);
  await page.getByRole("button", { name: "Post comment" }).click();
  await expect(page.getByText(comment)).toBeVisible();
  await page.getByRole("button", { name: "Problem appears resolved" }).click();
  await expect(page.getByText("You marked this problem as appearing resolved")).toBeVisible();
});

test("login and password screens are keyboard accessible with visible labels", async ({ page }) => {
  await page.goto("/");

  // Every control is reachable by keyboard in reading order (A11Y-01). The
  // first Tab press moves focus out of the document body (standard Chromium
  // behavior on a freshly loaded page) and can land before the form is
  // interactive, so Tab until Email receives focus (bounded), then assert
  // the strict order Email → Password → Log in.
  const email = page.getByLabel("Email *", { exact: true });
  await expect(email).toBeVisible();
  for (let i = 0; i < 8; i++) {
    if (await email.evaluate((el) => el === document.activeElement)) break;
    await page.keyboard.press("Tab");
  }
  await expect(email).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Password *", { exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Log in", exact: true })).toBeFocused();

  // Focus indication must be visible, not just programmatic.
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
});
