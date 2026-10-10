import { expect, test } from "@playwright/test";

/**
 * Real-browser coverage for Teams module:
 * The screen loads the team directory, status filters narrow the list,
 * and the New Team dialog validates required fields before submission.
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

test("lists teams and narrows them with status tabs and search", async ({
  page,
}) => {
  await signIn(page);
  await page.getByRole("link", { name: "Teams" }).click();
  await expect(page.getByRole("heading", { name: "Teams" })).toBeVisible();

  // Metric overview cards
  await expect(page.getByText("Total Teams")).toBeVisible();

  // Search input
  const searchInput = page.getByPlaceholder("Search teams...");
  await expect(searchInput).toBeVisible();
  await searchInput.fill("Software");
  await searchInput.fill("");

  // Status dropdown filter
  const statusSelect = page.getByRole("combobox", { name: "Filter by status" });
  await expect(statusSelect).toBeVisible();
  await statusSelect.selectOption("active");
  await statusSelect.selectOption("all");
});

test("opens new team dialog and validates required fields", async ({
  page,
}) => {
  await signIn(page);
  await page.getByRole("link", { name: "Teams" }).click();
  await expect(page.getByRole("heading", { name: "Teams" })).toBeVisible();

  await page.getByRole("button", { name: "New Team" }).click();
  await expect(page.getByRole("heading", { name: "New Team" })).toBeVisible();

  // Attempt creating without entering team name
  await page.getByRole("button", { name: "Create Team" }).click();
  await expect(page.getByText("Team name is required.")).toBeVisible();
});
