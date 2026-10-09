import { expect, type Page, type Route, test } from "@playwright/test";
import { adminUserId, signInAsAdmin } from "./helpers/auth";

/**
 * Real-browser coverage for HR → Payroll → Loans: issuing a loan with the
 * schedule rule checked client-side, the repayment schedule, requesting an
 * EMI skip, and deciding one — never by its requester (maker-checker,
 * mirrored from the API). Also: "My loans" stays hidden for an account
 * with no employee record.
 *
 * Signs in for real, then serves /hr/loans, /self-service/loans,
 * /hr/employees and /hr/payroll/periods from fixtures. Loan scheduling and
 * skip re-scheduling are covered by apps/api/test/payroll.e2e-spec.ts.
 */

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
const ASHA = {
  id: 501,
  employeeCode: "EMP501",
  fullName: "Asha Rao",
  userId: 9001,
};

function loan(requesterId: number) {
  return {
    id: 61,
    employeeId: ASHA.id,
    loanNumber: "LOAN-000061",
    principalAmount: "3000",
    emiAmount: "1000",
    emiMonths: 3,
    disbursedDate: "2031-01-15T00:00:00.000Z",
    status: "ACTIVE",
    reason: "Medical",
    createdAt: "2031-01-15T00:00:00.000Z",
    employee: ASHA,
    repayments: [
      {
        id: 1,
        installmentNo: 1,
        dueDate: "2031-02-15T00:00:00.000Z",
        amount: "1000",
        status: "PAID",
        paidAt: "2031-02-28T00:00:00.000Z",
      },
      {
        id: 2,
        installmentNo: 2,
        dueDate: "2031-03-15T00:00:00.000Z",
        amount: "1000",
        status: "PENDING",
        paidAt: null,
      },
      {
        id: 3,
        installmentNo: 3,
        dueDate: "2031-04-15T00:00:00.000Z",
        amount: "1000",
        status: "PENDING",
        paidAt: null,
      },
    ],
    skipRequests: [
      {
        id: 71,
        loanId: 61,
        payrollPeriodId: 902,
        status: "PENDING",
        reason: "School fees",
        requestedAt: "2031-03-01T00:00:00.000Z",
        approvedAt: null,
        payrollPeriod: { id: 902, year: 2031, month: 3 },
        requester: { id: requesterId, fullName: "Requester" },
        approver: null,
      },
    ],
  };
}

const page1 = <T>(rows: T[]) => ({
  data: rows,
  meta: { page: 1, limit: 10, total: rows.length, totalPages: 1 },
});

async function mockLoans(page: Page, requesterId: number) {
  const state = {
    posts: [] as Array<{ path: string; body: unknown }>,
  };
  await page.route(`${API}/**`, async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname;
    const json = (status: number, body: unknown) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });

    if (p === "/hr/employees") return json(200, page1([ASHA]));
    if (p === "/hr/payroll/periods")
      return json(
        200,
        page1([
          {
            id: 902,
            year: 2031,
            month: 3,
            periodStart: "2031-03-01",
            periodEnd: "2031-03-31",
            status: "DRAFT",
            finalizedAt: null,
            finalizedBy: null,
            runs: [],
            createdAt: "2031-02-20",
          },
        ]),
      );
    // The admin has no employee record: self-service says so.
    if (p === "/self-service/loans")
      return json(403, {
        statusCode: 403,
        error: "NOT_AN_EMPLOYEE",
        message: "Your account is not linked to an employee record",
      });
    if (req.method() === "POST" && p.startsWith("/hr/loans")) {
      state.posts.push({ path: p, body: req.postDataJSON() });
      return json(201, {
        data:
          p === "/hr/loans"
            ? { ...loan(requesterId), id: 62, loanNumber: "LOAN-000062" }
            : {},
      });
    }
    if (p === "/hr/loans") return json(200, page1([loan(requesterId)]));
    return route.continue();
  });
  return state;
}

async function openLoans(page: Page) {
  await signInAsAdmin(page);
  await page.getByRole("link", { name: "Payroll", exact: true }).click();
  await page.getByRole("tab", { name: "Loans" }).click();
}

test("issues a loan only once the EMI schedule covers the principal", async ({
  page,
}) => {
  const state = await mockLoans(page, 1);
  await openLoans(page);

  // No employee record → no "My loans" section, and no error either.
  await expect(page.getByRole("heading", { name: "My loans" })).toHaveCount(0);
  await expect(
    page
      .getByRole("table", { name: "Employee loans" })
      .getByText("LOAN-000061"),
  ).toBeVisible();

  await page.getByRole("button", { name: "Issue loan" }).click();
  const dialog = page.getByRole("dialog", { name: "Issue loan" });
  await dialog
    .getByRole("combobox", { name: /^Employee/ })
    .selectOption(String(ASHA.id));
  await dialog.getByLabel("Principal (₹)").fill("12000");
  await dialog.getByLabel("Months").fill("12");
  await expect(dialog.getByText("Suggested: ₹1,000")).toBeVisible();

  // 900 × 12 = 10,800 < 12,000.
  await dialog.getByLabel("EMI (₹)").fill("900");
  await dialog.getByLabel("Disbursed on").fill("2031-01-15");
  await dialog.getByRole("button", { name: "Issue loan" }).click();
  await expect(
    dialog.getByText("EMI × months must cover the principal"),
  ).toBeVisible();
  // 2,000 × 11 ≥ 12,000: the 12th installment would be empty.
  await dialog.getByLabel("EMI (₹)").fill("2000");
  await dialog.getByRole("button", { name: "Issue loan" }).click();
  await expect(
    dialog.getByText("Too many months: the last installment would be empty"),
  ).toBeVisible();
  expect(state.posts).toHaveLength(0);

  await dialog.getByLabel("EMI (₹)").fill("1000");
  await dialog.getByRole("button", { name: "Issue loan" }).click();
  await expect(
    page.getByText("Loan LOAN-000062 issued to Asha Rao"),
  ).toBeVisible();
  expect(state.posts).toEqual([
    {
      path: "/hr/loans",
      body: {
        employeeId: ASHA.id,
        principalAmount: 12000,
        emiAmount: 1000,
        emiMonths: 12,
        disbursedDate: "2031-01-15",
      },
    },
  ]);
});

test("shows the schedule and decides another person's skip request", async ({
  page,
}) => {
  const state = await mockLoans(page, 424242);
  await openLoans(page);

  const row = page.getByRole("table", { name: "Employee loans" });
  await expect(row.getByText("₹ 2,000.00")).toBeVisible(); // outstanding
  await expect(row.getByText("1 skip request pending")).toBeVisible();
  await page.getByRole("button", { name: "View loan LOAN-000061" }).click();

  const dialog = page.getByRole("dialog", { name: "Loan LOAN-000061" });
  await expect(dialog.getByText("1 of 3 installments")).toBeVisible();
  const schedule = dialog.getByRole("table", { name: "Repayment schedule" });
  await expect(schedule.getByText("Paid", { exact: true })).toBeVisible();
  await expect(schedule.getByText("Pending", { exact: true })).toHaveCount(2);

  await dialog
    .getByRole("table", { name: "EMI skip requests" })
    .getByRole("button", { name: "Approve" })
    .click();
  await expect(page.getByText("Skip approved")).toBeVisible();
  expect(state.posts).toEqual([
    {
      path: "/hr/loans/skip-requests/71/decide",
      body: { decision: "APPROVED" },
    },
  ]);
});

test("never offers a requester their own skip decision, and requests a skip", async ({
  page,
}) => {
  const me = await adminUserId(page);
  const state = await mockLoans(page, me);
  await openLoans(page);
  await page.getByRole("button", { name: "View loan LOAN-000061" }).click();
  const dialog = page.getByRole("dialog", { name: "Loan LOAN-000061" });

  const skips = dialog.getByRole("table", { name: "EMI skip requests" });
  await expect(skips.getByText("Someone else must decide")).toBeVisible();
  await expect(skips.getByRole("button", { name: "Approve" })).toHaveCount(0);

  await dialog.getByRole("button", { name: "Request EMI skip" }).click();
  const form = dialog.getByRole("form", { name: "Request an EMI skip" });
  await form.getByRole("button", { name: "Request skip" }).click();
  await expect(form.getByText("Choose a payroll period")).toBeVisible();
  expect(state.posts).toHaveLength(0);

  await form.getByLabel("Payroll period").selectOption({ label: "March 2031" });
  await form.getByLabel("Reason").fill("Festival expenses");
  await form.getByRole("button", { name: "Request skip" }).click();
  await expect(page.getByText("EMI skip requested")).toBeVisible();
  expect(state.posts).toEqual([
    {
      path: "/hr/loans/61/skip-request",
      body: { payrollPeriodId: 902, reason: "Festival expenses" },
    },
  ]);
});
