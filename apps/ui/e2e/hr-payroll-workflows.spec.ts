import { expect, type Page, test } from "@playwright/test";
import {
  type MockAnswer,
  type MockRequest,
  page1,
  signInWithMockedApi,
} from "./helpers/mock-api";

/**
 * The statutory-engine workflows in HR → Payroll (Docs/PAYROLL_AND_COMPLIANCE.md
 * §3.7, §3.9, §4.15, §4.16, §5.2): loan approval in two steps (HR review,
 * then a different final approver; over-limit needs .all), prepayments, reopening a finalized month, statutory files,
 * payslip regeneration, statutory bonus and gratuity. API fully mocked; the
 * rules are proven by apps/api test/payroll-statutory.e2e-spec.ts.
 */

const ME = 1;
const ASHA = {
  id: 501,
  employeeCode: "EMP-000501",
  fullName: "Asha Rao",
  userId: 9001,
};

function loan(overrides: Record<string, unknown> = {}) {
  return {
    id: 61,
    employeeId: ASHA.id,
    loanNumber: "LOAN-000061",
    principalAmount: "30000",
    emiAmount: "10000",
    emiMonths: 3,
    disbursedDate: "2026-10-01T00:00:00.000Z",
    status: "PENDING_ADMIN",
    reason: "Medical",
    createdAt: "2026-10-01T00:00:00.000Z",
    createdBy: ASHA.userId,
    requestedVia: "SELF",
    hrReviewer: { id: 78, fullName: "Hema Reviewer" },
    hrReviewedAt: "2026-10-01T00:00:00.000Z",
    hrReviewNote: "Documents checked",
    limitOverride: false,
    overrideReason: null,
    approver: null,
    employee: ASHA,
    repayments: [],
    skipRequests: [],
    prepayments: [],
    ...overrides,
  };
}

const ACTIVE_LOAN = loan({
  status: "ACTIVE",
  approver: { id: 77, fullName: "Checker" },
  approvedAt: "2026-10-02T00:00:00.000Z",
  repayments: [1, 2, 3].map((n) => ({
    id: 100 + n,
    installmentNo: n,
    dueDate: `2026-1${n - 1}-01T00:00:00.000Z`,
    amount: "10000",
    status: "PENDING",
    paidAt: null,
  })),
  prepayments: [
    {
      id: 41,
      amount: "5000",
      receivedOn: "2026-10-05",
      reference: "RCPT-9",
      reason: "Bonus money",
      status: "PENDING",
      requestedById: 77,
      decidedAt: null,
      requester: { id: 77, fullName: "Maker" },
      decider: null,
    },
  ],
});

const PERIOD = (status: string) => ({
  id: 905,
  year: 2026,
  month: 9,
  periodStart: "2026-09-01",
  periodEnd: "2026-09-30",
  status,
  finalizedAt: null,
  finalizedBy: null,
  reopenCount: 0,
  runs: [
    {
      id: 31,
      runNumber: 1,
      status: "APPROVED",
      startedAt: null,
      completedAt: null,
      approvedAt: null,
    },
  ],
  createdAt: "2026-09-01",
});

const RUN = {
  id: 31,
  payrollPeriodId: 905,
  runNumber: 1,
  status: "APPROVED",
  startedAt: null,
  completedAt: null,
  approvedAt: "2026-10-02T00:00:00.000Z",
  notes: null,
  payrollPeriod: { id: 905, year: 2026, month: 9, status: "FINALIZED" },
  runCreator: { id: 77, fullName: "Maker" },
  runApprover: { id: 78, fullName: "Checker" },
  _count: { entries: 1 },
};

const PAYSLIP = {
  id: 11,
  payrollPeriodId: 905,
  payrollEntryId: 4011,
  employeeId: ASHA.id,
  payslipNumber: "PS-202609-000011",
  netPayable: "48200",
  status: "GENERATED",
  version: 1,
  generatedAt: "2026-10-03T10:00:00.000Z",
  employee: {
    ...ASHA,
    designation: null,
    department: null,
    team: null,
    bankDetails: null,
    pfProfile: null,
    esiProfile: null,
  },
  payrollPeriod: {
    id: 905,
    year: 2026,
    month: 9,
    status: "FINALIZED",
    periodStart: "2026-09-01",
    periodEnd: "2026-09-30",
  },
  payrollEntry: {
    payableDays: "30",
    lopDays: "0",
    totalGrossEarnings: "50000",
    totalDeductions: "1800",
    netPayable: "48200",
    earnings: [],
    deductions: [],
  },
};

function makeHandler(state: {
  loan: Record<string, unknown>;
  periodStatus: string;
}) {
  return (req: MockRequest): MockAnswer | undefined => {
    const { method, pathname } = req;
    if (pathname === "/hr/loans" && method === "GET")
      return { body: page1([state.loan]) };
    if (pathname === "/hr/loans/61/review")
      return { body: { data: { ...state.loan, status: "PENDING_ADMIN" } } };
    if (pathname === "/hr/loans/61/decide")
      return { body: { data: { ...state.loan, status: "ACTIVE" } } };
    if (pathname === "/hr/loans/61/prepayments")
      return { status: 201, body: { data: { id: 42 } } };
    if (pathname === "/hr/loans/prepayments/41/decide")
      return { body: { data: state.loan } };
    if (
      pathname === "/self-service/loans" ||
      pathname === "/self-service/payslips"
    )
      return {
        status: 403,
        body: {
          statusCode: 403,
          error: "NOT_AN_EMPLOYEE",
          message: "no employee",
        },
      };
    if (pathname === "/hr/payroll/periods" && method === "GET")
      return { body: page1([PERIOD(state.periodStatus)]) };
    if (pathname === "/hr/payroll/runs") return { body: page1([RUN]) };
    if (pathname === "/hr/payroll/periods/905/reopen")
      return { body: { data: PERIOD("REOPENED") } };
    if (pathname === "/hr/payroll/periods/905/reports/journal")
      return { file: "Account,Debit,Credit\r\n", contentType: "text/csv" };
    if (pathname === "/hr/payslips" && method === "GET")
      return { body: page1([PAYSLIP]) };
    if (pathname === "/hr/payslips/11/regenerate")
      return { body: { data: { ...PAYSLIP, version: 2 } } };
    if (pathname === "/hr/bonuses" && method === "GET")
      return { body: page1([]) };
    if (pathname === "/hr/bonuses/statutory")
      return {
        body: {
          data: {
            financialYear: "2025-26",
            rules: {
              eligibilityLimit: 21000,
              calculationCeiling: 7000,
              percent: 8.33,
            },
            employees: [
              {
                employee: ASHA,
                monthlyBasicDa: 15000,
                alreadyRaised: false,
                eligible: true,
                reason: null,
                workedDays: 300,
                bonusWages: 84000,
                amount: 6997,
              },
            ],
            createdBonusIds: (req.body as { create?: boolean }).create
              ? [801]
              : [],
          },
        },
      };
    if (pathname === "/hr/bonuses/gratuity/501")
      return {
        body: {
          data: {
            employee: ASHA,
            asOf: "2026-10-13",
            eligible: true,
            reason: null,
            completedYears: 6,
            countedYears: 7,
            lastDrawnWage: 26000,
            amount: 105000,
          },
        },
      };
    if (pathname === "/hr/bonuses/gratuity")
      return { status: 201, body: { data: { id: 900 } } };
    if (pathname.startsWith("/hr/employees")) return { body: page1([ASHA]) };
    return undefined;
  };
}

async function open(
  page: Page,
  permissions: string[],
  state = { loan: loan(), periodStatus: "FINALIZED" },
) {
  const session = await signInWithMockedApi(page, {
    workspace: "hr",
    userId: ME,
    permissions: [
      "hr.workspace.access",
      "hr.employee.read.all",
      ...permissions,
    ],
    menu: [{ code: "hr-payroll", label: "Payroll", path: "/hr/payroll" }],
    handler: makeHandler(state),
  });
  await page.getByRole("link", { name: "Payroll", exact: true }).click();
  return session;
}

const bodiesOf = (calls: string[], prefix: string) =>
  calls
    .filter((c) => c.startsWith(prefix))
    .map((c) => JSON.parse(c.slice(c.indexOf("{"))) as Record<string, unknown>);

const APPROVER = [
  "hr.payroll.read.all",
  "hr.loan.read.all",
  "hr.loan.write.all",
  "hr.loan.approve.all",
];

test("HR forwards an employee's loan request for final approval; the approver cannot also review", async ({
  page,
}) => {
  const { calls } = await open(
    page,
    ["hr.payroll.read.all", "hr.loan.read.all", "hr.loan.review.all"],
    {
      loan: loan({
        status: "PENDING_HR",
        hrReviewer: null,
        hrReviewedAt: null,
        hrReviewNote: null,
      }),
      periodStatus: "FINALIZED",
    },
  );
  await page.getByRole("tab", { name: "Loans" }).click();
  // Reviewers land on what waits for them.
  await expect(page.getByLabel("Filter by loan status")).toHaveValue(
    "PENDING_HR",
  );
  await page.getByRole("button", { name: "View loan LOAN-000061" }).click();
  const dialog = page.getByRole("dialog", { name: "Loan LOAN-000061" });
  const steps = dialog.getByRole("list", { name: "Approval steps" });
  await expect(steps.getByText("By the employee")).toBeVisible();
  await expect(steps.getByText("HR review — in progress")).toBeAttached();
  await expect(
    dialog.getByRole("button", { name: "Approve loan" }),
  ).toHaveCount(0);

  await dialog.getByLabel("Note").fill("Salary slips verified");
  await dialog.getByRole("button", { name: "Forward for approval" }).click();
  await expect(
    page.getByText("Loan LOAN-000061 forwarded for final approval"),
  ).toBeVisible();
  expect(bodiesOf(calls, "POST /hr/loans/61/review")).toEqual([
    { decision: "FORWARD", note: "Salary slips verified" },
  ]);
  expect(calls.filter((c) => c.startsWith("POST /hr/loans/61/decide"))).toEqual(
    [],
  );
});

test("the HR reviewer never gives the final approval", async ({ page }) => {
  await open(page, APPROVER, {
    loan: loan({ hrReviewer: { id: ME, fullName: "Me" } }),
    periodStatus: "FINALIZED",
  });
  await page.getByRole("tab", { name: "Loans" }).click();
  await page.getByRole("button", { name: "View loan LOAN-000061" }).click();
  const dialog = page.getByRole("dialog", { name: "Loan LOAN-000061" });
  await expect(
    dialog.getByText(
      "You reviewed this loan — someone else must give the final approval",
    ),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Approve loan" }),
  ).toHaveCount(0);
});

test("approves a forwarded loan; rejecting needs a note", async ({ page }) => {
  const { calls } = await open(page, APPROVER);
  await page.getByRole("tab", { name: "Loans" }).click();
  await expect(page.getByLabel("Filter by loan status")).toHaveValue(
    "PENDING_ADMIN",
  );
  await page.getByRole("button", { name: "View loan LOAN-000061" }).click();
  const dialog = page.getByRole("dialog", { name: "Loan LOAN-000061" });
  await expect(dialog.getByText("No EMI schedule yet")).toBeVisible();
  await expect(
    dialog.getByText("Forwarded by Hema Reviewer", { exact: false }),
  ).toBeVisible();

  await dialog.getByRole("button", { name: "Reject" }).click();
  await dialog.getByRole("button", { name: "Confirm reject" }).click();
  await expect(dialog.getByText("Give a reason for rejecting")).toBeVisible();
  await dialog.getByRole("button", { name: "Back" }).click();

  await dialog.getByRole("button", { name: "Approve loan" }).click();
  await expect(
    page.getByText("Loan LOAN-000061 approved — EMI schedule created"),
  ).toBeVisible();
  expect(bodiesOf(calls, "POST /hr/loans/61/decide")).toEqual([
    { decision: "APPROVED" },
  ]);
});

test("an over-limit loan needs an organization-wide approver; the borrower never decides", async ({
  page,
}) => {
  await open(
    page,
    ["hr.payroll.read.team", "hr.loan.read.team", "hr.loan.approve.team"],
    {
      loan: loan({
        limitOverride: true,
        overrideReason: "Medical emergency, director approved",
      }),
      periodStatus: "FINALIZED",
    },
  );
  await page.getByRole("tab", { name: "Loans" }).click();
  await page.getByRole("button", { name: "View loan LOAN-000061" }).click();
  const dialog = page.getByRole("dialog", { name: "Loan LOAN-000061" });
  await expect(dialog.getByText("Above the loan limit")).toBeVisible();
  await expect(
    dialog.getByText("Needs an organization-wide approver"),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Approve loan" }),
  ).toHaveCount(0);
});

test("records a prepayment and approves another person's", async ({ page }) => {
  const { calls } = await open(page, APPROVER, {
    loan: ACTIVE_LOAN,
    periodStatus: "FINALIZED",
  });
  await page.getByRole("tab", { name: "Loans" }).click();
  await page.getByRole("button", { name: "View loan LOAN-000061" }).click();
  const dialog = page.getByRole("dialog", { name: "Loan LOAN-000061" });

  await dialog.getByRole("button", { name: "Record prepayment" }).click();
  const form = dialog.getByRole("form", { name: "Record a prepayment" });
  await form.getByLabel("Amount (₹)").fill("40000");
  await form.getByLabel("Received on").fill("2026-10-10");
  await form.getByLabel("Reason").fill("Sold a bike");
  await form.getByRole("button", { name: "Record prepayment" }).click();
  await expect(
    form.getByText("At most the outstanding ₹ 30,000.00"),
  ).toBeVisible();
  await form.getByLabel("Amount (₹)").fill("10000");
  await form.getByRole("button", { name: "Record prepayment" }).click();
  await expect(
    page.getByText("Prepayment recorded — awaiting approval"),
  ).toBeVisible();

  await dialog
    .getByRole("table", { name: "Prepayments" })
    .getByRole("button", { name: "Approve" })
    .click();
  await expect(
    page.getByText("Prepayment approved — EMIs settled"),
  ).toBeVisible();
  expect(bodiesOf(calls, "POST /hr/loans/61/prepayments")).toEqual([
    { amount: 10000, receivedOn: "2026-10-10", reason: "Sold a bike" },
  ]);
  expect(bodiesOf(calls, "POST /hr/loans/prepayments/41/decide")).toEqual([
    { decision: "APPROVED" },
  ]);
});

test("reopens a finalized month with a reason and downloads a report", async ({
  page,
}) => {
  const { calls } = await open(page, [
    "hr.payroll.read.all",
    "hr.payroll.reopen.all",
    "hr.payroll.export.all",
  ]);
  await page.getByRole("button", { name: "Manage September 2026" }).click();
  await expect(
    page.getByRole("button", { name: "PF ECR (EPFO)" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Salary journal" }).click();
  await expect
    .poll(() =>
      calls.some((c) =>
        c.startsWith("GET /hr/payroll/periods/905/reports/journal"),
      ),
    )
    .toBe(true);

  await page.getByRole("button", { name: "Reopen" }).click();
  const dialog = page.getByRole("dialog", { name: "Reopen period" });
  await dialog.getByLabel("Reason").fill("short");
  await dialog.getByRole("button", { name: "Reopen" }).click();
  await expect(dialog.getByText("at least 10 characters")).toBeVisible();
  await dialog.getByLabel("Reason").fill("Overtime was entered wrongly");
  await dialog.getByRole("button", { name: "Reopen" }).click();
  await expect(page.getByText("September 2026 reopened")).toBeVisible();
  expect(bodiesOf(calls, "POST /hr/payroll/periods/905/reopen")).toEqual([
    { reason: "Overtime was entered wrongly" },
  ]);
});

test("statutory files wait for finalize; no reopen or export without the .all grants", async ({
  page,
}) => {
  await open(page, ["hr.payroll.read.all", "hr.payroll.export.all"], {
    loan: loan(),
    periodStatus: "APPROVED",
  });
  await page.getByRole("button", { name: "Manage September 2026" }).click();
  await expect(
    page.getByRole("button", { name: "PF ECR (EPFO)" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Salary journal" }),
  ).toBeEnabled();
  await expect(page.getByRole("button", { name: "Reopen" })).toHaveCount(0);
});

test("regenerates a payslip with a reason", async ({ page }) => {
  const { calls } = await open(page, [
    "hr.payroll.read.all",
    "hr.payroll.write.all",
    "hr.payslip.read.all",
  ]);
  await page.getByRole("tab", { name: "Payslips" }).click();
  await page
    .getByRole("button", { name: "Regenerate payslip PS-202609-000011" })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Regenerate PS-202609-000011",
  });
  await dialog.getByLabel("Reason").fill("Bank account corrected");
  await dialog.getByRole("button", { name: "Regenerate" }).click();
  await expect(
    page.getByText("PS-202609-000011 regenerated — version 2"),
  ).toBeVisible();
  expect(bodiesOf(calls, "POST /hr/payslips/11/regenerate")).toEqual([
    { reason: "Bank account corrected" },
  ]);
});

test("previews and raises the statutory bonus; raises a gratuity", async ({
  page,
}) => {
  const { calls } = await open(page, [
    "hr.payroll.read.all",
    "hr.bonus.read.all",
    "hr.bonus.write.all",
  ]);
  await page.getByRole("tab", { name: "Bonuses" }).click();

  await page.getByRole("button", { name: "Statutory bonus" }).click();
  const s = page.getByRole("dialog", { name: "Statutory bonus" });
  await s.getByLabel("Financial year").fill("2025-26");
  await s.getByRole("button", { name: "Calculate" }).click();
  await expect(
    s
      .getByRole("table", { name: "Statutory bonus 2025-26" })
      .getByText("₹ 6,997.00"),
  ).toBeVisible();
  await s.getByRole("button", { name: "Raise 1 bonus(es)" }).click();
  await expect(
    page.getByText("1 statutory bonus(es) raised — awaiting approval"),
  ).toBeVisible();
  expect(bodiesOf(calls, "POST /hr/bonuses/statutory")).toEqual([
    { financialYear: "2025-26", create: false },
    { financialYear: "2025-26", create: true },
  ]);
  await s.getByRole("button", { name: "Close" }).last().click();

  await page.getByRole("button", { name: "Gratuity" }).click();
  const g = page.getByRole("dialog", { name: "Gratuity" });
  await g
    .getByRole("combobox", { name: /^Employee/ })
    .selectOption(String(ASHA.id));
  await expect(g.getByText("₹ 1,05,000.00")).toBeVisible();
  await g.getByRole("button", { name: "Raise gratuity" }).click();
  await expect(
    page.getByText(/Gratuity of ₹ 1,05,000.00 raised for Asha Rao/),
  ).toBeVisible();
  expect(bodiesOf(calls, "POST /hr/bonuses/gratuity")).toEqual([
    { employeeId: ASHA.id, asOf: "2026-10-13" },
  ]);
});

test("a team-level bonus writer gets no statutory bonus button", async ({
  page,
}) => {
  await open(page, [
    "hr.payroll.read.team",
    "hr.bonus.read.team",
    "hr.bonus.write.team",
  ]);
  await page.getByRole("tab", { name: "Bonuses" }).click();
  await expect(page.getByRole("button", { name: "New bonus" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Statutory bonus" }),
  ).toHaveCount(0);
});
