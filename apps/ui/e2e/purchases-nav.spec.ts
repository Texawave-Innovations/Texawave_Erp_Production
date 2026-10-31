import { expect, test, type Page } from "@playwright/test";

/**
 * Real-browser coverage for the "Purchases" top-nav entry: a single
 * `/purchases` route with client-side tabs (features/purchases/components/
 * PurchasesView) over the existing SCM procurement pipeline + Finance —
 * Suppliers, Material Requisitions, RFQs, Supplier Quotations, Quotation
 * Comparison, Purchase Orders, Goods Receipts, Payments Made — not a
 * separate module/data model, and not eight separate page navigations.
 * Proves the tab switch stays on one page (the "Purchase Management"
 * heading never disappears) while each tab's real content renders — the
 * underlying screens' own business logic is already covered by
 * scm-suppliers.spec.ts / scm-procurement.spec.ts and the finance
 * payments-made tests.
 * Uses the seeded Super Admin, who must hold scm.procurement.read,
 * scm.finance.read/supplier read, and finance payments-made read access (run
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

const TAB_EXPECTATIONS: readonly {
  tab: string;
  urlTab: string;
  heading: string;
}[] = [
  {
    tab: "Material Requisitions",
    urlTab: "requisitions",
    heading: "Material Requisitions",
  },
  { tab: "RFQs", urlTab: "rfqs", heading: "RFQs" },
  {
    tab: "Supplier Quotations",
    urlTab: "quotations",
    heading: "Supplier Quotations",
  },
  {
    tab: "Quotation Comparison",
    urlTab: "comparison",
    heading: "Quotation Comparison",
  },
  {
    tab: "Purchase Orders",
    urlTab: "purchase-orders",
    heading: "Purchase Orders",
  },
  {
    tab: "Goods Receipts",
    urlTab: "goods-receipts",
    heading: "Goods Receipts",
  },
  { tab: "Payments Made", urlTab: "payments-made", heading: "Payments Made" },
];

test("Purchases tabs switch in place without navigating away", async ({
  page,
}) => {
  await signIn(page);

  await page.getByRole("button", { name: "Purchases", exact: true }).click();
  await page
    .getByRole("menu", { name: "Purchases categories" })
    .getByRole("link", { name: "Suppliers", exact: true })
    .click();

  await expect(page).toHaveURL(/\/purchases(\?tab=vendors)?$/);
  const pageHeading = page.getByRole("heading", {
    name: "Purchase Management",
    exact: true,
  });
  await expect(pageHeading).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Suppliers", exact: true }),
  ).toBeVisible();

  for (const { tab, urlTab, heading } of TAB_EXPECTATIONS) {
    await page.getByRole("tab", { name: tab }).click();
    await expect(page).toHaveURL(new RegExp(`\\/purchases\\?tab=${urlTab}`));
    await expect(pageHeading).toBeVisible(); // still the same page, not a new one
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
  }
});
