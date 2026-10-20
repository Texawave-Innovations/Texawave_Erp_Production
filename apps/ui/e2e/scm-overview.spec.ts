import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { signInAsAdmin, uniqueName } from "./helpers/auth";

/**
 * Real-browser walk through the SCM Overview, Master Data search, Barcode
 * lookup, Control Tower, Replenishment and Assistant screens. A low-stock
 * product is created through the API so Control Tower and Replenishment
 * have something real to show.
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
  const moduleButton = page.getByRole("button", { name: "SCM", exact: true });
  const categoriesMenu = page.getByRole("menu", {
    name: "SCM categories",
  });
  // Reset any pinned/hovered flyout left from a previous open(): the module
  // click is a pin *toggle*, so start from a known-closed state.
  await page.mouse.move(0, 400);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  await moduleButton.click();
  await categoriesMenu.waitFor({ state: "visible" });
  const categoryButton = categoriesMenu.getByRole("button", {
    name: category,
    exact: true,
  });
  await categoryButton.waitFor({ state: "visible" });
  await page.waitForTimeout(300);
  await categoryButton.click();
  await page
    .getByRole("menu", { name: `${category} items` })
    .getByRole("link", { name: link, exact: true })
    .click();
}

test("walks the Overview, Master Data, Barcode, Control Tower, Replenishment and Assistant screens", async ({
  page,
  request,
}) => {
  const token = await apiToken(request);
  const stamp = Date.now();
  const productName = uniqueName("E2E Overview Widget");
  const sku = `OV-${stamp}`;
  const whName = uniqueName("E2E Overview WH");

  const wh = await create<{ id: number }>(request, token, "/scm/warehouses", {
    code: `V${stamp % 100000}`,
    name: whName,
  });
  const product = await create<{ id: number }>(
    request,
    token,
    "/scm/products",
    { productCode: sku, name: productName, reorderLevel: 10, maximumStock: 50 },
  );
  await create(request, token, "/scm/inventory/opening-balance", {
    productId: product.id,
    warehouseId: wh.id,
    quantity: 4,
  });

  await signInAsAdmin(page);

  // 1. Overview
  await open(page, "Overview", "Overview");
  await expect(
    page.getByRole("heading", { name: "SCM Overview" }),
  ).toBeVisible();

  // 2. Master Data search
  await open(page, "Overview", "Master Data");
  await page.getByLabel("Search master data").fill(productName);
  await expect(page.getByText(sku)).toBeVisible();

  // 3. Barcode lookup
  await open(page, "Overview", "Barcode & Scanning");
  await page.getByLabel("Code").fill(sku);
  await page.getByRole("button", { name: "Find" }).click();
  await expect(page).toHaveURL(/\/scm\/products/);

  // 4. Control Tower shows the low-stock exception
  await open(page, "Advanced SCM", "Control Tower");
  await expect(page.getByText(new RegExp(productName))).toBeVisible();

  // 5. Replenishment recommends a reorder quantity
  await open(page, "Advanced SCM", "Replenishment");
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: productName })
      .filter({ hasText: "46" }),
  ).toBeVisible();

  // 6. Assistant answers a canned question
  await open(page, "Advanced SCM", "Assistant");
  await page.getByRole("button", { name: "What's low on stock?" }).click();
  // The answer lists only the top 5 rows, and earlier runs leave other
  // low-stock products behind, so assert on the answer, not this product.
  await expect(page.getByText(/need replenishment/)).toBeVisible();
});
