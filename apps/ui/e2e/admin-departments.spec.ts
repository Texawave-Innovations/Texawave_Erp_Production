import { expect, test } from "@playwright/test";
import { signInAsAdmin, uniqueName } from "./helpers/auth";

test("creates, renames and deletes a department", async ({ page }) => {
  await signInAsAdmin(page);
  await page.goto("/admin/departments");
  await expect(
    page.getByRole("heading", { name: "Departments" }),
  ).toBeVisible();

  const name = uniqueName("PW dept");
  await page.getByRole("button", { name: "New department" }).click();
  await page.getByLabel("Department Name").fill(name);
  await page.getByRole("button", { name: "Create department" }).click();
  await expect(page.getByText("Department created")).toBeVisible();
  await expect(page.getByRole("cell", { name, exact: true })).toBeVisible();

  const renamed = `${name} v2`;
  await page.getByRole("button", { name: `Edit ${name}` }).click();
  await page.getByLabel("Department Name").fill(renamed);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Department updated")).toBeVisible();
  await expect(
    page.getByRole("cell", { name: renamed, exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: `Delete ${renamed}` }).click();
  await expect(page.getByText(`Deleted "${renamed}"`)).toBeVisible();
  await expect(
    page.getByRole("cell", { name: renamed, exact: true }),
  ).toHaveCount(0);
});

test("rejects an empty department name inline", async ({ page }) => {
  await signInAsAdmin(page);
  await page.goto("/admin/departments");
  await page.getByRole("button", { name: "New department" }).click();
  await page.getByRole("button", { name: "Create department" }).click();
  await expect(page.getByText("Department created")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Create department" }),
  ).toBeVisible();
});
