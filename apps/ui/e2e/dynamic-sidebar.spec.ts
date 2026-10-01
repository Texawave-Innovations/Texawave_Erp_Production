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
