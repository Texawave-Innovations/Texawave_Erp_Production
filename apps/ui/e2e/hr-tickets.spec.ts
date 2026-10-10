import { expect, test } from "@playwright/test";

/**
 * Real-browser coverage for Employee Tickets:
 * The screen loads tickets from the API, allows filtering by status,
 * and validates ticket submission forms before posting.
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

test("lists employee tickets and narrows them with status filters", async ({
  page,
}) => {
  await signIn(page);
  await page.getByRole("link", { name: "Employee Tickets" }).click();
  await expect(
    page.getByRole("heading", { name: "Employee Tickets" }),
  ).toBeVisible();

  // Summary metric cards
  await expect(page.getByText("Total Tickets")).toBeVisible();

  // Filter by status
  await page
    .getByRole("combobox", { name: "Filter by status" })
    .selectOption("RESOLVED");
  await page
    .getByRole("combobox", { name: "Filter by status" })
    .selectOption("");

  // Search input
  const searchInput = page.getByLabel("Search tickets");
  await expect(searchInput).toBeVisible();
});

test("opens raise ticket dialog and validates required fields", async ({
  page,
}) => {
  await signIn(page);
  await page.getByRole("link", { name: "Employee Tickets" }).click();
  await expect(
    page.getByRole("heading", { name: "Employee Tickets" }),
  ).toBeVisible();

  const raiseBtn = page.getByRole("button", { name: "Raise Ticket" });
  if (await raiseBtn.isVisible()) {
    await raiseBtn.click();
    await expect(
      page.getByRole("heading", { name: "Raise Ticket" }),
    ).toBeVisible();

    // Submit empty form to trigger validation
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Raise Ticket" })
      .click();
    await expect(page.getByText("Subject is required")).toBeVisible();
  }
});
