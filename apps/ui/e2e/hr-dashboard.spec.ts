import { expect, test, type Page, type Route } from "@playwright/test";

// The HR dashboard is read-only and fans out to many HR endpoints, so these specs
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
          permissions,
        },
      });
    }
    if (url.pathname === "/menu/my-menu") {
      return json(200, {
        data: [
          {
            id: 1,
            label: "HR",
            path: "/hr/dashboard",
            icon: null,
            children: [],
          },
        ],
      });
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
  await page.getByLabel("Password").fill("not-checked-by-mock");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/reference\/tags/);
}

async function openDashboardFromSidebar(page: Page) {
  await page.getByRole("navigation").getByRole("link", { name: "HR" }).click();
  await expect(page).toHaveURL(/\/hr\/dashboard/);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /Good (morning|afternoon|evening)/,
    }),
  ).toBeVisible();
}

const HR_PERMS = [
  "hr.employee.read",
  "hr.attendance_report.read",
  "hr.leave_request.read",
  "hr.attendance_correction.read",
  "hr.ticket.read",
  "hr.expense_claim.read",
  "hr.interview.read",
  "hr.offer_letter.read",
  "hr.holiday.read",
];

test("renders live HR figures from the API and navigates from the sidebar", async ({
  page,
}) => {
  await signIn(page, { permissions: HR_PERMS });
  await openDashboardFromSidebar(page);

  const present = page.locator('section[aria-labelledby="kpi-present"]');
  await expect(
    present.getByText("Present today", { exact: true }),
  ).toBeVisible();
  await expect(present.locator("p").first()).toHaveText("2");

  const approvals = page.locator('section[aria-labelledby="kpi-approvals"]');
  await expect(approvals.locator("p").first()).toHaveText("3");
  await expect(approvals).toContainText("2 leave · 1 attendance corrections");

  await expect(
    page.locator('section[aria-labelledby="kpi-total"]').locator("p").first(),
  ).toHaveText("4");
  await expect(
    page.locator('section[aria-labelledby="kpi-tickets"]').locator("p").first(),
  ).toHaveText("3");
  await expect(
    page
      .locator('section[aria-labelledby="kpi-expenses"]')
      .locator("p")
      .first(),
  ).toHaveText("3");

  const pipeline = page.locator(
    'section[aria-labelledby="hr-pipeline-heading"]',
  );
  await expect(pipeline).toContainText("Not tracked");
  await expect(
    pipeline.getByRole("list", { name: "Recruitment pipeline stages" }),
  ).toBeVisible();

  // Legacy "Absent" table is kept for screen readers; the donut itself is labelled.
  await expect(
    page.getByRole("img", {
      name: /Attendance today: 2 present, 1 absent, 1 on leave/,
    }),
  ).toBeVisible();

  const glance = page.locator('section[aria-labelledby="hr-glance-heading"]');
  await expect(glance).toContainText("Dina Shah");
  await expect(glance).toContainText("Founders Day");
  await expect(glance).toContainText("Asha Rao");
  await expect(glance).toContainText("Birthdays are not shown");
});

test("shows an error state, never a zero, when an endpoint fails", async ({
  page,
}) => {
  await signIn(page, { permissions: HR_PERMS, failPath: "/hr/tickets" });
  await openDashboardFromSidebar(page);

  const tickets = page.locator('section[aria-labelledby="kpi-tickets"]');
  await expect(tickets).toHaveCount(0);
  await expect(
    page.getByText("open tickets could not be loaded"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Try again" }).first(),
  ).toBeVisible();

  // Other widgets keep working when one endpoint fails.
  await expect(
    page.locator('section[aria-labelledby="kpi-present"]').locator("p").first(),
  ).toHaveText("2");
});

test("hides sections the user has no permission to read", async ({ page }) => {
  await signIn(page, { permissions: ["hr.ticket.read"] });
  await openDashboardFromSidebar(page);

  await expect(
    page.locator('section[aria-labelledby="kpi-tickets"]'),
  ).toBeVisible();
  await expect(
    page.locator('section[aria-labelledby="kpi-present"]'),
  ).toHaveCount(0);
  await expect(
    page.locator('section[aria-labelledby="hr-attendance-heading"]'),
  ).toHaveCount(0);
  await expect(
    page.locator('section[aria-labelledby="hr-pipeline-heading"]'),
  ).toHaveCount(0);
  // Activity needs both ticket and expense read, so it stays hidden for a partial grant.
  await expect(
    page.locator('section[aria-labelledby="hr-activity-heading"]'),
  ).toHaveCount(0);
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
  await openDashboardFromSidebar(page);
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(150);
    expect(
      await horizontalOverflow(page),
      `overflow at ${viewport.width}px`,
    ).toBeLessThanOrEqual(0);
  }
});

test("mobile drawer: sidebar is hidden until opened, then navigates and closes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await signIn(page, { permissions: HR_PERMS });

  const sidebar = page.locator("#app-sidebar");
  const toggle = page.getByRole("button", { name: "Open navigation" });
  await expect(toggle).toBeVisible();
  await expect(sidebar).toBeHidden();

  await toggle.click();
  await expect(sidebar).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Close navigation" }).first(),
  ).toBeVisible();

  await sidebar.getByRole("link", { name: "HR" }).click();
  await expect(page).toHaveURL(/\/hr\/dashboard/);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /Good (morning|afternoon|evening)/,
    }),
  ).toBeVisible();
  await expect(sidebar).toBeHidden();
});

test("mobile drawer closes on Escape and when the overlay is tapped", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await signIn(page, { permissions: HR_PERMS });
  const sidebar = page.locator("#app-sidebar");

  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(sidebar).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sidebar).toBeHidden();

  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(sidebar).toBeVisible();
  await page
    .locator("button.fixed.inset-0")
    .click({ position: { x: 360, y: 400 } });
  await expect(sidebar).toBeHidden();
});

test("desktop keeps the sidebar visible with no drawer toggle", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, { permissions: HR_PERMS });
  await openDashboardFromSidebar(page);
  await expect(page.locator("#app-sidebar")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Open navigation" }),
  ).toBeHidden();
});

test("content is capped on very wide screens instead of stretching", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await signIn(page, { permissions: HR_PERMS });
  await openDashboardFromSidebar(page);
  const width = await page
    .locator('[aria-label="HR dashboard"]')
    .evaluate((el) => el.getBoundingClientRect().width);
  expect(width).toBeLessThanOrEqual(1280);
});
