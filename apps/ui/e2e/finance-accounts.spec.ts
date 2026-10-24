import { expect, type Page, test } from "@playwright/test";
import {
  type MockAnswer,
  type MockRequest,
  page1,
  signInWithMockedApi,
} from "./helpers/mock-api";

interface MockAccountItem {
  id: number;
  organizationId: number;
  accountCode: string;
  accountName: string;
  accountType: string;
  parentAccountId: number | null;
  currency: string;
  currentBalance: number;
  isActive: boolean;
  isReconciled: boolean;
  description: string | null;
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  parentAccount: {
    id: number;
    accountCode: string;
    accountName: string;
  } | null;
}

let mockAccounts: MockAccountItem[] = [
  {
    id: 1,
    organizationId: 1,
    accountCode: "1000",
    accountName: "Current Assets",
    accountType: "ASSET",
    parentAccountId: null,
    currency: "INR",
    currentBalance: 50000,
    isActive: true,
    isReconciled: false,
    description: "All short term liquid resources",
    createdBy: 1,
    updatedBy: 1,
    createdAt: "2026-10-01T10:00:00.000Z",
    updatedAt: "2026-10-01T10:00:00.000Z",
    deletedAt: null,
    parentAccount: null,
  },
  {
    id: 2,
    organizationId: 1,
    accountCode: "1010",
    accountName: "Cash on Hand",
    accountType: "ASSET",
    parentAccountId: 1,
    currency: "INR",
    currentBalance: 15000,
    isActive: true,
    isReconciled: false,
    description: "Office petty cash fund",
    createdBy: 1,
    updatedBy: 1,
    createdAt: "2026-10-01T10:00:00.000Z",
    updatedAt: "2026-10-01T10:00:00.000Z",
    deletedAt: null,
    parentAccount: {
      id: 1,
      accountCode: "1000",
      accountName: "Current Assets",
    },
  },
  {
    id: 3,
    organizationId: 1,
    accountCode: "4010",
    accountName: "Sales Revenue",
    accountType: "REVENUE",
    parentAccountId: null,
    currency: "INR",
    currentBalance: 250000,
    isActive: true,
    isReconciled: false,
    description: "Operating commercial sales revenue",
    createdBy: 1,
    updatedBy: 1,
    createdAt: "2026-10-01T10:00:00.000Z",
    updatedAt: "2026-10-01T10:00:00.000Z",
    deletedAt: null,
    parentAccount: null,
  },
];

const mockTree = [
  {
    id: 1,
    organizationId: 1,
    accountCode: "1000",
    accountName: "Current Assets",
    accountType: "ASSET",
    parentAccountId: null,
    currency: "INR",
    currentBalance: 50000,
    isActive: true,
    isReconciled: false,
    description: "All short term liquid resources",
    createdBy: 1,
    updatedBy: 1,
    createdAt: "2026-10-01T10:00:00.000Z",
    updatedAt: "2026-10-01T10:00:00.000Z",
    deletedAt: null,
    children: [
      {
        id: 2,
        organizationId: 1,
        accountCode: "1010",
        accountName: "Cash on Hand",
        accountType: "ASSET",
        parentAccountId: 1,
        currency: "INR",
        currentBalance: 15000,
        isActive: true,
        isReconciled: false,
        description: "Office petty cash fund",
        createdBy: 1,
        updatedBy: 1,
        createdAt: "2026-10-01T10:00:00.000Z",
        updatedAt: "2026-10-01T10:00:00.000Z",
        deletedAt: null,
        children: [],
      },
    ],
  },
  {
    id: 3,
    organizationId: 1,
    accountCode: "4010",
    accountName: "Sales Revenue",
    accountType: "REVENUE",
    parentAccountId: null,
    currency: "INR",
    currentBalance: 250000,
    isActive: true,
    isReconciled: false,
    description: "Operating commercial sales revenue",
    createdBy: 1,
    updatedBy: 1,
    createdAt: "2026-10-01T10:00:00.000Z",
    updatedAt: "2026-10-01T10:00:00.000Z",
    deletedAt: null,
    children: [],
  },
];

function handler(req: MockRequest): MockAnswer | undefined {
  const { method, pathname, search, body } = req;

  if (pathname === "/finance/accounts/tree" && method === "GET") {
    return { body: { data: mockTree } };
  }

  if (pathname === "/finance/accounts" && method === "GET") {
    const searchVal = search.get("search")?.toLowerCase();
    const typeVal = search.get("accountType");

    let filtered = [...mockAccounts];
    if (searchVal) {
      filtered = filtered.filter(
        (a) =>
          a.accountCode.toLowerCase().includes(searchVal) ||
          a.accountName.toLowerCase().includes(searchVal),
      );
    }
    if (typeVal) {
      filtered = filtered.filter((a) => a.accountType === typeVal);
    }
    return { body: page1(filtered) };
  }

  if (pathname === "/finance/accounts" && method === "POST") {
    const input = body as {
      accountCode: string;
      accountName: string;
      accountType: string;
      parentAccountId?: number | null;
      currency?: string;
      description?: string | null;
    };
    const created = {
      id: 4,
      organizationId: 1,
      accountCode: input.accountCode,
      accountName: input.accountName,
      accountType: input.accountType,
      parentAccountId: input.parentAccountId ?? null,
      currency: input.currency || "INR",
      currentBalance: 0,
      isActive: true,
      isReconciled: false,
      description: input.description ?? null,
      createdBy: 1,
      updatedBy: 1,
      createdAt: "2026-10-23T10:00:00.000Z",
      updatedAt: "2026-10-23T10:00:00.000Z",
      deletedAt: null,
      parentAccount: null,
    };
    mockAccounts = [...mockAccounts, created];
    return { status: 201, body: { data: created } };
  }

  if (pathname.startsWith("/finance/accounts/") && method === "PATCH") {
    const id = Number(pathname.split("/")[3]);
    const input = body as Partial<{
      accountCode: string;
      accountName: string;
      isActive: boolean;
    }>;
    mockAccounts = mockAccounts.map((a) =>
      a.id === id ? { ...a, ...input } : a,
    );
    const updated = mockAccounts.find((a) => a.id === id);
    return { body: { data: updated } };
  }

  if (pathname.startsWith("/finance/accounts/") && method === "DELETE") {
    const id = Number(pathname.split("/")[3]);
    mockAccounts = mockAccounts.map((a) =>
      a.id === id ? { ...a, isActive: false } : a,
    );
    return { status: 204, body: {} };
  }

  return undefined;
}

const READ = ["finance.coa.read"];
const WRITE = ["finance.coa.write"];

async function openFinanceAccounts(
  page: Page,
  extraPermissions: string[] = [],
) {
  const session = await signInWithMockedApi(page, {
    workspace: "hr",
    permissions: ["hr.workspace.access", ...READ, ...extraPermissions],
    menu: [
      {
        code: "finance-accounts",
        label: "Chart of Accounts",
        path: "/finance/accounts",
      },
    ],
    handler,
  });
  await page.goto("/finance/accounts");
  return session;
}

test.describe("Chart of Accounts UI", () => {
  test("renders Chart of Accounts table view with accounts and balances", async ({
    page,
  }) => {
    await openFinanceAccounts(page, WRITE);

    await expect(
      page.getByRole("heading", { name: "Chart of Accounts" }),
    ).toBeVisible();
    await expect(page.getByText("Current Assets")).toBeVisible();
    await expect(page.getByText("1000")).toBeVisible();
    await expect(page.getByText("Cash on Hand")).toBeVisible();
    await expect(page.getByText("Sales Revenue")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Add Account" }),
    ).toBeVisible();
  });

  test("toggles to Hierarchy Tree view", async ({ page }) => {
    await openFinanceAccounts(page, WRITE);

    const treeButton = page.getByRole("button", { name: "Hierarchy Tree" });
    await treeButton.click();

    await expect(page.getByText("Account Hierarchy & Balances")).toBeVisible();
    await expect(page.getByText("1000")).toBeVisible();
    await expect(page.getByText("Current Assets")).toBeVisible();
    await expect(page.getByText("Expand All")).toBeVisible();
    await expect(page.getByText("Collapse All")).toBeVisible();
  });

  test("hides Add Account button when user has read-only permission", async ({
    page,
  }) => {
    // Open without WRITE permission
    await openFinanceAccounts(page, []);

    await expect(
      page.getByRole("heading", { name: "Chart of Accounts" }),
    ).toBeVisible();
    await expect(page.getByText("Current Assets")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Add Account" }),
    ).not.toBeVisible();
  });

  test("renders unified Finance Hub shell with 6 primary tabs and accounting sub-tabs", async ({
    page,
  }) => {
    await openFinanceAccounts(page, WRITE);

    // Global Hub Header
    await expect(page.getByRole("heading", { name: "Finance" })).toBeVisible();
    await expect(
      page.getByText(
        "Unified Financial Hub — Expenses, Banking, GST & General Ledger Accounting",
      ),
    ).toBeVisible();

    // 6 Primary Navigation Tabs
    const primaryNav = page.getByRole("navigation", {
      name: "Finance primary navigation",
    });
    await expect(primaryNav.getByText("Expenses")).toBeVisible();
    await expect(primaryNav.getByText("Payments Received")).toBeVisible();
    await expect(primaryNav.getByText("Payments Made")).toBeVisible();
    await expect(primaryNav.getByText("Banking")).toBeVisible();
    await expect(primaryNav.getByText("Accounting")).toBeVisible();
    await expect(primaryNav.getByText("GST")).toBeVisible();

    // Contextual Sub-Navigation for Accounting
    const subNav = page.getByRole("navigation", {
      name: "accounting sub-navigation",
    });
    await expect(
      subNav.getByRole("link", { name: "Chart of Accounts" }),
    ).toBeVisible();
    await expect(
      subNav.getByRole("link", { name: "Journal Entries" }),
    ).toBeVisible();
    await expect(
      subNav.getByRole("link", { name: "General Ledger" }),
    ).toBeVisible();
    await expect(subNav.getByText("Reports")).toBeVisible();
  });
});
