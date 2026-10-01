import { expect, test } from "@playwright/test";
import { signInAsAdmin, uniqueName } from "./helpers/auth";

test("creates a menu item", async ({ page }) => {
  await signInAsAdmin(page);
  await page.goto("/admin/menu");
  await expect(
    page.getByRole("heading", { name: "Navigation Menu" }),
  ).toBeVisible();

  const label = uniqueName("PW item");
  await page.getByRole("button", { name: "New menu item" }).click();
  await page.getByLabel("Code").fill(`pw-${Date.now()}`);
  await page.getByLabel("Label").fill(label);
  await page.getByRole("button", { name: "Create item" }).click();
  await expect(page.getByText("Menu item created")).toBeVisible();
  await expect(page.getByText(label, { exact: true })).toBeVisible();
});
