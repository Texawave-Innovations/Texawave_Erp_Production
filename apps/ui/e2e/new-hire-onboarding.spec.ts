import { expect, test } from "@playwright/test";

/**
 * TEXA-16 onboarding golden path, through the real UI: an admin creates a
 * new hire (login + employee record), the hire signs in with the temporary
 * password, is forced onto the change-password screen, and changes it.
 * Uses the seeded Super Admin (packages/database/prisma/seed.ts) — run
 * `pnpm --filter database run seed` against the dev DB first. Dropdowns are
 * chosen by index so the test does not depend on seed names.
 */
const TEMP_PASSWORD = "TempPass123!";
const NEW_PASSWORD = "BrandNew456!";

async function signIn(
  page: import("@playwright/test").Page,
  email: string,
  password: string,
) {
  await page.goto("/login");
  await page.getByLabel("Organization").fill("texawave-innovations");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("admin creates a new hire, who must change the temporary password before continuing", async ({
  browser,
}) => {
  const suffix = Date.now();
  const hireEmail = `hire-${suffix}@example.com`;

  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  await signIn(admin, "admin@texawave.com", "ChangeMe123!");
  await expect(admin).toHaveURL(/\/reference\/tags|\/$/);

  // Navigate with the sidebar link and the page's own button, not a typed
  // URL: a typed address reloads the page and the in-memory session is lost
  // (see Docs note on auth-store). There is no dedicated sidebar entry for
  // the new-hire form — it's reached from Employees, like in the real app.
  await admin.getByRole("link", { name: "Employees" }).click();
  await admin.getByRole("button", { name: "New employee" }).click();
  await expect(admin.getByRole("heading", { name: "New hire" })).toBeVisible();

  await admin.getByLabel("First name").fill("Priya");
  await admin.getByLabel("Last name").fill("Sharma");
  await admin.getByLabel("Mobile number").fill("9841055667");
  await admin.getByLabel("Email (sign-in)").fill(hireEmail);
  await admin.getByLabel("Department").selectOption({ index: 1 });
  await admin.getByLabel("Team").selectOption({ index: 1 });
  await admin.getByLabel("Designation").selectOption({ index: 1 });
  await admin.getByLabel("Employment type").selectOption({ index: 1 });
  // Give the hire an additional role on top of the Employee baseline that
  // every new hire now gets automatically (see createNewHire). Never hand a
  // test hire the Super Admin role, and Employee itself is excluded from
  // this dropdown since it's implicit.
  const roleOptions = await admin
    .getByLabel("Additional role")
    .locator("option")
    .allTextContents();
  const addOnRole = roleOptions.find(
    (text) =>
      text && !text.startsWith("Select") && !text.includes("Super Admin"),
  );
  expect(
    addOnRole,
    "seed must provide a non-admin additional role",
  ).toBeTruthy();
  await admin
    .getByLabel("Additional role")
    .selectOption({ label: addOnRole as string });
  await admin.getByLabel("Date of joining").fill("2026-10-01");
  await admin.getByLabel("Temporary password").fill(TEMP_PASSWORD);
  await admin.getByRole("button", { name: "Create new hire" }).click();

  await expect(
    admin.getByRole("heading", { name: "New hire created" }),
  ).toBeVisible();
  await expect(admin.getByText(TEMP_PASSWORD)).toBeVisible();
  await adminContext.close();

  // The new hire signs in and is forced onto the change-password screen.
  const hireContext = await browser.newContext();
  const hire = await hireContext.newPage();
  await signIn(hire, hireEmail, TEMP_PASSWORD);
  await expect(hire).toHaveURL(/\/change-password/);
  await expect(
    hire.getByRole("heading", { name: "Change your password" }),
  ).toBeVisible();

  // A weak new password is rejected inline, values preserved.
  await hire.getByLabel("Current (temporary) password").fill(TEMP_PASSWORD);
  // Required labels carry an asterisk in their accessible name, so match the start only.
  await hire.getByLabel(/^New password/).fill("weak");
  await hire.getByLabel("Confirm new password").fill("weak");
  await hire.getByRole("button", { name: "Change password" }).click();
  await expect(
    hire.getByText("Password must be at least 8 characters."),
  ).toBeVisible();
  await expect(hire.getByLabel("Current (temporary) password")).toHaveValue(
    TEMP_PASSWORD,
  );

  // A valid change succeeds and asks the user to sign in again.
  await hire.getByLabel(/^New password/).fill(NEW_PASSWORD);
  await hire.getByLabel("Confirm new password").fill(NEW_PASSWORD);
  await hire.getByRole("button", { name: "Change password" }).click();
  // Known app behaviour: the change clears the session, so the browser goes
  // straight to /login and the "Password changed" screen is not shown.
  await expect(hire).toHaveURL(/\/login/);

  await signIn(hire, hireEmail, NEW_PASSWORD);
  await expect(hire).not.toHaveURL(/\/change-password/);
  // Regression coverage for the bug this test caught: a hire whose only
  // extra role lacked employee_self_service.profile.read used to 403 on
  // /employee/profile and land on /reference/tags (the admin HR screen)
  // instead of the onboarding wizard. Every new hire now also gets the
  // Employee role automatically, so this must land on /onboarding.
  await expect(hire).toHaveURL(/\/onboarding/);
  await hireContext.close();
});
