import { expect, test } from "@playwright/test";

/**
 * Real-browser proof that the reference feature works end to end through
 * the actual UI (not just via API calls) — login, the response envelope
 * unwrapped correctly, a create-tag round trip, and the empty/loading state
 * disappearing once data loads. Uses the seeded demo user
 * (packages/database/prisma/seed.ts) — run `pnpm --filter database seed`
 * against a running dev DB first.
 */
test("signs in and creates a reference tag", async ({ page }) => {
  await page.goto("/login");

  await page.getByLabel("Organization").fill("demo");
  await page.getByLabel("Email").fill("admin@demo.local");
  await page.getByLabel("Password").fill("ChangeMe123!");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/reference\/tags/);
  await expect(
    page.getByRole("heading", { name: "Reference tags" }),
  ).toBeVisible();

  const tagName = `Playwright tag ${Date.now()}`;
  await page.getByRole("button", { name: "New tag" }).click();
  await page.getByLabel("Name").fill(tagName);
  await page.getByRole("button", { name: "Create tag" }).click();

  await expect(page.getByText("Tag created")).toBeVisible();
  await expect(
    page.getByRole("cell", { name: tagName, exact: true }),
  ).toBeVisible();
});

test("rejects a bad login and lets the user retry without losing the organization field", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Organization").fill("demo");
  await page.getByLabel("Email").fill("admin@demo.local");
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByText("Sign-in failed")).toBeVisible();
  // Preserve entered values on failure (Docs/DESIGN_SYSTEM.md).
  await expect(page.getByLabel("Organization")).toHaveValue("demo");
  await expect(page.getByLabel("Email")).toHaveValue("admin@demo.local");
});
