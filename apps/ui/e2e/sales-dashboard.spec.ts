import { expect, test } from "@playwright/test";
import {
  apiError,
  page1,
  signInWithMockedApi,
  type MockRequest,
} from "./helpers/mock-api";

// The Sales dashboard reads one aggregate endpoint plus the checklist, so
// these specs mock the API: deterministic figures, every permission case,
// and a failure. The figures' formulas are proven by the API e2e suites.

const MANAGER = [
  "sales.dashboard.read",
  "sales.customer.read",
  "sales.customer.write",
  "sales.action_item.read",
  "sales.action_item.write",
];

const SALES_MENU = [
  { code: "sales-dashboard", label: "Dashboard", path: "/sales/dashboard" },
  { code: "sales-customers", label: "Customers", path: "/sales/customers" },
];

const DASHBOARD = {
  year: 2026,
  availability: {
    customers: true,
    action_items: true,
    quotations: true,
    invoices: true,
    payments: true,
    credit_notes: false,
    returnable_dcs: false,
  },
  kpis: {
    monthlyRevenue: "124500.00",
    outstandingDues: "14770.80",
    totalQuotations: 12,
    quotationsThisMonth: 3,
    invoicesIssued: 8,
    invoicesThisMonth: 2,
    activeCustomers: 5,
    totalCustomers: 6,
    paymentsCollected: "3708.00",
    paymentsCount: 3,
    creditNotes: 0,
  },
  pipeline: {
    quotations: { count: 12, pending: 2, value: "300000.00" },
    invoices: { count: 8, unpaid: 1, value: "200000.00" },
    payments: { count: 3, value: "3708.00" },
    quotationToInvoicePercent: 66.7,
    invoiceToPaymentPercent: 37.5,
    conversionPercent: 50,
    stuckAtInvoicing: "14770.80",
  },
  monthlyRevenueVsCollections: Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    revenue: i === 9 ? "124500.00" : "0.00",
    collections: i === 9 ? "3708.00" : "0.00",
  })),
  quotationConversion: {
    winRatePercent: 50,
    won: 6,
    totalQuotations: 12,
    pendingCustomerSignOff: 2,
    billedInvoices: 8,
    paymentsSettled: 3,
  },
  receivables: {
    collected: "3708.00",
    outstanding: "14770.80",
    collectedPercent: 20.1,
    aging: [
      { bucket: "0-30", amount: "14770.80", count: 1 },
      { bucket: "31-60", amount: "0.00", count: 0 },
      { bucket: "61-90", amount: "0.00", count: 0 },
      { bucket: "90+", amount: "0.00", count: 0 },
    ],
  },
  topClients: [
    {
      rank: 1,
      customerId: 7,
      companyName: "Global Enterprises Pvt Ltd",
      revenue: "124500.00",
      sharePercent: 100,
    },
  ],
  needsAttention: [
    {
      kind: "unpaid_invoices",
      priority: "high",
      count: 1,
      amount: "14770.80",
    },
  ],
  recentActivity: [
    {
      documentType: "TAX_INVOICE",
      documentNumber: "TW/IN/26-27/0001",
      status: "PARTIALLY_PAID",
      customerName: "Global Enterprises Pvt Ltd",
      amount: "17770.80",
      date: "2026-10-15",
    },
  ],
  checklist: { open: 1, overdue: 0 },
};

const ITEM = {
  id: 1,
  title: "Call Global Enterprises about PO",
  dueDate: "2020-01-01",
  isDone: false,
  completedAt: null,
  createdAt: "2026-10-01T00:00:00.000Z",
};

function handler(req: MockRequest) {
  if (req.method === "GET" && req.pathname === "/sales/dashboard") {
    return { body: { data: DASHBOARD } };
  }
  if (req.method === "GET" && req.pathname === "/sales/action-items") {
    return { body: page1([ITEM]) };
  }
  if (req.method === "POST" && req.pathname === "/sales/action-items") {
    return {
      status: 201,
      body: { data: { ...ITEM, id: 2, ...(req.body as object) } },
    };
  }
  if (
    req.method === "POST" &&
    req.pathname === "/sales/action-items/1/complete"
  ) {
    return { body: { data: { ...ITEM, isDone: true } } };
  }
  return undefined;
}

test.describe("Sales dashboard", () => {
  test("a Sales user lands on the dashboard and sees live figures", async ({
    page,
  }) => {
    await signInWithMockedApi(page, {
      permissions: MANAGER,
      workspace: "sales",
      menu: SALES_MENU,
      handler,
    });

    await expect(
      page.getByRole("heading", { name: "Sales dashboard" }),
    ).toBeVisible();
    await page
      .getByRole("navigation", { name: "Main application navigation" })
      .getByRole("button", { name: "Sales" })
      .click();
    const menu = page.getByRole("menu", { name: "Sales categories" });
    await expect(menu.getByRole("link", { name: "Overview" })).toBeVisible();
    await expect(menu.getByRole("link", { name: "Customers" })).toBeVisible();
    await page.keyboard.press("Escape");

    await expect(page.getByText("₹1,24,500").first()).toBeVisible();
    await expect(page.getByText("1 unpaid invoice")).toBeVisible();
    await expect(page.getByText("TW/IN/26-27/0001")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "1. Global Enterprises Pvt Ltd" }),
    ).toHaveAttribute("href", "/sales/customers/7");

    // The chart's numbers are reachable without hovering.
    await expect(
      page.getByRole("button", { name: "Revenue, Oct 2026: ₹1,24,500.00" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Show table" }).click();
    await expect(
      page.getByRole("row", { name: /Oct 2026 ₹1,24,500.00 ₹3,708.00/ }),
    ).toBeVisible();
  });

  test("checklist: add and complete follow-ups; overdue ones are flagged", async ({
    page,
  }) => {
    const { calls } = await signInWithMockedApi(page, {
      permissions: MANAGER,
      workspace: "sales",
      menu: SALES_MENU,
      handler,
    });

    await expect(page.getByText(ITEM.title)).toBeVisible();
    await expect(page.getByText("Overdue", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Add" }).click();
    await expect(page.getByText("Enter a follow-up")).toBeVisible();

    await page.getByLabel("New follow-up").fill("Send revised quote");
    await page.getByRole("button", { name: "Add" }).click();
    await expect
      .poll(() => calls.some((c) => c.includes('"title":"Send revised quote"')))
      .toBe(true);

    await page
      .getByRole("button", { name: `Mark "${ITEM.title}" done` })
      .click();
    await expect
      .poll(() =>
        calls.some((c) => c.startsWith("POST /sales/action-items/1/complete")),
      )
      .toBe(true);
  });

  test("without checklist write access there is no add form", async ({
    page,
  }) => {
    await signInWithMockedApi(page, {
      permissions: ["sales.dashboard.read", "sales.action_item.read"],
      workspace: "sales",
      menu: SALES_MENU.slice(0, 1),
      handler,
    });
    await expect(page.getByText(ITEM.title)).toBeVisible();
    await expect(page.getByLabel("New follow-up")).toHaveCount(0);
    await page
      .getByRole("navigation", { name: "Main application navigation" })
      .getByRole("button", { name: "Sales" })
      .click();
    const menu = page.getByRole("menu", { name: "Sales categories" });
    await expect(menu.getByRole("link", { name: "Overview" })).toBeVisible();
    await expect(menu.getByRole("link", { name: "Customers" })).toHaveCount(0);
  });

  test("a failed load shows a retry", async ({ page }) => {
    let fail = true;
    await signInWithMockedApi(page, {
      permissions: MANAGER,
      workspace: "sales",
      menu: SALES_MENU,
      handler: (req) => {
        if (req.pathname === "/sales/dashboard" && fail) {
          return apiError(500, "INTERNAL_ERROR");
        }
        return handler(req);
      },
    });
    await expect(page.getByText("Something went wrong")).toBeVisible();
    fail = false;
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByText("1 unpaid invoice")).toBeVisible();
  });
});
