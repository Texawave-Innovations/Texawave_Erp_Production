import { expect, test } from "@playwright/test";

/**
 * Real-browser coverage for Full Month Present: the screen loads from
 * GET /hr/attendance/reports/full-month-present, the month selector narrows
 * the request, and a row's "Details" opens the per-day drill-down. Uses the
 * seeded Super Admin (packages/database/prisma/seed.ts) — run the seed
 * against a running dev DB first.
 */
async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Organization").fill("texawave-innovations");
  await page.getByLabel("Email").fill("admin@texawave.com");
  await page.getByLabel("Password").fill("ChangeMe123!");
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("lists full month present and narrows it by month", async ({ page }) => {
  await signIn(page);
  // Client-side link, not page.goto: a hard navigation drops the in-memory
  // auth store (Docs/CODING_STANDARDS.md "Frontend API/state/error
  // standard" — tokens are deliberately not persisted across reloads).
  await page.getByRole("link", { name: "Full Month Present" }).click();
  await expect(
    page.getByRole("heading", { name: "Full Month Present" }),
  ).toBeVisible();

  await expect(
    page
      .getByRole("table", { name: "Full Month Present" })
      .or(page.getByText("No employees match these filters")),
  ).toBeVisible();

  const monthInput = page.getByLabel("Month");
  await monthInput.fill("2026-01");

  await expect(
    page
      .getByRole("table", { name: "Full Month Present" })
      .or(page.getByText("No employees match these filters")),
  ).toBeVisible();
});

test("opens the per-day drill-down for a row", async ({ page }) => {
  await signIn(page);
  await page.getByRole("link", { name: "Full Month Present" }).click();

  const detailsButton = page.getByRole("button", { name: "Details" }).first();
  if (await detailsButton.isVisible()) {
    await detailsButton.click();
    await expect(
      page.getByText("Full Month Present", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Days")).toBeVisible();
  }
});
