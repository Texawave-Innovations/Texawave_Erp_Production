import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { signInAsAdmin, uniqueName } from "./helpers/auth";

/**
 * Real-browser walk through a customer return (create -> submit -> approve
 * -> in transit -> receive -> inspect -> disposition -> complete) and a QC
 * inventory inspection with quarantine release. Masters, the fulfilled order
 * and opening stock are created through the API so the test focuses on the
 * Returns and Quality screens.
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

test("processes a customer return to completion via the Returns screens", async ({
  page,
  request,
}) => {
  const token = await apiToken(request);
  const stamp = Date.now();
  const customerName = uniqueName("E2E Return Customer");
  const productName = uniqueName("E2E Return Widget");
  const sku = `RT-${stamp}`;
  const whName = uniqueName("E2E Return WH");

  const customer = await create<{ id: number }>(
    request,
    token,
    "/scm/customers",
    { name: customerName, shippingAddress: "9 Return Lane" },
  );
  const product = await create<{ id: number }>(
    request,
    token,
    "/scm/products",
    { productCode: sku, name: productName },
  );
  const wh = await create<{ id: number }>(request, token, "/scm/warehouses", {
    code: `R${stamp % 100000}`,
    name: whName,
  });
  await create(request, token, "/scm/inventory/opening-balance", {
    productId: product.id,
    warehouseId: wh.id,
    quantity: 5,
  });
  const so = await create<{ id: number; soNumber: string }>(
    request,
    token,
    "/scm/sales-orders",
    {
      customerId: customer.id,
      orderDate: new Date().toISOString().slice(0, 10),
      items: [{ productId: product.id, quantity: 5, unitPrice: 20 }],
    },
  );
  await create(request, token, `/scm/sales-orders/${so.id}/confirm`, {});
  const f = await create<{ id: number; fulfillmentNumber: string }>(
    request,
    token,
    "/scm/fulfillments",
    { salesOrderId: so.id, warehouseId: wh.id },
  );
  await create(request, token, `/scm/fulfillments/${f.id}/reserve`, {});
  await create(request, token, `/scm/fulfillments/${f.id}/pick-list`, {});
  const picks = await (
    await request.get(`${API}/scm/pickings?limit=100`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  ).json();
  const pick = (
    picks.data as {
      id: number;
      fulfillment: { id: number };
      items: { id: number }[];
    }[]
  ).find((p) => p.fulfillment.id === f.id)!;
  await create(request, token, `/scm/pickings/${pick.id}/start`, {});
  await create(request, token, `/scm/pickings/${pick.id}/record`, {
    items: [{ pickingItemId: pick.items[0]!.id, pickedQuantity: 5 }],
  });
  await create(request, token, "/scm/packings", {
    pickingId: pick.id,
    packages: [
      { packageNumber: "P1", items: [{ productId: product.id, quantity: 5 }] },
    ],
  });
  await create(request, token, `/scm/fulfillments/${f.id}/finalize`, {});

  await signInAsAdmin(page);

  // 1. Create the customer return
  await open(page, "Returns", "Customer Returns");
  await page.getByRole("button", { name: "Customer Return" }).click();
  const createDialog = page.getByRole("dialog");
  await createDialog.getByLabel(/^Fulfillment/).selectOption({
    label: `${f.fulfillmentNumber} — ${so.soNumber} — ${customerName}`,
  });
  await createDialog.getByLabel(`Return ${productName}`).check();
  await createDialog.getByLabel(`Quantity for ${productName}`).fill("2");
  await createDialog.getByRole("button", { name: "Create Return" }).click();
  await expect(page.getByText(/TW\/CR\/.* created/).first()).toBeVisible();

  const row = () => page.getByRole("row").filter({ hasText: customerName });
  await row().click();
  const detail = page.getByRole("dialog");

  // 2. Submit -> approve -> in transit -> receive
  await detail.getByRole("button", { name: "Submit" }).click();
  await expect(detail.getByText("Pending Approval")).toBeVisible();
  await detail.getByRole("button", { name: "Approve" }).click();
  await expect(detail.getByText("Approved", { exact: true })).toBeVisible();
  await detail.getByRole("button", { name: "Mark In Transit" }).click();
  const transitDialog = page.getByRole("dialog").last();
  await transitDialog.getByLabel("Carrier").fill("Self");
  await transitDialog.getByLabel("Tracking number").fill("TRK-RET-1");
  await transitDialog.getByRole("button", { name: "Confirm" }).click();
  await expect(detail.getByText("In Transit", { exact: true })).toBeVisible();
  await detail.getByRole("button", { name: "Receive" }).click();
  await page
    .getByRole("dialog")
    .last()
    .getByRole("button", { name: "Receive" })
    .click();
  await expect(detail.getByText("Received", { exact: true })).toBeVisible();

  // 3. Inspect: accept 1, reject 1
  await detail.getByRole("button", { name: "Start Inspection" }).click();
  await expect(detail.getByText("Inspection Pending")).toBeVisible();
  await detail.getByRole("button", { name: "Record Inspection" }).click();
  const inspectDialog = page.getByRole("dialog").last();
  await inspectDialog
    .getByLabel(`Accepted quantity for ${productName}`)
    .fill("1");
  await inspectDialog
    .getByLabel(`Rejected quantity for ${productName}`)
    .fill("1");
  await inspectDialog.getByRole("button", { name: "Save Inspection" }).click();
  await expect(detail.getByText("Inspected", { exact: true })).toBeVisible();
  await detail.getByRole("button", { name: "Move to Disposition" }).click();
  await expect(detail.getByText("Disposition Pending")).toBeVisible();

  // 4. Disposition: restock the accepted unit, quarantine the rejected one
  await detail.getByRole("button", { name: "Disposition a Line" }).click();
  const dispDialog1 = page.getByRole("dialog").last();
  await dispDialog1
    .getByLabel("Line")
    .selectOption({ label: `${productName} (${sku}) — remaining 2` });
  await dispDialog1.getByLabel("Disposition").selectOption("RESTOCK");
  await dispDialog1.getByLabel("Quantity").fill("1");
  await dispDialog1.getByRole("button", { name: "Save Disposition" }).click();
  await detail.getByRole("button", { name: "Disposition a Line" }).click();
  const dispDialog2 = page.getByRole("dialog").last();
  await dispDialog2
    .getByLabel("Line")
    .selectOption({ label: `${productName} (${sku}) — remaining 1` });
  await dispDialog2.getByLabel("Disposition").selectOption("QUARANTINE");
  await dispDialog2.getByLabel("Quantity").fill("1");
  await dispDialog2.getByRole("button", { name: "Save Disposition" }).click();

  // 5. Complete
  await detail.getByRole("button", { name: "Complete" }).click();
  await expect(detail.getByText("Completed", { exact: true })).toBeVisible();
  await detail.getByRole("button", { name: "Close", exact: true }).click();

  // 6. The quarantined unit shows up and can be released
  await open(page, "Quality", "Quarantine");
  const qRow = page.getByRole("row").filter({ hasText: productName });
  await qRow.getByRole("button", { name: "Review" }).click();
  await expect(page.getByText("Marked under review").first()).toBeVisible();
  await qRow.getByRole("button", { name: "Release" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Release" })
    .click();
  await expect(page.getByText("Stock released").first()).toBeVisible();
});

test("runs an inventory QC inspection through completion", async ({
  page,
  request,
}) => {
  const token = await apiToken(request);
  const stamp = Date.now();
  const productName = uniqueName("E2E QC Widget");
  const sku = `QC-${stamp}`;
  const whName = uniqueName("E2E QC WH");

  const product = await create<{ id: number }>(
    request,
    token,
    "/scm/products",
    { productCode: sku, name: productName },
  );
  const wh = await create<{ id: number }>(request, token, "/scm/warehouses", {
    code: `Q${stamp % 100000}`,
    name: whName,
  });
  await create(request, token, "/scm/inventory/opening-balance", {
    productId: product.id,
    warehouseId: wh.id,
    quantity: 8,
  });

  await signInAsAdmin(page);

  await open(page, "Quality", "Inspections");
  await page.getByRole("button", { name: "New Inspection" }).click();
  const form = page.getByRole("dialog");
  await form.getByLabel(/^Inspection type/).selectOption("INVENTORY");
  await form.getByLabel(/^Warehouse/).selectOption({ label: whName });
  await form
    .getByLabel("Product")
    .selectOption({ label: `${productName} (${sku})` });
  await form.getByLabel("Quantity to inspect").fill("3");
  await form.getByRole("button", { name: "Create Inspection" }).click();
  await expect(page.getByText(/TW\/QC\/.* created/).first()).toBeVisible();

  const detail = page.getByRole("dialog");
  await detail.getByRole("button", { name: "Start" }).click();
  await expect(detail.getByText("In Progress")).toBeVisible();
  await detail.getByRole("button", { name: "Record" }).click();
  const record = page.getByRole("dialog").last();
  await record.getByLabel("Inspected quantity").fill("3");
  await record.getByLabel("Accepted quantity").fill("3");
  await record.getByLabel("Rejected quantity").fill("0");
  await record.getByRole("button", { name: "Save Result" }).click();
  await detail.getByRole("button", { name: "Complete" }).click();
  await expect(detail.getByText("Completed", { exact: true })).toBeVisible();
  await expect(detail.getByText("Passed", { exact: true })).toBeVisible();
});
