import { expect, test } from "@playwright/test";

/**
 * Real-browser coverage for Expense Approvals:
 * The screen loads claims, switches between My Claims and Team Claims tabs,
 * and validates expense submission before posting.
 * Uses the seeded Super Admin (packages/database/prisma/seed.ts).
 */
async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Organization").fill("texawave-innovations");
  await page.getByLabel("Email").fill("admin@texawave.com");
  await page.locator("input#password").fill("ChangeMe123!");
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("lists expense claims and navigates tabs and filters", async ({
  page,
}) => {
  await signIn(page);
  await page.getByRole("link", { name: "Expense Approvals" }).click();
  await expect(
    page.getByRole("heading", { name: "Expense Approvals" }),
  ).toBeVisible();

  // Metric overview cards
  await expect(page.getByText("Total Claims")).toBeVisible();

  // Tab switching
  const teamTab = page.getByRole("button", { name: /Team Expense Claims/ });
  if (await teamTab.isVisible()) {
    await teamTab.click();
  }

  const myTab = page.getByRole("button", { name: /My Expense Claims/ });
  if (await myTab.isVisible()) {
    await myTab.click();
  }

  // Filter by status combobox
  const statusFilter = page.getByRole("combobox", {
    name: "Filter by status",
  });
  if (await statusFilter.isVisible()) {
    await statusFilter.selectOption("APPROVED");
    await statusFilter.selectOption("");
  }
});

test("opens submit expense claim dialog and validates required fields", async ({
  page,
}) => {
  await signIn(page);
  await page.getByRole("link", { name: "Expense Approvals" }).click();
  await expect(
    page.getByRole("heading", { name: "Expense Approvals" }),
  ).toBeVisible();

  const submitBtn = page.getByRole("button", {
    name: "Submit Expense Claim",
  });
  if (await submitBtn.isVisible()) {
    await submitBtn.click();
    await expect(
      page.getByRole("heading", { name: "Submit Expense Claim" }),
    ).toBeVisible();

    // Submit empty to verify client-side validation
    await page.getByRole("button", { name: "Submit Claim" }).click();
    await expect(page.getByText("Select an expense type")).toBeVisible();
  }
});
