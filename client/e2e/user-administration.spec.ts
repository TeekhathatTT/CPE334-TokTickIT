import { expect, test } from "@playwright/test";

async function loginAsAdmin(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByLabel("Email").fill("morgan.davis@example.com");
  await page.getByLabel("Password").fill("TokTickit1!");
  await page.getByRole("button", { name: /sign in/i }).click();
  if (await page.getByRole("heading", { name: /change password/i }).isVisible().catch(() => false)) {
    await page.getByLabel(/current or temporary password/i).fill("TokTickit1!");
    await page.getByLabel(/new password/i).first().fill("AdminPass1!");
    await page.getByLabel(/confirm password/i).fill("AdminPass1!");
    await page.getByRole("button", { name: /save password/i }).click();
  }
  await expect(page.getByRole("heading", { name: "User Management" })).toBeVisible();
}

test("administrator can manage users and responsive layout does not overflow", async ({ page }) => {
  await loginAsAdmin(page);
  await page.getByLabel("Search users").fill("Morgan");
  await expect(page.getByText("Morgan Davis")).toBeVisible();
  await page.getByLabel("Role").selectOption("ADMINISTRATOR");
  await page.getByRole("button", { name: "New user form" }).click();
  await page.getByLabel("Name").fill("E2E Managed User");
  await page.getByLabel("Email").fill("e2e-managed@example.com");
  await page.getByLabel("Initial password").fill("E2ePass1!");
  await page.getByRole("button", { name: "Save user" }).click();
  await expect(page.getByText(/User created/i)).toBeVisible();
  await page.getByLabel("Search users").fill("E2E Managed");
  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByRole("button", { name: "Save user" }).click();
  await page.getByRole("button", { name: "Set initial password" }).click();
  await page.getByLabel("New initial password").fill("AnotherPass1!");
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
