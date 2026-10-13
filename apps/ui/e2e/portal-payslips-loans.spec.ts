import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * The portal's "My Payslips" and "My Loans" tabs (menu codes portal-payslips
 * and portal-loans): an employee with only the self-service codes sees their
 * own payslips and loans without any HR payroll permission, and the screens
 * call only the self-service endpoints. An employee can also request a loan
 * (HR reviews it, then a final approver decides). The API is mocked; `calls` records
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
  "employee_self_service.loan.write",
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
  status: "PENDING_HR",
  reason: "Medical",
  createdAt: "2031-01-15T00:00:00.000Z",
  requestedVia: "SELF",
  hrReviewer: null,
  employee: ME,
  repayments: [],
  skipRequests: [],
  prepayments: [],
};

const page1 = (rows: unknown[]) => ({
  data: rows,
  meta: { page: 1, limit: 20, total: rows.length, totalPages: 1 },
});

async function signIntoPortal(
  page: Page,
): Promise<{ calls: string[]; posted: unknown[] }> {
  const calls: string[] = [];
  const posted: unknown[] = [];
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
    if (pathname === "/self-service/loans" && req.method() === "POST") {
      const body = req.postDataJSON() as { overrideReason?: string };
      posted.push(body);
      // Above the limit only with a reason (the API's LOAN_OVER_LIMIT).
      if (!body.overrideReason)
        return json(422, {
          statusCode: 422,
          error: "LOAN_OVER_LIMIT",
          message: "The principal exceeds the limit",
        });
      return json(201, {
        data: { ...LOAN, id: 62, loanNumber: "LOAN-000062" },
      });
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
  return { calls, posted };
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
  await expect(page.getByText("Awaiting HR review").first()).toBeVisible();
  await page.getByRole("button", { name: "View loan LOAN-000061" }).click();
  await expect(
    page
      .getByRole("list", { name: "Approval steps" })
      .getByText("By the employee", { exact: false }),
  ).toBeVisible();
  expect(calls.filter((c) => c.startsWith("/hr/"))).toEqual([]);
});

test("an employee requests a loan above the limit with a reason, never naming an employee", async ({
  page,
}) => {
  const { calls, posted } = await signIntoPortal(page);
  await portalNav(page).getByRole("link", { name: "My Loans" }).click();
  await page.getByRole("button", { name: "Request a loan" }).click();
  const dialog = page.getByRole("dialog", { name: "Request a loan" });
  await expect(dialog.getByText("HR reviews your request")).toBeVisible();
  await expect(dialog.getByLabel(/^Employee/)).toHaveCount(0);

  await dialog.getByLabel(/^Principal/).fill("200000");
  await dialog.getByLabel(/^Months/).fill("20");
  await dialog.getByLabel(/^EMI/).fill("10000");
  await dialog.getByLabel(/^Disbursed on/).fill("2031-02-01");
  await dialog.getByRole("button", { name: "Request loan" }).click();
  // Over the limit: the reason field appears.
  const override = dialog.getByLabel(/^Override reason/);
  await expect(override).toBeVisible();
  await override.fill("House repair after the flood");
  await dialog.getByRole("button", { name: "Request loan" }).click();
  await expect(
    page.getByText("Loan LOAN-000062 requested — HR will review it"),
  ).toBeVisible();

  expect(posted).toEqual([
    {
      principalAmount: 200000,
      emiAmount: 10000,
      emiMonths: 20,
      disbursedDate: "2031-02-01",
    },
    {
      principalAmount: 200000,
      emiAmount: 10000,
      emiMonths: 20,
      disbursedDate: "2031-02-01",
      overrideReason: "House repair after the flood",
    },
  ]);
  expect(calls.filter((c) => c.startsWith("/hr/"))).toEqual([]);
});
