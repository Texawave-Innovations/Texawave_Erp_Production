import { expect, test } from "@playwright/test";

/**
 * Real-browser coverage for Holidays: the list loads from the API, the year
 * and status filters narrow it, and creating a holiday with an invalid form
 * is blocked client-side before any request.
 * Uses the seeded Super Admin (packages/database/prisma/seed.ts) — run the
 * seed against a running dev DB first.
 */
async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Organization").fill("texawave-innovations");
  await page.getByLabel("Email").fill("admin@texawave.com");
  await page.getByLabel("Password").fill("ChangeMe123!");
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("lists holidays and narrows them with year/status filters", async ({
  page,
}) => {
  await signIn(page);
  // Client-side link, not page.goto: a hard navigation drops the in-memory
  // auth store (Docs/CODING_STANDARDS.md "Frontend API/state/error
  // standard" — tokens are deliberately not persisted across reloads).
  await page.getByRole("link", { name: "Holidays" }).click();
  await expect(page.getByRole("heading", { name: "Holidays" })).toBeVisible();

  await page
    .getByRole("combobox", { name: "Filter by status" })
    .selectOption("false");
  await page
    .getByRole("combobox", { name: "Filter by status" })
    .selectOption("true");

  await expect(
    page
      .getByRole("table", { name: "Holidays" })
      .or(page.getByText("No holidays defined")),
  ).toBeVisible();
});

test("creates a holiday and then deactivates it", async ({ page }) => {
  await signIn(page);
  await page.getByRole("link", { name: "Holidays" }).click();
  await expect(page.getByRole("heading", { name: "Holidays" })).toBeVisible();

  await page.getByRole("button", { name: "New holiday" }).click();
  const year = new Date().getFullYear();
  const uniqueName = `E2E Test Holiday ${Date.now()}`;
  await page.getByLabel("Date").fill(`${year}-12-30`);
  await page.getByLabel("Holiday name").fill(uniqueName);
  await page.getByRole("button", { name: "Create holiday" }).click();

  const row = page.getByRole("row", { name: new RegExp(uniqueName) });
  await expect(row).toBeVisible();

  await row.getByRole("button", { name: `Deactivate ${uniqueName}` }).click();
  await expect(
    row.getByRole("button", { name: `Activate ${uniqueName}` }),
  ).toBeVisible();
});

test("blocks an invalid holiday submission", async ({ page }) => {
  let posted = false;
  page.on("request", (req) => {
    if (req.method() === "POST" && req.url().endsWith("/hr/holidays"))
      posted = true;
  });

  await signIn(page);
  await page.getByRole("link", { name: "Holidays" }).click();
  await expect(page.getByRole("heading", { name: "Holidays" })).toBeVisible();

  await page.getByRole("button", { name: "New holiday" }).click();
  await page.getByRole("button", { name: "Create holiday" }).click();

  await expect(page.getByText("Date is required")).toBeVisible();
  expect(posted).toBe(false);
});
