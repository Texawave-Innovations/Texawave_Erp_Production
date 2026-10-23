import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { signInAsAdmin, uniqueName } from "./helpers/auth";

/**
 * Real-browser walk through put-away (from a completed GRN, respecting a
 * bin's capacity) and an internal movement between two bins. Masters and the
 * GRN are created through the API so the test focuses on the Warehouse
 * screens.
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
    .getByRole("button", { name: category, exact: true })
    .click();
  await page.getByRole("link", { name: link, exact: true }).first().click();
}

test("puts a GRN away into a bin and moves stock between bins", async ({
  page,
  request,
}) => {
  const token = await apiToken(request);
  const stamp = Date.now();
  const productName = uniqueName("E2E WH Widget");
  const sku = `WH-${stamp}`;
  const whName = uniqueName("E2E WH Warehouse");
  const supplierName = uniqueName("E2E WH Supplier");

  const product = await create<{ id: number }>(
    request,
    token,
    "/scm/products",
    {
      productCode: sku,
      name: productName,
    },
  );
  const wh = await create<{ id: number }>(request, token, "/scm/warehouses", {
    code: `W${stamp % 100000}`,
    name: whName,
  });
  const locA = await create<{
    id: number;
    binCode: string;
    locationCode: string;
  }>(request, token, "/scm/warehouse-locations", {
    warehouseId: wh.id,
    locationType: "ZONE",
    code: `A${stamp % 100000}`,
  });
  const locB = await create<{
    id: number;
    binCode: string;
    locationCode: string;
  }>(request, token, "/scm/warehouse-locations", {
    warehouseId: wh.id,
    locationType: "ZONE",
    code: `B${stamp % 100000}`,
  });
  const supplier = await create<{ id: number }>(
    request,
    token,
    "/scm/suppliers",
    {
      companyName: supplierName,
      contactPerson: "A",
    },
  );
  const po = await create<{ id: number }>(
    request,
    token,
    "/scm/procurement/purchase-orders",
    {
      supplierId: supplier.id,
      poDate: new Date().toISOString().slice(0, 10),
      warehouseId: wh.id,
      items: [{ productId: product.id, quantity: 5, unitPrice: 10 }],
    },
  );
  await create(
    request,
    token,
    `/scm/procurement/purchase-orders/${po.id}/submit`,
    {},
  );
  await create(
    request,
    token,
    `/scm/procurement/purchase-orders/${po.id}/approve`,
    {},
  );
  await create(
    request,
    token,
    `/scm/procurement/purchase-orders/${po.id}/send`,
    {},
  );
  const poFull = await (
    await request.get(`${API}/scm/procurement/purchase-orders/${po.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  ).json();
  const poItemId = (poFull.data as { items: { id: number }[] }).items[0]!.id;
  const grn = await create<{ grnNumber: string }>(
    request,
    token,
    "/scm/procurement/goods-receipts",
    {
      purchaseOrderId: po.id,
      receiptDate: new Date().toISOString().slice(0, 10),
      lines: [{ purchaseOrderItemId: poItemId, receivingQuantity: 5 }],
    },
  );

  await signInAsAdmin(page);

  // 1. Put-away: create from the GRN, start, record the destination
  await open(page, "Warehouse", "Put-away");
  await page.getByRole("button", { name: "New Put-away" }).click();
  const createDialog = page.getByRole("dialog");
  await createDialog.getByLabel("Warehouse").selectOption({ label: whName });
  await createDialog
    .getByLabel("Source GRN")
    .selectOption({ label: `${grn.grnNumber} — ${supplierName}` });
  await createDialog.getByRole("button", { name: "Create Put-away" }).click();
  await expect(page.getByText(/TW\/PUTAWAY\/.* created/).first()).toBeVisible();

  const detail = page.getByRole("dialog");
  await detail.getByRole("button", { name: "Start" }).click();
  await expect(detail.getByText("In Progress")).toBeVisible();
  await detail.getByRole("button", { name: "Put Away" }).click();
  const recordDialog = page.getByRole("dialog").last();
  await recordDialog
    .getByLabel("Destination location")
    .selectOption({ label: locA.locationCode });
  await recordDialog.getByLabel("Quantity").fill("5");
  await recordDialog.getByRole("button", { name: "Put Away" }).click();
  await expect(detail.getByText("Completed", { exact: true })).toBeVisible();
  await detail.getByRole("button", { name: "Close", exact: true }).click();

  // 2. Internal movement from A to B
  await open(page, "Warehouse", "Stock Movements");
  await page.getByRole("button", { name: "New Movement" }).click();
  const moveDialog = page.getByRole("dialog");
  await moveDialog.getByLabel("Warehouse").selectOption({ label: whName });
  await moveDialog
    .getByLabel("Product for line 1")
    .selectOption({ label: `${productName} (${sku})` });
  await moveDialog.getByLabel("Quantity for line 1").fill("2");
  await moveDialog
    .getByLabel("Source location for line 1")
    .selectOption({ label: locA.locationCode });
  await moveDialog
    .getByLabel("Destination location for line 1")
    .selectOption({ label: locB.locationCode });
  await moveDialog.getByRole("button", { name: "Create Movement" }).click();
  await expect(page.getByText(/TW\/WHMOV\/.* created/).first()).toBeVisible();

  const moveDetail = page.getByRole("dialog");
  await moveDetail.getByRole("button", { name: "Submit" }).click();
  await expect(moveDetail.getByText("Requested")).toBeVisible();
  await moveDetail.getByRole("button", { name: "Approve" }).click();
  await expect(moveDetail.getByText("Approved", { exact: true })).toBeVisible();
  await moveDetail.getByRole("button", { name: "Complete" }).click();
  await expect(
    moveDetail.getByText("Completed", { exact: true }),
  ).toBeVisible();
});
