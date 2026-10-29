import { expect, test } from "@playwright/test";
import {
  page1,
  signInWithMockedApi,
  type MockRequest,
} from "./helpers/mock-api";

// Admin → Roles groups the Sales permissions into Sales · Customers,
// Documents, Collections and Setup (not "Other"), against a mocked API.
// Grouping: apps/ui/src/features/settings/roles/utils/access-model.ts.

const SALES_CODES = [
  "sales.dashboard.read",
  "sales.customer.read",
  "sales.customer.write",
  "sales.customer_bank.reveal",
  "sales.action_item.read",
  "sales.quotation.read",
  "sales.quotation.send",
  "sales.invoice.read",
  "sales.delivery_challan.read",
  "sales.returnable_dc.read",
  "sales.returnable_dc.delete",
  "sales.payment.read",
  "sales.invoice_payment.write",
  "sales.master.read",
  "sales.master.write",
  "sales.running_number.write",
];
const CATALOG = [
  { id: 1, code: "settings.role.read", description: "View roles" },
  { id: 2, code: "settings.role.write", description: "Edit roles" },
  ...SALES_CODES.map((code, i) => ({ id: 100 + i, code, description: code })),
];
const ROLE = {
  id: 9,
  organizationId: 1,
  name: "Sales Manager",
  description: null,
  isSystem: false,
  version: 1,
  isActive: true,
  createdBy: null,
  updatedBy: null,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
};

function answer(req: MockRequest) {
  const { method, pathname } = req;
  if (method === "GET" && pathname === "/settings/roles") {
    return {
      body: page1([{ ...ROLE, permissionCount: 1, userCount: 0 }]),
    };
  }
  if (method === "GET" && pathname === "/settings/roles/9") {
    return {
      body: {
        data: {
          ...ROLE,
          permissions: [CATALOG[2]],
          userCount: 0,
          lastChangedBy: null,
        },
      },
    };
  }
  if (method === "GET" && pathname === "/settings/permissions") {
    return { body: { data: CATALOG } };
  }
  return undefined;
}

test("the role editor groups Sales permissions by area", async ({ page }) => {
  await signInWithMockedApi(page, {
    permissions: ["settings.role.read", "settings.role.write"],
    workspace: "hr",
    menu: [{ code: "admin-roles", label: "Roles", path: "/admin/roles" }],
    handler: answer,
  });
  await page
    .getByRole("navigation", { name: "Main application navigation" })
    .getByRole("button", { name: "Settings" })
    .click();
  const menu = page.getByRole("menu", { name: "Settings categories" });
  await menu.getByRole("button", { name: "Access Control" }).click();
  await menu.getByRole("link", { name: "Roles" }).click();
  await page.getByText("Sales Manager").first().click();

  const section = (label: string) =>
    page.getByRole("button", { name: new RegExp(`^${label}`) });
  for (const label of [
    "Sales · Customers",
    "Sales · Documents",
    "Sales · Collections",
    "Sales · Setup",
  ]) {
    await expect(section(label)).toBeVisible();
  }
  // Nothing Sales is left ungrouped.
  await expect(section("Other")).toHaveCount(0);

  for (const resource of [
    "Customer bank details",
    "Follow-up checklist",
    "Quotations",
    "Returnable DCs",
    "Payments received",
    "Record payments",
    "Master list",
    "Running numbers",
  ]) {
    await expect(page.getByText(resource, { exact: true })).toBeVisible();
  }
  await expect(
    page.getByRole("switch", { name: "Quotations: Send" }),
  ).toBeVisible();
  await expect(
    page.getByRole("switch", { name: "Returnable DCs: Delete" }),
  ).toBeVisible();
});
