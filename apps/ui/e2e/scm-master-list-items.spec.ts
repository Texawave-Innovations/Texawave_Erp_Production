import { expect, type Page, test } from "@playwright/test";
import {
  type MockAnswer,
  type MockRequest,
  navigateToMasterTab,
  page1,
  signInWithMockedApi,
} from "./helpers/mock-api";

/**
 * SCM Master screen: the Masters tab bar renders with SCM Master active,
 * all 4 category cards (Supplier Types, Package Types, Warehouse Types,
 * Stock Adjustment Reasons) render their seeded chips, add+delete on the
 * Supplier Types card round-trips through the mocked API, and a reader
 * without write permission sees no add form. API fully mocked — the
 * backend's own rules are proven by
 * apps/api/test/scm-master-list-items.e2e-spec.ts.
 */

let supplierTypes = [
  {
    id: 1,
    organizationId: 1,
    category: "supplier_type",
    value: "Manufacturer",
    numericValue: null,
    customFields: {},
    createdBy: 1,
    updatedBy: 1,
    createdAt: "2026-10-01T10:00:00.000Z",
    updatedAt: "2026-10-01T10:00:00.000Z",
    deletedAt: null,
  },
];

const PACKAGE_TYPES = [
  {
    id: 2,
    organizationId: 1,
    category: "package_type",
    value: "Box",
    numericValue: null,
    customFields: {},
    createdBy: 1,
    updatedBy: 1,
    createdAt: "2026-10-01T10:00:00.000Z",
    updatedAt: "2026-10-01T10:00:00.000Z",
    deletedAt: null,
  },
];

const WAREHOUSE_TYPES = [
  {
    id: 3,
    organizationId: 1,
    category: "warehouse_type",
    value: "Main",
    numericValue: null,
    customFields: {},
    createdBy: 1,
    updatedBy: 1,
    createdAt: "2026-10-01T10:00:00.000Z",
    updatedAt: "2026-10-01T10:00:00.000Z",
    deletedAt: null,
  },
];

const STOCK_ADJUSTMENT_REASONS = [
  {
    id: 4,
    organizationId: 1,
    category: "stock_adjustment_reason",
    value: "Damage",
    numericValue: null,
    customFields: {},
    createdBy: 1,
    updatedBy: 1,
    createdAt: "2026-10-01T10:00:00.000Z",
    updatedAt: "2026-10-01T10:00:00.000Z",
    deletedAt: null,
  },
];

function handler(req: MockRequest): MockAnswer | undefined {
  const { method, pathname, search, body } = req;

  if (pathname === "/scm/master-list-items" && method === "GET") {
    const category = search.get("category");
    if (category === "supplier_type") return { body: page1(supplierTypes) };
    if (category === "package_type") return { body: page1(PACKAGE_TYPES) };
    if (category === "warehouse_type") return { body: page1(WAREHOUSE_TYPES) };
    if (category === "stock_adjustment_reason")
      return { body: page1(STOCK_ADJUSTMENT_REASONS) };
    return { body: page1([]) };
  }

  if (pathname === "/scm/master-list-items" && method === "POST") {
    const input = body as { category: string; value: string };
    const created = {
      id: 5,
      organizationId: 1,
      category: input.category,
      value: input.value,
      numericValue: null,
      customFields: {},
      createdBy: 1,
      updatedBy: 1,
      createdAt: "2026-10-01T10:00:00.000Z",
      updatedAt: "2026-10-01T10:00:00.000Z",
      deletedAt: null,
    };
    if (input.category === "supplier_type") {
      supplierTypes = [...supplierTypes, created];
    }
    return { status: 201, body: { data: created } };
  }

  if (pathname.startsWith("/scm/master-list-items/") && method === "DELETE") {
    const id = Number(pathname.split("/")[3]);
    supplierTypes = supplierTypes.filter((item) => item.id !== id);
    return { status: 204, body: {} };
  }

  return undefined;
}

const READ = ["scm.master_list_item.read"];
const WRITE = ["scm.master_list_item.write"];

async function openScmMaster(page: Page, extraPermissions: string[] = []) {
  const session = await signInWithMockedApi(page, {
    workspace: "hr",
    permissions: ["hr.workspace.access", ...READ, ...extraPermissions],
    menu: [
      {
        code: "sales-settings",
        label: "Sales Settings",
        path: "/settings/sales-settings",
      },
    ],
    handler,
  });
  await navigateToMasterTab(page, "SCM Master");
  return session;
}

test("shows the Masters tab bar with SCM Master active", async ({ page }) => {
  await openScmMaster(page);

  await expect(page.getByRole("link", { name: "SCM Master" })).toBeVisible();
});

test("renders all 4 SCM Master cards with their seeded chips", async ({
  page,
}) => {
  await openScmMaster(page);

  await expect(
    page.getByRole("heading", { name: "Supplier Types" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Package Types" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Warehouse Types" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Stock Adjustment Reasons" }),
  ).toBeVisible();

  await expect(page.getByText("Manufacturer")).toBeVisible();
  await expect(page.getByText("Box")).toBeVisible();
  await expect(page.getByText("Main")).toBeVisible();
  await expect(page.getByText("Damage")).toBeVisible();
});

test("adds and deletes a supplier type chip", async ({ page }) => {
  const { calls } = await openScmMaster(page, WRITE);

  await page.getByLabel("New Supplier Types value").fill("Distributor");
  await page.getByLabel("New Supplier Types value").press("Enter");

  await expect(page.getByText("Distributor")).toBeVisible();
  expect(
    calls.some(
      (c) =>
        c.startsWith("POST /scm/master-list-items") &&
        c.includes("Distributor"),
    ),
  ).toBe(true);

  await page.getByRole("button", { name: "Remove Manufacturer" }).click();
  await expect(page.getByText("Manufacturer")).toHaveCount(0);
});

test("a reader without the write permission sees no add form", async ({
  page,
}) => {
  await openScmMaster(page);

  await expect(page.getByLabel("New Supplier Types value")).toHaveCount(0);
  await expect(page.getByLabel("New Package Types value")).toHaveCount(0);
  await expect(page.getByLabel("New Warehouse Types value")).toHaveCount(0);
  await expect(
    page.getByLabel("New Stock Adjustment Reasons value"),
  ).toHaveCount(0);
});
