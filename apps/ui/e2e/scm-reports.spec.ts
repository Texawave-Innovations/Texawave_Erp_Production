import { expect, test, type APIRequestContext } from "@playwright/test";
import { signInAsAdmin, uniqueName } from "./helpers/auth";

/**
 * Real-browser walk through the Reports dashboard and the per-domain report
 * pages, checking a procurement row reflects a purchase order created
 * through the API and that the CSV export button appears once there is
 * data.
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

test("shows the reports dashboard and a procurement report row with a CSV export", async ({
  page,
  request,
}) => {
  const token = await apiToken(request);
  const stamp = Date.now();
  const supplierName = uniqueName("E2E Report Supplier");
  const productName = uniqueName("E2E Report Widget");
  const sku = `REP-${stamp}`;
  const whName = uniqueName("E2E Report WH");

  const supplier = await create<{ id: number }>(
    request,
    token,
    "/scm/suppliers",
    {
      companyName: supplierName,
      contactPerson: "A",
    },
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
    code: `R${stamp % 100000}`,
    name: whName,
  });
  const po = await create<{ id: number }>(
    request,
    token,
    "/scm/procurement/purchase-orders",
    {
      supplierId: supplier.id,
      poDate: new Date().toISOString().slice(0, 10),
      warehouseId: wh.id,
      items: [{ productId: product.id, quantity: 4, unitPrice: 25 }],
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

  await signInAsAdmin(page);

  await page.getByRole("button", { name: "SCM", exact: true }).click();
  await page
    .getByRole("menu", { name: "SCM categories" })
    .getByRole("button", { name: "Reports", exact: true })
    .click();
  const reportsMenu = page.getByRole("menu", { name: "Reports items" });
  await reportsMenu
    .getByRole("link", { name: "Overview", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();

  await page.getByRole("link", { name: "Open Purchase Orders" }).click();
  await expect(
    page.getByRole("heading", { name: "Procurement Report" }),
  ).toBeVisible();
  await expect(
    page.getByRole("row").filter({ hasText: supplierName }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Download CSV" }),
  ).toBeVisible();
});
