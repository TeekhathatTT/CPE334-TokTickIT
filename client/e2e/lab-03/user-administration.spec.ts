import { expect, test, type Page } from "@playwright/test";
import {
  apiGet,
  apiPatch,
  apiStatus,
  expectNoHorizontalOverflow,
  login,
  loginKnown,
  rotatePassword,
  rotationPassword,
  runToken,
} from "./helpers";

/**
 * Lab 3 user-administration E2E (AC-10–AC-14; FR-11/FR-12 safeguards).
 * Owns seed account alice.admin plus freshly created `e2e.*` users with
 * run-unique emails. Requires a freshly seeded database (see helpers.ts).
 */

const ADMIN = "alice.admin@example.com";
const ADMIN_NAME = "Alice Admin";

interface AdminRow {
  id: number;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
}

interface AdminListEnvelope {
  data: AdminRow[];
}

// Credentials of the user created mid-file; shared by later tests in order.
let createdEmail = "";
let createdPassword = "";
let createdName = "";

function dialog(page: Page) {
  return page.getByRole("dialog");
}

test("administrator logs in and lands on user management", async ({ page }) => {
  await loginKnown(page, ADMIN);
  await rotatePassword(page, ADMIN, "admin");
  await expect(page.getByRole("heading", { name: "User Management" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create User" }).first()).toBeVisible();
  await expect(page.getByText(ADMIN_NAME).first()).toBeVisible();
  await expect(page.getByText("Administrator").first()).toBeVisible();
});

test("administrator searches and filters the user list", async ({ page }) => {
  await loginKnown(page, ADMIN);
  await expect(page.getByRole("heading", { name: "User Management" })).toBeVisible();

  await page.getByLabel("Search users").fill("priya.patel@example.com");
  await expect(page.getByText("Priya Patel").first()).toBeVisible();
  await expect(page.getByText(`${ADMIN_NAME} (you)`)).toHaveCount(0);

  await page.getByLabel("Search users").fill("");
  await page.getByLabel("Role filter").selectOption("IT_STAFF");
  await expect(page.getByText("Priya Patel").first()).toBeVisible();
  await expect(page.getByText(`${ADMIN_NAME} (you)`)).toHaveCount(0);

  await page.getByLabel("Role filter").selectOption("");
  await expect(page.getByText(`${ADMIN_NAME} (you)`).first()).toBeVisible();
});

test("administrator creates a user with one role and an initial password", async ({ page }) => {
  const token = runToken();
  createdName = `E2E User ${token}`;
  createdEmail = `e2e.user.${token}@example.com`;
  createdPassword = rotationPassword("initial");

  await loginKnown(page, ADMIN);
  await expect(page.getByRole("heading", { name: "User Management" })).toBeVisible();

  await page.getByRole("button", { name: "Create User" }).first().click();
  await expect(dialog(page).getByRole("heading", { name: "Create User" })).toBeVisible();
  await dialog(page).getByLabel("Name", { exact: true }).fill(createdName);
  await dialog(page).getByLabel("Email", { exact: true }).fill(createdEmail);
  await dialog(page).getByLabel("Role", { exact: true }).selectOption("REQUESTER");
  await dialog(page).getByLabel("Initial password", { exact: true }).fill(createdPassword);
  await dialog(page).getByRole("button", { name: "Create User" }).click();

  await expect(page.getByText(/must change their password at next login/)).toBeVisible();
  await page.getByLabel("Search users").fill(createdEmail);
  await expect(page.getByText(createdName).first()).toBeVisible();
  await expect(page.getByText("Requester").first()).toBeVisible();
});

test("the new user is forced through change password and lands by role", async ({ page }) => {
  const nextPassword = rotationPassword("created");
  await login(page, createdEmail, createdPassword);

  await expect(page.getByRole("heading", { name: "Change your password" })).toBeVisible();
  await page.getByLabel("Current password", { exact: true }).fill(createdPassword);
  await page.getByLabel("New password", { exact: true }).fill(nextPassword);
  await page.getByLabel("Confirm new password", { exact: true }).fill(nextPassword);
  await page.getByRole("button", { name: "Save new password" }).click();

  // A Requester lands on My Tickets …
  await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();

  // … with no admin route in the UI, and the admin API forbids them (the app
  // has no URL router, so "hitting /admin directly" maps to the API plus the
  // absence of any admin surface — backend enforcement, not hidden buttons).
  await expect(page.getByRole("navigation").getByText("User Management")).toHaveCount(0);
  expect(await apiStatus(page, "/api/admin/users")).toBe(403);
});

test("administrator edits role and activation state", async ({ page }) => {
  const renamed = `${createdName} Renamed`;
  await loginKnown(page, ADMIN);
  await expect(page.getByRole("heading", { name: "User Management" })).toBeVisible();
  await page.getByLabel("Search users").fill(createdEmail);

  await page.getByRole("button", { name: `Edit ${createdName}`, exact: true }).click();
  await dialog(page).getByLabel("Name", { exact: true }).fill(renamed);
  await dialog(page).getByLabel("Role", { exact: true }).selectOption("IT_STAFF");
  await dialog(page).getByRole("button", { name: "Save Changes" }).click();
  await expect(page.getByText(/updated\./)).toBeVisible();
  await expect(page.getByText(renamed).first()).toBeVisible();
  createdName = renamed;

  // Deactivation persists …
  await page.getByRole("button", { name: `Edit ${createdName}`, exact: true }).click();
  await dialog(page).getByLabel("Active").uncheck();
  await dialog(page).getByRole("button", { name: "Save Changes" }).click();
  await expect(page.getByText(/updated\./)).toBeVisible();
  await expect(page.getByText("Inactive").first()).toBeVisible();

  // … and reactivation restores access.
  await page.getByRole("button", { name: `Edit ${createdName}`, exact: true }).click();
  await dialog(page).getByLabel("Active").check();
  await dialog(page).getByRole("button", { name: "Save Changes" }).click();
  await expect(page.getByText(/updated\./)).toBeVisible();
  await page.getByLabel("Search users").fill(createdEmail);
  await expect(page.getByText(createdName).first()).toBeVisible();
});

test("administrator cannot deactivate their own account", async ({ page }) => {
  await loginKnown(page, ADMIN);
  await expect(page.getByRole("heading", { name: "User Management" })).toBeVisible();
  await page.getByLabel("Search users").fill(ADMIN);

  // The UI blocks it up front: the Active box is disabled with an explanation.
  await page.getByRole("button", { name: `Edit ${ADMIN_NAME}`, exact: true }).click();
  await expect(dialog(page).getByLabel("Active")).toBeDisabled();
  await expect(dialog(page).getByText("You cannot deactivate your own account.")).toBeVisible();
  await dialog(page).getByRole("button", { name: "Cancel" }).click();

  // And the server rejects a forged request anyway (BR-20, AC-12).
  const found = await apiGet<AdminListEnvelope>(page, `/api/admin/users?search=${encodeURIComponent(ADMIN)}`);
  expect(found.status).toBe(200);
  const selfId = found.body.data[0].id;
  const rejected = await apiPatch(page, `/api/admin/users/${selfId}`, { isActive: false });
  expect(rejected.status).toBe(409);
});

test("the last active administrator cannot be demoted away", async ({ page }) => {
  // With the fresh seed Alice is the only active Administrator, so removing
  // her standing trips the BR-21 guard. (Deactivating a *different* last
  // admin is unreachable by construction: any logged-in admin actor staying
  // active means the target is never last — the guard is defense-in-depth
  // for races, covered at API level by users-admin.api.test.ts.)
  await loginKnown(page, ADMIN);
  await expect(page.getByRole("heading", { name: "User Management" })).toBeVisible();
  await page.getByLabel("Search users").fill(ADMIN);

  await page.getByRole("button", { name: `Edit ${ADMIN_NAME}`, exact: true }).click();
  await dialog(page).getByLabel("Role", { exact: true }).selectOption("REQUESTER");
  await dialog(page).getByRole("button", { name: "Save Changes" }).click();

  await expect(dialog(page).getByText("Unable to save.")).toBeVisible();
  await expect(dialog(page).getByText("At least one active Administrator must remain.")).toBeVisible();
  await dialog(page).getByRole("button", { name: "Cancel" }).click();

  // Nothing was mutated: Alice is still an Administrator.
  await expect(page.getByText(`${ADMIN_NAME} (you)`).first()).toBeVisible();
});

for (const viewport of [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 834, height: 1112 },
  { name: "desktop", width: 1280, height: 900 },
]) {
  test(`user management has no horizontal overflow at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await loginKnown(page, ADMIN);
    await expect(page.getByRole("heading", { name: "User Management" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
}
