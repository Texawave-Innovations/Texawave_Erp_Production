import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * The portal's "My Payslips" and "My Loans" tabs (menu codes portal-payslips
 * and portal-loans): an employee with only the self-service codes sees their
 * own payslips and loans without any HR payroll permission, and the screens
 * call only the self-service endpoints. The API is mocked; `calls` records
 * every API path the page requests. Scope (own rows only) is proven by
 * apps/api test/payroll.e2e-spec.ts and payroll-statutory.e2e-spec.ts.
 */
const API = "http://localhost:3000";

function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "none", typ: "JWT" })}.${b64(payload)}.sig`;
}

const PERMS = [
  "employee_self_service.profile.read",
  "employee_self_service.payslip.read",
  "employee_self_service.loan.read",
];

const ME = {
  id: 7,
  employeeCode: "EMP-000007",
  fullName: "Karthi",
  userId: 1,
  teamId: 3,
};

const PAYSLIP = {
  id: 11,
  payrollPeriodId: 905,
  payrollEntryId: 4011,
  employeeId: ME.id,
  payslipNumber: "PS-203106-000011",
  netPayable: "48200",
  status: "GENERATED",
  version: 1,
  generatedAt: "2031-07-01T10:00:00.000Z",
  employee: {
    ...ME,
    designation: { id: 1, name: "Engineer" },
    department: { id: 2, name: "Software" },
    team: { id: 3, name: "Platform" },
    bankDetails: null,
    pfProfile: null,
    esiProfile: null,
  },
  payrollPeriod: {
    id: 905,
    year: 2031,
    month: 6,
    periodStart: "2031-06-01",
    periodEnd: "2031-06-30",
    status: "FINALIZED",
  },
  payrollEntry: {
    payableDays: "30",
    lopDays: "0",
    totalGrossEarnings: "50000",
    totalDeductions: "1800",
    netPayable: "48200",
    earnings: [
      {
        code: "BASIC",
        name: "Basic",
        baseAmount: "30000",
        calculatedAmount: "30000",
      },
    ],
    deductions: [
      { code: "PF", name: "Provident Fund", amount: "1800", sourceType: "PF" },
    ],
  },
};

const LOAN = {
  id: 61,
  employeeId: ME.id,
  loanNumber: "LOAN-000061",
  principalAmount: "3000",
  emiAmount: "1000",
  emiMonths: 3,
  disbursedDate: "2031-01-15T00:00:00.000Z",
  status: "PENDING_APPROVAL",
  reason: "Medical",
  createdAt: "2031-01-15T00:00:00.000Z",
  employee: ME,
  repayments: [],
  skipRequests: [],
  prepayments: [],
};

const page1 = (rows: unknown[]) => ({
  data: rows,
  meta: { page: 1, limit: 20, total: rows.length, totalPages: 1 },
});

async function signIntoPortal(page: Page): Promise<{ calls: string[] }> {
  const calls: string[] = [];
  await page.route(`${API}/**`, async (route: Route) => {
    const req = route.request();
    const { pathname } = new URL(req.url());
    calls.push(pathname);
    const json = (status: number, body: unknown) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    if (pathname === "/auth/login") {
      return json(200, {
        data: {
          accessToken: jwt({ organizationId: 1, sub: 1 }),
          refreshToken: "r",
        },
      });
    }
    if (pathname === "/auth/me") {
      return json(200, {
        data: {
          userId: 1,
          organizationId: 1,
          email: "karthi@texawave.test",
          fullName: "Karthi",
          roleIds: [1],
          permissions: PERMS,
        },
      });
    }
    if (pathname === "/employee/profile") {
      return json(200, { data: { ...ME, onboardingStatus: "COMPLETE" } });
    }
    if (pathname === "/menu/my-menu") {
      const item = (id: number, label: string, path: string) => ({
        id,
        code: `portal-${id}`,
        label,
        path,
        icon: null,
        order: id,
        parentId: 1,
        permission: null,
        children: [],
      });
      return json(200, {
        data: [
          {
            ...item(1, "My Portal", ""),
            code: "portal",
            path: null,
            parentId: null,
            children: [
              item(13, "My Payslips", "/portal/payslips"),
              item(14, "My Loans", "/portal/loans"),
            ],
          },
        ],
      });
    }
    if (pathname === "/self-service/payslips") {
      return json(200, page1([PAYSLIP]));
    }
    if (pathname === "/self-service/loans") return json(200, page1([LOAN]));
    return json(404, {
      statusCode: 404,
      message: "Not mocked",
      error: "Not Found",
      path: pathname,
    });
  });

  await page.goto("/login");
  await page.getByLabel("Organization").fill("texawave-innovations");
  await page.getByLabel("Email").fill("karthi@texawave.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("not-checked-by-mock");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/portal$/);
  return { calls };
}

const portalNav = (page: Page) =>
  page.getByRole("navigation", { name: "My Portal Navigation" });

test("an employee opens their own payslips from the portal, through self-service only", async ({
  page,
}) => {
  const { calls } = await signIntoPortal(page);
  await portalNav(page).getByRole("link", { name: "My Payslips" }).click();
  await expect(page).toHaveURL(/\/portal\/payslips$/);
  await expect(
    page.getByRole("heading", { name: "My payslips" }),
  ).toBeVisible();
  await expect(page.getByText("PS-203106-000011")).toBeVisible();
  // Never the HR payroll endpoints.
  expect(calls.filter((c) => c.startsWith("/hr/"))).toEqual([]);
});

test("an employee sees their loan awaiting approval in the portal", async ({
  page,
}) => {
  const { calls } = await signIntoPortal(page);
  await portalNav(page).getByRole("link", { name: "My Loans" }).click();
  await expect(page).toHaveURL(/\/portal\/loans$/);
  await expect(page.getByRole("heading", { name: "My loans" })).toBeVisible();
  await expect(page.getByText("LOAN-000061")).toBeVisible();
  await expect(page.getByText("Awaiting approval").first()).toBeVisible();
  expect(calls.filter((c) => c.startsWith("/hr/"))).toEqual([]);
});
