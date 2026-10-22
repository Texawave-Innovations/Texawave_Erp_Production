import { expect, test, type Page } from "@playwright/test";

/**
 * Real-browser coverage for SCM Suppliers: list loads, the form validates
 * client-side, a supplier is created (code pre-filled), found by search,
 * opened on its detail page, and toggled Inactive.
 * Uses the seeded Super Admin, who must hold scm.supplier.read/write (run
 * `permissions:sync` and grant them in Settings -> Roles first).
 */
async function signIn(page: Page) {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Organization").fill("texawave-innovations");
  await page.getByLabel("Email").fill("admin@texawave.com");
  await page.getByRole("textbox", { name: "Password" }).fill("ChangeMe123!");
  await page.getByRole("button", { name: "Sign in" }).click();
}

async function openSuppliers(page: Page) {
  await signIn(page);
  await page.getByRole("button", { name: "SCM", exact: true }).click();
  await page
    .getByRole("menu", { name: "SCM categories" })
    .getByRole("link", { name: "Suppliers" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Suppliers", exact: true }),
  ).toBeVisible();
}

test("blocks an invalid supplier form before any request", async ({ page }) => {
  await openSuppliers(page);
  await page.getByRole("button", { name: "Add Supplier" }).first().click();
  await page.getByLabel("Company Name").fill("Invalid Co");
  await page.getByLabel("Contact Name").fill("Someone");
  await page.getByLabel("GSTIN").fill("BADGSTIN");
  await page.getByRole("button", { name: "Create Supplier" }).click();
  await expect(page.getByText("Invalid GSTIN format")).toBeVisible();
});

test("creates a supplier, finds it, opens detail and deactivates it", async ({
  page,
}) => {
  const company = `E2E Supplier ${Date.now()}`;
  await openSuppliers(page);

  await page.getByRole("button", { name: "Add Supplier" }).first().click();
  await expect(page.getByLabel("Supplier Code")).toHaveValue(/^VEND-\d{4}$/);
  await page.getByLabel("Company Name").fill(company);
  await page.getByLabel("Contact Name").fill("Ravi Kumar");
  await page.getByLabel("Email").fill("ravi@example.com");
  await page.getByRole("button", { name: "Create Supplier" }).click();

  await page.getByRole("searchbox", { name: "Search suppliers" }).fill(company);
  const row = page.getByRole("row", { name: new RegExp(company) });
  await expect(row).toBeVisible();

  await row.getByRole("button", { name: /^Deactivate/ }).click();
  await expect(row.getByText("Inactive")).toBeVisible();

  await page.getByRole("link", { name: company, exact: true }).click();
  await expect(page.getByRole("heading", { name: company })).toBeVisible();
  await page.getByRole("tab", { name: "Activity" }).click();
  await expect(page.getByText("Supplier created")).toBeVisible();
  await expect(page.getByText(/Supplier status changed: Active/)).toBeVisible();
});
