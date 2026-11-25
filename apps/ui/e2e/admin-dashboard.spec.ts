import { expect, test, type Page, type Route } from "@playwright/test";

// The admin dashboard is read-only and fans out to many module endpoints, so these specs
// mock the API at the network layer. That keeps each permission and failure case
// deterministic without seeding a database. Auth still goes through the real login form.

const API = "http://localhost:3000";

function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "none", typ: "JWT" })}.${b64(payload)}.sig`;
}

function istToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function shiftDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const TODAY = istToday();
const MM_DD = TODAY.slice(5);

const employees = [
  {
    id: 1,
    employeeCode: "E001",
    fullName: "Asha Rao",
    status: "ACTIVE",
    dateOfJoining: `2019-${MM_DD}`,
  },
  {
    id: 2,
    employeeCode: "E002",
    fullName: "Ben Carter",
    status: "ACTIVE",
    dateOfJoining: "2024-01-15",
  },
  {
    id: 3,
    employeeCode: "E003",
    fullName: "Chen Wei",
    status: "ACTIVE",
    dateOfJoining: "2023-06-01",
  },
  {
    id: 4,
    employeeCode: "E004",
    fullName: "Dina Shah",
    status: "INACTIVE",
    dateOfJoining: "2020-02-02",
  },
];

function dailyRows(date: string) {
  if (date !== TODAY) {
    return [
      {
        employeeId: 1,
        status: "ABSENT",
        attendanceDate: date,
        employee: { id: 1, employeeCode: "E001", fullName: "Asha Rao" },
      },
      {
        employeeId: 2,
        status: "ABSENT",
        attendanceDate: date,
        employee: { id: 2, employeeCode: "E002", fullName: "Ben Carter" },
      },
      {
        employeeId: 3,
        status: "PRESENT",
        attendanceDate: date,
        employee: { id: 3, employeeCode: "E003", fullName: "Chen Wei" },
      },
    ];
  }
  return [
    {
      employeeId: 1,
      status: "PRESENT",
      attendanceDate: date,
      employee: { id: 1, employeeCode: "E001", fullName: "Asha Rao" },
    },
    {
      employeeId: 2,
      status: "PRESENT",
      attendanceDate: date,
      employee: { id: 2, employeeCode: "E002", fullName: "Ben Carter" },
    },
    {
      employeeId: 3,
      status: "ABSENT",
      attendanceDate: date,
      employee: { id: 3, employeeCode: "E003", fullName: "Chen Wei" },
    },
    {
      employeeId: 4,
      status: "ON_LEAVE",
      attendanceDate: date,
      employee: { id: 4, employeeCode: "E004", fullName: "Dina Shah" },
    },
    {
      employeeId: 5,
      status: "NOT_MARKED",
      attendanceDate: date,
      employee: { id: 5, employeeCode: "E005", fullName: "Eli Park" },
    },
  ];
}

const leaveRows = [
  {
    id: 1,
    leaveType: { id: 1, code: "CL", name: "Casual" },
    status: "APPROVED",
    employee: { id: 4, employeeCode: "E004", fullName: "Dina Shah" },
    startDate: TODAY,
    endDate: TODAY,
  },
  {
    id: 2,
    leaveType: { id: 1, code: "CL", name: "Casual" },
    status: "PENDING",
    employee: { id: 1, employeeCode: "E001", fullName: "Asha Rao" },
    startDate: TODAY,
    endDate: TODAY,
  },
  {
    id: 3,
    leaveType: { id: 2, code: "SL", name: "Sick" },
    status: "APPROVED",
    employee: { id: 2, employeeCode: "E002", fullName: "Ben Carter" },
    startDate: TODAY,
    endDate: TODAY,
  },
];

const tickets = [
  {
    id: 11,
    subject: "Payslip query",
    category: "PAYROLL",
    status: "OPEN",
    employee: { id: 2, fullName: "Ben Carter" },
    createdAt: new Date().toISOString(),
  },
];

const expenses = [
  {
    id: 21,
    expenseType: "TRAVEL",
    amount: 1250,
    description: "Client visit",
    status: "PENDING",
    employee: { id: 3, fullName: "Chen Wei" },
    createdAt: new Date().toISOString(),
  },
];

const holidays = [
  {
    id: 31,
    holidayDate: shiftDays(TODAY, 2),
    name: "Founders Day",
    isActive: true,
  },
];

const scmOverview = {
  metrics: {
    activeSuppliers: 9,
    openRequisitions: 4,
    openInspections: 1,
    openPurchaseOrders: 5,
    unitsAvailable: 1200,
    stockRows: 40,
    inventoryValue: 250000,
    costedRows: 38,
    lowStockItems: 7,
    openSalesOrders: 3,
    posAwaitingReceipt: 2,
    openShipments: 2,
  },
  stages: [
    { stage: "Suppliers", count: 9, path: "/scm/suppliers" },
    { stage: "Products", count: 30, path: "/scm/products" },
    { stage: "Requisitions", count: 4, path: "/scm/procurement/requisitions" },
    {
      stage: "Purchase Orders",
      count: 5,
      path: "/scm/procurement/purchase-orders",
    },
    {
      stage: "Goods Receipts",
      count: 0,
      path: "/scm/procurement/goods-receipts",
    },
    { stage: "Sales Orders", count: 3, path: "/scm/sales/orders" },
  ],
};

const salesDashboard = {
  year: Number(TODAY.slice(0, 4)),
  availability: {},
  kpis: {
    monthlyRevenue: "150000.00",
    outstandingDues: "42000.00",
    totalQuotations: 6,
    quotationsThisMonth: 2,
    invoicesIssued: 10,
    invoicesThisMonth: 3,
    activeCustomers: 8,
    totalCustomers: 12,
    paymentsCollected: "90000.00",
    paymentsCount: 5,
    creditNotes: 0,
  },
  pipeline: {
    quotations: { count: 6, pending: 2, value: "0" },
    invoices: { count: 10, unpaid: 4, value: "0" },
    payments: { count: 5, value: "0" },
    quotationToInvoicePercent: 0,
    invoiceToPaymentPercent: 0,
    conversionPercent: 0,
    stuckAtInvoicing: "0",
  },
  monthlyRevenueVsCollections: Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    revenue: String((i + 1) * 1000),
    collections: "0",
  })),
  quotationConversion: {
    winRatePercent: 0,
    won: 0,
    totalQuotations: 0,
    pendingCustomerSignOff: 0,
    billedInvoices: 0,
    paymentsSettled: 0,
  },
  receivables: {
    collected: "90000",
    outstanding: "42000",
    collectedPercent: 68,
    aging: [],
  },
  topClients: [
    {
      rank: 1,
      customerId: 7,
      companyName: "Acme Corp",
      revenue: "90000",
      sharePercent: 60,
    },
  ],
  needsAttention: [
    {
      kind: "overdue_invoices",
      priority: "critical",
      count: 4,
      amount: "42000",
    },
  ],
  recentActivity: [],
  checklist: { open: 0, overdue: 0 },
};

function pageOf<T>(rows: T[], total: number, url: URL) {
  const limit = Number(url.searchParams.get("limit") ?? "20");
  const page = Number(url.searchParams.get("page") ?? "1");
  const data = rows.slice((page - 1) * limit, page * limit);
  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

function fixtureFor(url: URL): { status: number; body: unknown } {
  const path = url.pathname;
  const status = url.searchParams.get("status");
  const q = url.searchParams;

  if (path === "/hr/employees") {
    return status === "ACTIVE"
      ? { status: 200, body: pageOf([], 3, url) }
      : { status: 200, body: pageOf(employees, employees.length, url) };
  }
  if (path === "/hr/attendance/reports/daily") {
    const date = q.get("date") ?? TODAY;
    const rows = dailyRows(date);
    return { status: 200, body: pageOf(rows, rows.length, url) };
  }
  if (path === "/hr/leave-requests") {
    if (status === "PENDING") return { status: 200, body: pageOf([], 2, url) };
    return { status: 200, body: pageOf(leaveRows, leaveRows.length, url) };
  }
  if (path === "/hr/attendance/corrections")
    return { status: 200, body: pageOf([], 1, url) };
  if (path === "/hr/tickets") {
    if (status === "OPEN") return { status: 200, body: pageOf([], 2, url) };
    if (status === "IN_PROGRESS")
      return { status: 200, body: pageOf([], 1, url) };
    return { status: 200, body: pageOf(tickets, tickets.length, url) };
  }
  if (path === "/hr/expense-claims") {
    if (status === "PENDING") return { status: 200, body: pageOf([], 3, url) };
    return { status: 200, body: pageOf(expenses, expenses.length, url) };
  }
  if (path === "/hr/interviews") {
    const totals: Record<string, number> = {
      SCHEDULED: 4,
      COMPLETED: 3,
      SELECTED: 2,
    };
    return { status: 200, body: pageOf([], totals[status ?? ""] ?? 0, url) };
  }
  if (path === "/hr/offer-letters")
    return { status: 200, body: pageOf([], 1, url) };
  if (path === "/hr/holidays")
    return { status: 200, body: pageOf(holidays, holidays.length, url) };
  if (path === "/scm/overview")
    return { status: 200, body: { data: scmOverview } };
  if (path === "/scm/advanced/control-tower") {
    return {
      status: 200,
      body: {
        data: [
          {
            severity: "HIGH",
            type: "LOW_STOCK",
            title: "Stock below reorder level",
            detail: "7 items need replenishment",
            path: "/scm/advanced",
          },
        ],
      },
    };
  }
  if (path === "/scm/advanced/replenishment") {
    return {
      status: 200,
      body: {
        data: [
          {
            productId: 1,
            productCode: "CW-01",
            productName: "Copper wire",
            warehouseId: 1,
            warehouse: "Main",
            available: 3,
            reorderLevel: 10,
            target: 30,
            recommendedQty: 27,
            estimatedCost: 5400,
          },
        ],
      },
    };
  }
  if (path === "/scm/overview/movement-trend") {
    const days = Number(q.get("days") ?? "7");
    return {
      status: 200,
      body: {
        data: Array.from({ length: days }, (_, i) => ({
          date: shiftDays(TODAY, i - days + 1),
          inbound: i * 2,
          outbound: i,
        })),
      },
    };
  }
  if (path === "/sales/dashboard")
    return { status: 200, body: { data: salesDashboard } };
  return {
    status: 404,
    body: { statusCode: 404, message: "Not mocked", error: "Not Found", path },
  };
}

interface Options {
  permissions: string[];
  failPath?: string;
}

/** Signs in through the real login form, with the API mocked behind it. */
async function signIn(page: Page, { permissions, failPath }: Options) {
  await page.route(`${API}/**`, async (route: Route) => {
    const url = new URL(route.request().url());
    const json = (status: number, body: unknown) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });

    if (url.pathname === "/auth/login") {
      return json(200, {
        data: {
          accessToken: jwt({ organizationId: 1, sub: 1 }),
          refreshToken: "r",
        },
      });
    }
    if (url.pathname === "/auth/me") {
      return json(200, {
        data: {
          userId: 1,
          organizationId: 1,
          email: "hr@texawave.test",
          fullName: "Priya Nair",
          roleIds: [1],
          // The HR workspace shell itself; the widgets gate on `permissions`.
          permissions: ["hr.workspace.access", ...permissions],
        },
      });
    }
    if (url.pathname === "/employee/profile") {
      // The shell holds every page until onboarding is known to be complete
      // (see hr-onboarding-redirect.spec.ts).
      return json(200, {
        data: {
          id: 1,
          employeeCode: "E001",
          fullName: "Priya Nair",
          onboardingStatus: "COMPLETE",
        },
      });
    }
    if (url.pathname === "/menu/my-menu") {
      // The navbar links only the codes this (permission-filtered) menu
      // returns — here, just the dashboard tab.
      const node = (id: number, code: string, path: string | null) => ({
        id,
        code,
        label: code,
        path,
        icon: null,
        order: id,
        parentId: null,
        permission: null,
        children: [] as unknown[],
      });
      const hr = node(1, "hr", null);
      hr.children.push(node(2, "hr-dashboard", "/hr/dashboard"));
      return json(200, { data: [hr] });
    }
    if (url.pathname === "/reference/tags") {
      return json(200, {
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 1 },
      });
    }
    if (failPath && url.pathname === failPath) {
      return json(500, {
        statusCode: 500,
        message: "boom",
        error: "Internal Server Error",
        path: url.pathname,
      });
    }
    const fixture = fixtureFor(url);
    return json(fixture.status, fixture.body);
  });

  await page.goto("/login");
  await page.getByLabel("Organization").fill("texawave-innovations");
  await page.getByLabel("Email").fill("hr@texawave.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("not-checked-by-mock");
  await page.getByRole("button", { name: "Sign in" }).click();
  // hr.workspace.access lands on the HR workspace (features/auth/landing.ts).
  await expect(page).toHaveURL(/\/hr$/);
}

async function openAdminDashboard(page: Page) {
  // The navbar's "Dashboard" module routes to /admin (HorizontalNavbar ERP_MODULES).
  await page
    .getByRole("navigation", { name: "Main application navigation" })
    .getByRole("button", { name: "Dashboard", exact: true })
    .click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Dashboard" }),
  ).toBeVisible();
}

// Real grants: scoped families are only ever granted as `.own`/`.team`/`.all`
// (never the bare code), which is what the widgets must recognise.
const HR_PERMS = [
  "hr.employee.read.all",
  "hr.attendance_report.read.all",
  "hr.leave_request.read.all",
  "hr.attendance_correction.read.all",
  "hr.holiday.read",
];

/** A KPI card is a link labelled by its own heading (`kpi-<id>`). */
function kpi(page: Page, id: string) {
  return page.locator(`a[aria-labelledby="kpi-${id}"]`);
}

test("renders live HR figures from the API on the admin dashboard", async ({
  page,
}) => {
  await signIn(page, { permissions: HR_PERMS });
  await openAdminDashboard(page);

  await expect(kpi(page, "employees")).toContainText("Total Employees");
  await expect(kpi(page, "employees")).toContainText("4");
  await expect(kpi(page, "present")).toContainText("2");
  await expect(kpi(page, "present")).toContainText("40% attendance rate");
  await expect(kpi(page, "leave")).toContainText("1 absent today");
  await expect(kpi(page, "approvals")).toContainText("3");
  await expect(kpi(page, "approvals")).toContainText(
    "2 leave · 1 regularization",
  );

  // Gauge: 2 of 5 workable rows present; holidays and weekly offs never count.
  await expect(
    page.getByRole("figure", { name: /^Attendance today: 40% Present/ }),
  ).toBeVisible();

  await expect(
    page.locator('section[aria-labelledby="admin-reminders-heading"]'),
  ).toContainText("Founders Day");

  const leaves = page.locator(
    'section[aria-labelledby="admin-people-heading"]',
  );
  await expect(leaves).toContainText("Leave Requests");
  await expect(leaves).toContainText("Asha Rao");
  await expect(leaves).toContainText("Pending");
  await expect(
    page.locator('section[aria-labelledby="admin-spotlight-heading"]'),
  ).toContainText("Live Clock");

  // No task grant: the list says so instead of rendering an empty or zeroed list.
  await expect(
    page.locator('section[aria-labelledby="admin-list-heading"]'),
  ).toContainText("You don't have access to open tasks.");
});

test("switches modules and swaps every module-scoped widget", async ({
  page,
}) => {
  await signIn(page, {
    permissions: [...HR_PERMS, "scm.overview.read", "sales.dashboard.read"],
  });
  await openAdminDashboard(page);

  const modules = page.getByRole("tablist", { name: "Dashboard modules" });
  await modules.getByRole("tab", { name: "SCM", exact: true }).click();
  await expect(kpi(page, "low-stock")).toContainText("7");
  await expect(
    page.getByRole("heading", { name: "Stock movement" }),
  ).toBeVisible();
  await expect(
    page.locator('section[aria-labelledby="admin-list-heading"]'),
  ).toContainText("Stock below reorder level");
  await expect(
    page.locator('section[aria-labelledby="admin-reminders-heading"]'),
  ).toContainText("Reorder Copper wire");
  await expect(
    page.locator('section[aria-labelledby="admin-spotlight-heading"]'),
  ).toContainText("Open sales orders to fulfil");
  // No logistics grant: the shipments card says so rather than showing HR data.
  await expect(
    page.locator('section[aria-labelledby="admin-people-heading"]'),
  ).toContainText("You don't have access to recent shipments.");

  await modules.getByRole("tab", { name: "Purchases", exact: true }).click();
  await expect(kpi(page, "pos")).toContainText("Open Purchase Orders");
  await expect(kpi(page, "awaiting")).toContainText("2");
  await expect(
    page.getByRole("figure", { name: /^Purchase order receipt: 40%/ }),
  ).toBeVisible();

  await modules.getByRole("tab", { name: "Sales", exact: true }).click();
  await expect(kpi(page, "customers")).toContainText("Of 12 customers");
  await expect(kpi(page, "revenue")).toContainText("₹1.5L");
  await expect(
    page.locator('section[aria-labelledby="admin-people-heading"]'),
  ).toContainText("Acme Corp");
  await expect(
    page.locator('section[aria-labelledby="admin-reminders-heading"]'),
  ).toContainText("4 overdue invoices");
  await expect(
    page.locator('section[aria-labelledby="admin-spotlight-heading"]'),
  ).toContainText("Collected in");

  // Modules without a grant are not offered at all.
  await expect(modules.getByRole("tab", { name: "Finance" })).toHaveCount(0);
});

test("shows an error state, never a zero, when an endpoint fails", async ({
  page,
}) => {
  await signIn(page, { permissions: HR_PERMS, failPath: "/hr/holidays" });
  await openAdminDashboard(page);

  await expect(
    page.getByText("hr reminders could not be loaded"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Try again" }).first(),
  ).toBeVisible();

  // Other widgets keep working when one endpoint fails.
  await expect(kpi(page, "present")).toContainText("2");
});

test("offers only the modules the user can read", async ({ page }) => {
  await signIn(page, { permissions: ["sales.dashboard.read"] });
  await openAdminDashboard(page);

  // A single module needs no switcher, and HR figures are never requested.
  await expect(
    page.getByRole("tablist", { name: "Dashboard modules" }),
  ).toHaveCount(0);
  await expect(kpi(page, "revenue")).toContainText("Monthly Revenue");
  await expect(kpi(page, "employees")).toHaveCount(0);
  await expect(
    page.locator('section[aria-labelledby="admin-people-heading"]'),
  ).toContainText("Top Clients");
  await expect(page.getByText("Leave Requests")).toHaveCount(0);
});

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
}

const VIEWPORTS = [
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 640, height: 800 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];

test("has no horizontal overflow at every target viewport", async ({
  page,
}) => {
  await signIn(page, { permissions: HR_PERMS });
  await openAdminDashboard(page);
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(150);
    expect(
      await horizontalOverflow(page),
      `overflow at ${viewport.width}px`,
    ).toBeLessThanOrEqual(0);
  }
});

test("content is capped on very wide screens instead of stretching", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await signIn(page, { permissions: HR_PERMS });
  await openAdminDashboard(page);
  const width = await page
    .locator('[aria-label="Admin dashboard"]')
    .evaluate((el) => el.getBoundingClientRect().width);
  expect(width).toBeLessThanOrEqual(1280);
});
