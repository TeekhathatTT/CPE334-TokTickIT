import { expect, test } from "@playwright/test";

async function loginAsAdmin(page: import("@playwright/test").Page) {
  const userManagementHeading = page.getByRole("heading", { name: "User Management" });
  const changePasswordHeading = page.getByRole("heading", { name: /change your password/i });
  // Try the seed password first, then the password set by an earlier test run.
  // A prior spec can change the admin password to AdminPass1!, so blindly using
  // the seed password makes every test after the first fail at the login form.
  for (const password of ["TokTickit1!", "AdminPass1!"]) {
    await page.goto("/");
    await page.getByLabel("Email").fill("morgan.davis@example.com");
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: /sign in/i }).click();
    try {
      await expect(changePasswordHeading.or(userManagementHeading)).toBeVisible({ timeout: 5000 });
    } catch {
      continue;
    }
    if (await changePasswordHeading.isVisible()) {
      await page.getByLabel(/current or temporary password/i).fill(password);
      await page.getByLabel(/^new password$/i).fill("AdminPass1!");
      await page.getByLabel(/^confirm new password$/i).fill("AdminPass1!");
      await page.getByRole("button", { name: /save password/i }).click();
      await expect(userManagementHeading).toBeVisible();
    }
    return;
  }
  throw new Error("Unable to sign in as administrator.");
}

test("administrator can manage users and responsive layout does not overflow", async ({ page }) => {
  await loginAsAdmin(page);
  // Unique email so re-running the spec against a non-reset DB does not hit a duplicate-email conflict.
  const managedEmail = `e2e-managed-${Date.now()}@example.com`;
  await page.getByLabel("Search users").fill("Morgan");
  await expect(page.getByText("Morgan Davis")).toBeVisible();
  await page.getByLabel("Role", { exact: true }).selectOption("ADMINISTRATOR");
  await page.getByRole("button", { name: "New user form" }).click();
  await page.getByLabel("Name").fill("E2E Managed User");
  await page.getByLabel("Email").fill(managedEmail);
  await page.getByLabel("Initial password").fill("E2ePass1!");
  await page.getByRole("button", { name: "Save user" }).click();
  await expect(page.getByText(/User created/i)).toBeVisible();
  // Reset the Role filter so the newly-created REQUESTER user is visible in the table.
  // Without this the filter still shows ADMINISTRATOR (set earlier) and the row is hidden.
  await page.getByLabel("Role", { exact: true }).selectOption("");
  await page.getByLabel("Search users").fill("E2E Managed");

  // The user table re-fetches after a 250 ms debounce, so Playwright can outrun
  // the re-render and act on a STALE table (e.g. still showing the Morgan Davis
  // row from the earlier "Morgan" search). This previously sent Edit / Set
  // initial password to the wrong row. Anchor every action to the row that
  // contains the managed user's email and wait for it to render first.
  const userTable = page.getByTestId("user-table");
  const managedRow = userTable.locator("tr").filter({ hasText: managedEmail });
  await expect(managedRow).toBeVisible({ timeout: 10_000 });
  await managedRow.getByRole("button", { name: "Edit" }).click();

  await page.getByRole("button", { name: "Save user" }).click();

  // The table reloads after saving — wait for the managed user's row again.
  await expect(managedRow).toBeVisible({ timeout: 10_000 });
  await managedRow.getByRole("button", { name: "Set initial password" }).click();
  await page.getByLabel("New initial password", { exact: true }).fill("AnotherPass1!");
  await page.getByRole("button", { name: "Set password" }).click();
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "../artifacts/lab-03/screenshots/user-management/mobile.png", fullPage: true });
});

for (const viewport of [{ name: "desktop", width: 1280, height: 900 }, { name: "tablet", width: 834, height: 1112 }]) {
  test(`user management has no horizontal overflow at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport); await loginAsAdmin(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `../artifacts/lab-03/screenshots/user-management/${viewport.name}.png`, fullPage: true });
  });
}

test("creating a user with a duplicate email shows a conflict error", async ({ page }) => {
  await loginAsAdmin(page);
  // Open create form and submit with an email that already exists in the seed data
  await page.getByRole("button", { name: "New user form" }).click();
  await page.getByLabel("Name").fill("Duplicate Test");
  await page.getByLabel("Email").fill("morgan.davis@example.com"); // already seeded
  await page.getByLabel("Initial password").fill("DupPass1!");
  await page.getByRole("button", { name: "Save user" }).click();
  // Expect an error message indicating the conflict
  await expect(page.getByRole("alert")).toContainText(/already exists|conflict/i);
});

test("self-deactivation button is disabled for the currently logged-in admin", async ({ page }) => {
  await loginAsAdmin(page);
  await page.getByLabel("Search users").fill("Morgan Davis");
  // The Deactivate button for the logged-in user should be disabled
  const userTable = page.getByTestId("user-table");
  const deactivateBtn = userTable.getByRole("button", { name: "Deactivate" });
  await expect(deactivateBtn).toBeDisabled();
});
