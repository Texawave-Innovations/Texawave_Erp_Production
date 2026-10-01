import { expect, test } from "@playwright/test";
import { signInAsAdmin, uniqueName } from "./helpers/auth";

test("creates a role at /admin/roles", async ({ page }) => {
  await signInAsAdmin(page);
  await page.goto("/admin/roles");
  await expect(page.getByRole("heading", { name: "Roles" })).toBeVisible();

  const name = uniqueName("PW role");
  await page.getByRole("button", { name: "New role" }).click();
  await page.getByLabel("Name").fill(name);
  await page.getByRole("button", { name: "Create role" }).click();
  await expect(page.getByText("Role created")).toBeVisible();
  await expect(page.getByRole("cell", { name, exact: true })).toBeVisible();
});

test("redirects the legacy /settings/roles path to /admin/roles", async ({
  page,
}) => {
  await signInAsAdmin(page);
  await page.goto("/settings/roles");
  await expect(page).toHaveURL(/\/admin\/roles/);
  await expect(page.getByRole("heading", { name: "Roles" })).toBeVisible();
});
