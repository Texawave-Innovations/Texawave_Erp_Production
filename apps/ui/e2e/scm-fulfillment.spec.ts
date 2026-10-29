import { expect, test, type APIRequestContext } from "@playwright/test";
import { openScmCategory, signInAsAdmin, uniqueName } from "./helpers/auth";
import { selectCombobox } from "./helpers/combobox";

/**
 * Real-browser walk through order fulfillment and logistics: fulfillment ->
 * reserve -> pick list -> pick -> pack -> issue stock -> shipment -> carrier
 * -> label -> dispatch -> deliver. Masters and the confirmed sales order are
 * created through the API so the test focuses on the fulfillment screens.
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

/** The scm_master_list_items table is org-configurable — a fixed value like
 * "STANDARD" isn't guaranteed to exist, so this test seeds it itself instead
 * of assuming it's there (same guard every SCM consumer form now goes
 * through — see MasterListValueGuard). */
async function ensureMasterListValue(
  request: APIRequestContext,
  token: string,
  category: string,
  value: string,
) {
  const res = await request.get(
    `${API}/scm/master-list-items?category=${category}&limit=100`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const existing = ((await res.json()) as { data: { value: string }[] }).data;
  if (existing.some((i) => i.value === value)) return;
  await create(request, token, "/scm/master-list-items", { category, value });
}

test("fulfils a sales order and ships it to delivery", async ({
  page,
  request,
}) => {
  const token = await apiToken(request);
  const stamp = Date.now();
  const customerName = uniqueName("E2E Customer");
  const productName = uniqueName("E2E Widget");
  const sku = `FF-${stamp}`;
  const whName = uniqueName("E2E WH");
  const carrierName = uniqueName("E2E Carrier");

  const customer = await create<{ id: number }>(
    request,
    token,
    "/scm/customers",
    { name: customerName, shippingAddress: "7 Dock Road" },
  );
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
    code: `F${stamp % 100000}`,
    name: whName,
  });
  await create(request, token, "/scm/inventory/opening-balance", {
    productId: product.id,
    warehouseId: wh.id,
    quantity: 20,
  });
  await ensureMasterListValue(
    request,
    token,
    "shipment_service_type",
    "STANDARD",
  );
  await create(request, token, "/scm/carriers", {
    carrierCode: `C${stamp % 1000000}`,
    carrierName,
    serviceTypes: ["STANDARD"],
  });
  const so = await create<{ id: number; soNumber: string }>(
    request,
    token,
    "/scm/sales-orders",
    {
      customerId: customer.id,
      orderDate: new Date().toISOString().slice(0, 10),
      items: [{ productId: product.id, quantity: 5, unitPrice: 40 }],
    },
  );
  await create(request, token, `/scm/sales-orders/${so.id}/confirm`, {});

  await signInAsAdmin(page);

  // 1. Fulfillment: create, reserve, pick list
  await openScmCategory(page, "Orders", "Fulfillment");
  await page.getByRole("button", { name: "New Fulfillment" }).click();
  const dialog = page.getByRole("dialog");
  await selectCombobox(
    dialog,
    /^Sales order/,
    `${so.soNumber} — ${customerName}`,
  );
  await selectCombobox(dialog, /^Fulfilling warehouse/, whName);
  await dialog.getByRole("button", { name: "Create Fulfillment" }).click();
  await expect(page.getByText(/TW\/FUL\/.* created/).first()).toBeVisible();

  const row = () => page.getByRole("row").filter({ hasText: so.soNumber });
  await row().getByRole("button", { name: "Reserve" }).click();
  await expect(page.getByText("Stock reserved").first()).toBeVisible();
  await row().getByRole("button", { name: "Create Pick List" }).click();
  await expect(page.getByText("Pick list created").first()).toBeVisible();

  // 2. Picking: start, record the full quantity
  await openScmCategory(page, "Inventory", "Picking");
  await row().getByRole("button", { name: "Start" }).click();
  await expect(page.getByText("Picking started").first()).toBeVisible();
  await row().getByRole("button", { name: "Record Pick" }).click();
  const pick = page.getByRole("dialog");
  await pick.getByLabel(`Picked quantity for ${productName}`).fill("5");
  await pick.getByRole("button", { name: "Save Progress" }).click();
  await expect(page.getByText("Pick recorded").first()).toBeVisible();
  await expect(row()).toContainText("Completed");

  // 3. Packing
  await openScmCategory(page, "Inventory", "Packing");
  await page
    .getByRole("button", { name: /^TW\/PICK\// })
    .first()
    .click();
  await page.getByRole("button", { name: "Complete Packing" }).click();
  await expect(page.getByText("Packing completed").first()).toBeVisible();
  await expect(row()).toContainText("Packed");

  // 4. Issue stock
  await openScmCategory(page, "Orders", "Fulfillment");
  await row().getByRole("button", { name: "Issue Stock" }).click();
  await expect(
    page.getByText("Stock issued — fulfilled").first(),
  ).toBeVisible();
  await expect(row()).toContainText("Fulfilled");

  // 5. Logistics: shipment from the Deliveries page
  await openScmCategory(page, "Logistics", "Deliveries");
  await page
    .getByRole("row")
    .filter({ hasText: so.soNumber })
    .getByRole("button", { name: "Create Shipment" })
    .click();
  await expect(page.getByText(/TW\/SHIP\/.* created/).first()).toBeVisible();

  await openScmCategory(page, "Logistics", "Shipments");
  await row().click();
  const ship = page.getByRole("dialog");
  await ship.getByRole("button", { name: "Assign Carrier" }).click();
  const assign = page.getByRole("dialog").last();
  await selectCombobox(assign, /^Carrier/, carrierName);
  // ShipmentsView renders service-type options via formatStatusLabel, so the
  // seeded "STANDARD" value displays as "Standard".
  await selectCombobox(assign, /^Service type/, "Standard");
  await assign.getByRole("button", { name: "Assign", exact: true }).click();
  await expect(
    page.getByText("Carrier assigned", { exact: true }).first(),
  ).toBeVisible();

  await page.getByRole("button", { name: "Create Label" }).click();
  await page
    .getByRole("dialog")
    .last()
    .getByLabel(/^Tracking number/)
    .fill(`TRK${stamp}`);
  await page.getByRole("button", { name: "Create Label" }).last().click();
  await expect(
    page.getByText("Label created", { exact: true }).first(),
  ).toBeVisible();

  await page.getByRole("button", { name: "Dispatch" }).click();
  await expect(
    page.getByText("Shipment dispatched", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByRole("dialog").first()).toContainText("Dispatched");
});
