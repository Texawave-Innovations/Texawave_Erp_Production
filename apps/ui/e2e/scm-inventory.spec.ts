import { expect, test, type Page } from "@playwright/test";
import { signInAsAdmin, uniqueName } from "./helpers/auth";

/**
 * Real-browser coverage for the SCM foundation: create a product and two
 * warehouses, seed stock with an opening balance, then move it through a
 * transfer (request -> approve -> dispatch -> receive) and check the stock
 * overview at each step. Uses the seeded Super Admin, who must hold the
 * scm.* permissions (run `permissions:sync`, then grant them in Settings).
 */
async function goto(page: Page, category: string, link: string) {
  await page.getByRole("button", { name: "SCM", exact: true }).click();
  const menu = page.getByRole("menu", { name: "SCM categories" });
  await menu.getByRole("button", { name: category }).click();
  await page.getByRole("link", { name: link, exact: true }).first().click();
}

test("seeds stock and moves it through a transfer", async ({ page }) => {
  const sku = `E2E-${Date.now()}`;
  const productName = uniqueName("E2E Widget");
  const whA = uniqueName("E2E WH A");
  const whB = uniqueName("E2E WH B");

  await signInAsAdmin(page);

  await goto(page, "Catalogue & Warehouses", "Products");
  await page.getByRole("button", { name: "Add Product" }).first().click();
  await page.getByLabel("Product Code").fill(sku);
  await page.getByLabel(/^Name/).fill(productName);
  await page.getByRole("button", { name: "Create Product" }).click();
  await expect(page.getByText("Product created").first()).toBeVisible();

  for (const [n, name] of [
    ["A", whA],
    ["B", whB],
  ] as const) {
    await goto(page, "Catalogue & Warehouses", "Warehouses");
    await page.getByRole("button", { name: "Add Warehouse" }).first().click();
    await page.getByLabel(/^Code/).fill(`${n}${Date.now() % 100000}`);
    await page.getByLabel(/^Name/).fill(name);
    await page.getByRole("button", { name: "Create Warehouse" }).click();
    await expect(page.getByText("Warehouse created").first()).toBeVisible();
  }

  await goto(page, "Inventory", "Stock Overview");
  await page.getByRole("button", { name: "Post Opening Balance" }).click();
  await page
    .getByRole("dialog")
    .getByLabel(/^Product/)
    .selectOption({ label: `${productName} (${sku})` });
  await page
    .getByRole("dialog")
    .getByLabel(/^Warehouse/)
    .selectOption({ label: whA });
  await page
    .getByRole("dialog")
    .getByLabel(/^Opening Quantity/)
    .fill("10");
  await page
    .getByRole("button", { name: "Post Opening Balance" })
    .last()
    .click();
  await expect(page.getByText("Opening balance posted").first()).toBeVisible();

  await page.getByRole("searchbox", { name: "Search stock rows" }).fill(sku);
  const rowA = page.getByRole("row", {
    name: new RegExp(`${productName}.*${whA}`),
  });
  await expect(rowA).toBeVisible();

  await goto(page, "Inventory", "Transfers");
  await page.getByRole("button", { name: "Request Transfer" }).click();
  await page
    .getByRole("dialog")
    .getByLabel(/^Product/)
    .selectOption({ label: `${productName} (${sku})` });
  await page
    .getByRole("dialog")
    .getByLabel(/^Source Warehouse/)
    .selectOption({ label: whA });
  await page
    .getByRole("dialog")
    .getByLabel(/^Destination Warehouse/)
    .selectOption({ label: whB });
  await page
    .getByRole("dialog")
    .getByLabel(/^Quantity/)
    .fill("4");
  await page.getByRole("button", { name: "Request Transfer" }).last().click();
  await expect(page.getByText("Transfer requested").first()).toBeVisible();

  const row = page.getByRole("row").filter({ hasText: productName });
  await row.getByRole("button", { name: "Approve" }).click();
  await row.getByRole("button", { name: "Dispatch" }).click();
  await expect(row.getByText("In Transit")).toBeVisible();
  await row.getByRole("button", { name: "Receive" }).click();
  await expect(row.getByText("Received")).toBeVisible();
});
