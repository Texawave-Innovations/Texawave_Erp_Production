import { expect, test } from "@playwright/test";
import { signInAsAdmin, uniqueName } from "./helpers/auth";

test("creates a user and assigns a role and a team", async ({ page }) => {
  await signInAsAdmin(page);
  await page.goto("/admin/users");
  await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();

  const fullName = uniqueName("PW user");
  const email = `pw-${Date.now()}@texawave.com`;
  await page.getByRole("button", { name: "New user" }).click();
  await page.getByLabel("Full Name").fill(fullName);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("ChangeMe123!");
  await page.getByRole("button", { name: "Create user" }).click();
  await expect(page.getByText("User created")).toBeVisible();

  const row = page.getByRole("row", { name: new RegExp(fullName) });
  await expect(row).toBeVisible();

  await row.getByRole("button", { name: "Roles", exact: true }).click();
  const rolesDialog = page.getByRole("dialog");
  await expect(rolesDialog.getByText("Assign Roles")).toBeVisible();
  await rolesDialog.getByRole("checkbox").first().check();
  await rolesDialog.getByRole("button", { name: "Save roles" }).click();
  await expect(page.getByText(`Updated roles for "${fullName}"`)).toBeVisible();

  await row.getByRole("button", { name: "Teams", exact: true }).click();
  const teamsDialog = page.getByRole("dialog");
  await teamsDialog.getByRole("checkbox").first().check();
  await teamsDialog.getByRole("button", { name: "Save teams" }).click();
  await expect(page.getByText(`Updated teams for "${fullName}"`)).toBeVisible();
});

test("shows an error toast when creating a user with a duplicate email", async ({
  page,
}) => {
  await signInAsAdmin(page);
  await page.goto("/admin/users");
  await page.getByRole("button", { name: "New user" }).click();
  await page.getByLabel("Full Name").fill("Duplicate Admin");
  await page.getByLabel("Email").fill("admin@texawave.com");
  await page.getByLabel("Password").fill("ChangeMe123!");
  await page.getByRole("button", { name: "Create user" }).click();
  await expect(page.getByText("Could not create user")).toBeVisible();
});
