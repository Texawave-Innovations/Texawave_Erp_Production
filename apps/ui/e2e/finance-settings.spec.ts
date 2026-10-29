import { expect, type Page, test } from "@playwright/test";
import {
  type MockAnswer,
  type MockRequest,
  page1,
  signInWithMockedApi,
} from "./helpers/mock-api";

/**
 * Finance Master screen (Docs/FINANCE_MASTER_LIST.md): the Masters tab bar
 * renders with Finance Master active, both category cards (Expense Types /
 * Payment Modes) render their seeded chips, add+delete on the Expense Types
 * card round-trips through the mocked API, and a reader without write
 * permission sees no add form. API fully mocked — the backend's own rules
 * are proven by apps/api/test/finance-settings.e2e-spec.ts.
 */

let expenseTypes = [
  {
    id: 1,
    organizationId: 1,
    category: "expense_type",
    value: "Travel",
    numericValue: null,
    customFields: {},
    createdBy: 1,
    updatedBy: 1,
    createdAt: "2026-10-01T10:00:00.000Z",
    updatedAt: "2026-10-01T10:00:00.000Z",
    deletedAt: null,
  },
];

const PAYMENT_MODES = [
  {
    id: 2,
    organizationId: 1,
    category: "payment_mode",
    value: "Bank Transfer",
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

  // Session restore on page reload
  if (pathname === "/auth/refresh" && method === "POST") {
    const token = `${Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url")}.${Buffer.from(JSON.stringify({ organizationId: 1, sub: 1 })).toString("base64url")}.sig`;
    return {
      body: {
        data: {
          accessToken: token,
          refreshToken: "r",
        },
      },
    };
  }

  // Global unread notifications count query from Navbar
  if (pathname === "/notifications/unread-count" && method === "GET") {
    return { body: { data: { count: 0 } } };
  }

  if (pathname === "/finance-settings/master-list-items" && method === "GET") {
    const category = search.get("category");
    if (category === "expense_type") return { body: page1(expenseTypes) };
    if (category === "payment_mode") return { body: page1(PAYMENT_MODES) };
    return { body: page1([]) };
  }

  if (pathname === "/finance-settings/master-list-items" && method === "POST") {
    const input = body as { category: string; value: string };
    const created = {
      id: 3,
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
    if (input.category === "expense_type") {
      expenseTypes = [...expenseTypes, created];
    }
    return { status: 201, body: { data: created } };
  }

  if (
    pathname.startsWith("/finance-settings/master-list-items/") &&
    method === "DELETE"
  ) {
    const id = Number(pathname.split("/")[3]);
    expenseTypes = expenseTypes.filter((item) => item.id !== id);
    return { status: 204, body: {} };
  }

  return undefined;
}

const READ = ["finance_settings.master_list_item.read"];
const WRITE = ["finance_settings.master_list_item.write"];

async function openFinanceMaster(page: Page, extraPermissions: string[] = []) {
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
  await page.goto("/settings/masters/finance");
  return session;
}

test("shows the Masters tab bar with Finance Master active", async ({
  page,
}) => {
  await openFinanceMaster(page);

  await expect(
    page.getByRole("link", { name: "Finance Master" }),
  ).toBeVisible();
});

test("renders both Finance Master cards with their seeded chips", async ({
  page,
}) => {
  await openFinanceMaster(page);

  await expect(
    page.getByRole("heading", { name: "Expense Types" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Payment Modes" }),
  ).toBeVisible();

  await expect(page.getByText("Travel")).toBeVisible();
  await expect(page.getByText("Bank Transfer")).toBeVisible();
});

test("adds and deletes an expense type chip", async ({ page }) => {
  const { calls } = await openFinanceMaster(page, WRITE);

  await page.getByLabel("New Expense Types value").fill("Lodging");
  await page.getByLabel("New Expense Types value").press("Enter");

  await expect(page.getByText("Lodging")).toBeVisible();
  expect(
    calls.some(
      (c) =>
        c.startsWith("POST /finance-settings/master-list-items") &&
        c.includes("Lodging"),
    ),
  ).toBe(true);

  await page.getByRole("button", { name: "Remove Travel" }).click();
  await expect(page.getByText("Travel")).toHaveCount(0);
});

test("a reader without the write permission sees no add form", async ({
  page,
}) => {
  await openFinanceMaster(page);

  await expect(page.getByLabel("New Expense Types value")).toHaveCount(0);
  await expect(page.getByLabel("New Payment Modes value")).toHaveCount(0);
});
