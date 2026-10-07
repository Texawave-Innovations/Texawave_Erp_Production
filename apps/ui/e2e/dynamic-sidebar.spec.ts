import { expect, test } from "@playwright/test";
import { signInAsAdmin } from "./helpers/auth";

test("sidebar shows permission-gated admin links and navigates", async ({
  page,
}) => {
  await signInAsAdmin(page);
  const nav = page.getByRole("navigation");

  for (const label of ["Departments", "Roles", "Users", "Navigation Menu"]) {
    await expect(nav.getByRole("link", { name: label })).toBeVisible();
  }

  await nav.getByRole("link", { name: "Users" }).click();
  await expect(page).toHaveURL(/\/admin\/users/);
  await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
});

test("sidebar shows the HR group and navigates to its screens", async ({
  page,
}) => {
  await signInAsAdmin(page);
  const nav = page.getByRole("navigation");

  await expect(nav.getByText("HR", { exact: true })).toBeVisible();
  for (const href of ["/hr/dashboard", "/hr/employees", "/hr/recruitment"]) {
    await expect(nav.locator(`a[href='${href}']`)).toBeVisible();
  }

  await nav.locator("a[href='/hr/employees']").click();
  await expect(page).toHaveURL(/\/hr\/employees/);
  await expect(page.getByRole("heading", { name: "Employees" })).toBeVisible();

  await nav.locator("a[href='/hr/recruitment']").click();
  await expect(page).toHaveURL(/\/hr\/recruitment/);

  await nav.locator("a[href='/hr/dashboard']").click();
  await expect(page).toHaveURL(/\/hr\/dashboard/);
});
