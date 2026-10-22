import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { signInAsAdmin, uniqueName } from "./helpers/auth";

/**
 * Real-browser walk through the whole procurement pipeline: requisition ->
 * approve -> RFQ -> supplier quotation -> comparison/selection -> purchase
 * order -> approve/send -> goods receipt, ending with stock on hand.
 * Masters (supplier, product, warehouse) are created through the API so the
 * test focuses on the procurement screens. Uses the seeded Super Admin, who
 * must hold the scm.* permissions.
 */
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

async function apiToken(request: APIRequestContext) {
  const res = await request.post(`${API}/auth/login`, {
    data: {
      organizationSlug: "texawave-innovations",
      email: "admin@texawave.com",
      password: "ChangeMe123!",
    },
  });
  return ((await res.json()) as { data: { accessToken: string } }).data
    .accessToken;
}

async function create<T>(
  request: APIRequestContext,
  token: string,
  path: string,
  data: object,
) {
  const res = await request.post(`${API}${path}`, {
    data,
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.ok(), `${path} -> ${res.status()}`).toBeTruthy();
  return ((await res.json()) as { data: T }).data;
}

async function open(page: Page, category: string, link: string) {
  await page.getByRole("button", { name: "SCM", exact: true }).click();
  await page
    .getByRole("menu", { name: "SCM categories" })
    .getByRole("button", { name: category })
    .click();
  await page.getByRole("link", { name: link, exact: true }).first().click();
}

test("runs a purchase from requisition to goods receipt", async ({
  page,
  request,
}) => {
  const token = await apiToken(request);
  const stamp = Date.now();
  const supplierName = uniqueName("E2E Supplier");
  const productName = uniqueName("E2E Part");
  const sku = `PR-${stamp}`;
  const whName = uniqueName("E2E WH");

  await create(request, token, "/scm/suppliers", {
    companyName: supplierName,
    contactPerson: "Buyer",
  });
  await create(request, token, "/scm/products", {
    productCode: sku,
    name: productName,
  });
  await create(request, token, "/scm/warehouses", {
    code: `W${stamp % 100000}`,
    name: whName,
  });

  await signInAsAdmin(page);

  // 1. Requisition: create, submit, approve
  await open(page, "Procurement", "Purchase Requisitions");
  await page.getByRole("button", { name: "New Requisition" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/^Warehouse/).selectOption({ label: whName });
  await dialog
    .getByLabel("Product for line 1")
    .selectOption({ label: `${productName} (${sku})` });
  await dialog.getByLabel("Qty for line 1").fill("10");
  await dialog.getByLabel("Est. Unit Cost for line 1").fill("25");
  await dialog.getByRole("button", { name: "Save as Draft" }).click();
  await expect(
    page.getByText("Requisition saved as draft").first(),
  ).toBeVisible();

  const prRow = page.getByRole("row").filter({ hasText: "Draft" }).first();
  await prRow.getByRole("button", { name: "Submit" }).click();
  await expect(
    page.getByText("Requisition submitted for approval").first(),
  ).toBeVisible();
  await page
    .getByRole("row")
    .filter({ hasText: "Submitted" })
    .first()
    .getByRole("button", { name: "Approve" })
    .click();
  await expect(page.getByText("Requisition approved").first()).toBeVisible();

  // 2. RFQ from the approved requisition, issued
  await page
    .getByRole("row")
    .filter({ hasText: "Approved" })
    .first()
    .getByRole("button", { name: "Create RFQ" })
    .click();
  const rfqDialog = page.getByRole("dialog");
  await rfqDialog.getByLabel(supplierName).check();
  await rfqDialog.getByRole("button", { name: "Create RFQ (draft)" }).click();
  await expect(page.getByText(/RFQ .* created as draft/).first()).toBeVisible();
  await page
    .getByRole("row")
    .filter({ hasText: "Draft" })
    .first()
    .getByRole("button", { name: "Issue" })
    .click();
  await expect(page.getByText("RFQ issued to suppliers").first()).toBeVisible();

  // 3. Record the supplier's quotation
  await page
    .getByRole("row")
    .filter({ hasText: "Responses Pending" })
    .first()
    .getByRole("button", { name: "Record Quotation" })
    .click();
  const qDialog = page.getByRole("dialog");
  await qDialog
    .getByRole("combobox", { name: /^Supplier/ })
    .selectOption({ label: supplierName });
  await qDialog.getByLabel("Unit Price for line 1").fill("20");
  await qDialog.getByLabel("Tax % for line 1").fill("18");
  await qDialog.getByRole("button", { name: "Record Quotation" }).click();
  await expect(page.getByText(/Quotation .* recorded/).first()).toBeVisible();

  // 4. Compare and select it, then raise the PO
  await page
    .getByRole("row")
    .filter({ hasText: supplierName })
    .getByRole("button", { name: "Compare" })
    .click();
  await page.getByRole("radio", { name: /^Select / }).check();
  await page.getByRole("button", { name: "Select quotation & save" }).click();
  await expect(page.getByText("Comparison saved").first()).toBeVisible();
  await page.getByRole("button", { name: "Create PO from selected" }).click();
  await page
    .getByRole("dialog")
    .getByLabel(/^Warehouse/)
    .selectOption({ label: whName });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save as Draft" })
    .click();
  await expect(
    page.getByText(/Purchase order .* created as draft/).first(),
  ).toBeVisible();

  // 5. Submit, approve, mark sent
  await page
    .getByRole("row")
    .filter({ hasText: "Draft" })
    .first()
    .getByRole("button", { name: "Submit" })
    .click();
  await expect(
    page.getByText("Purchase order submitted for approval").first(),
  ).toBeVisible();
  await page
    .getByRole("row")
    .filter({ hasText: "Pending Approval" })
    .first()
    .getByRole("button", { name: "Approve" })
    .click();
  await expect(page.getByText(/Purchase order approved/).first()).toBeVisible();
  await page
    .getByRole("row")
    .filter({ hasText: "Approved" })
    .first()
    .getByRole("button", { name: "Mark Sent" })
    .click();
  await expect(
    page.getByText("Purchase order marked as sent").first(),
  ).toBeVisible();

  // 6. Receive the goods
  await page
    .getByRole("row")
    .filter({ hasText: "Sent" })
    .first()
    .getByRole("button", { name: "Receive Goods" })
    .click();
  const grnDialog = page.getByRole("dialog");
  await grnDialog
    .getByLabel(`Receiving quantity for ${productName}`)
    .fill("10");
  await grnDialog.getByRole("button", { name: "Post Goods Receipt" }).click();
  await expect(page.getByText(/posted — stock updated/).first()).toBeVisible();

  // 7. Stock overview now shows the received quantity
  await open(page, "Inventory", "Stock Overview");
  await page.getByRole("searchbox", { name: "Search stock rows" }).fill(sku);
  const row = page
    .getByRole("row")
    .filter({ hasText: productName })
    .filter({ hasText: whName });
  await expect(row).toBeVisible();
  await expect(row.getByText("10").first()).toBeVisible();
});
