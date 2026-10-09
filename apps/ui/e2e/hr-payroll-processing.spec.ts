import { expect, type Page, type Route, test } from "@playwright/test";
import { signInAsAdmin } from "./helpers/auth";

/**
 * Real-browser coverage for the payroll processing flow: lifecycle tracker,
 * running payroll for selected employees, drilling into one employee's
 * calculation, and how a maker-checker rejection is explained.
 *
 * Signs in for real (seeded Super Admin), then serves the payroll and
 * employee endpoints from fixtures: a real run needs employees, salaries and
 * attendance that a dev DB usually lacks, and approval needs a second user.
 * The API side of this flow is covered by apps/api/test/payroll.e2e-spec.ts.
 */

const API = "http://localhost:3000";

const PERIOD = {
  id: 901,
  year: 2031,
  month: 5,
  periodStart: "2031-05-01T00:00:00.000Z",
  periodEnd: "2031-05-31T00:00:00.000Z",
  status: "DRAFT",
  finalizedAt: null,
  finalizedBy: null,
  runs: [] as unknown[],
  createdAt: "2031-04-25T00:00:00.000Z",
};

const EMPLOYEE = { id: 501, employeeCode: "EMP501", fullName: "Asha Rao" };

const RUN = {
  id: 77,
  payrollPeriodId: PERIOD.id,
  runNumber: 1,
  status: "PROCESSED",
  startedAt: "2031-05-31T09:00:00.000Z",
  completedAt: "2031-05-31T09:00:05.000Z",
  approvedAt: null,
  notes: "Asha only",
  payrollPeriod: {
    id: PERIOD.id,
    year: PERIOD.year,
    month: PERIOD.month,
    status: "PROCESSED",
  },
  runCreator: { id: 1, fullName: "Super Admin" },
  runApprover: null,
  _count: { entries: 1 },
};

const ENTRY = {
  id: 3001,
  payrollRunId: RUN.id,
  employeeId: EMPLOYEE.id,
  totalCalendarDays: 31,
  requiredWorkingDays: 22,
  presentDays: "21.00",
  halfDays: "0.00",
  holidayDays: "1.00",
  leaveDays: "0.00",
  lopDays: "0.00",
  payableDays: "22.00",
  monthlyGross: "55000.00",
  perDayRate: "2500.00",
  earningRatio: "1.0000",
  baseEarnings: "55000.00",
  totalGrossEarnings: "55000.00",
  totalDeductions: "2800.00",
  netPayable: "52200.00",
  status: "CALCULATED",
  employee: EMPLOYEE,
  earnings: [
    {
      id: 1,
      code: "BASIC",
      name: "Basic",
      baseAmount: "30000.00",
      earningRatio: "1.0000",
      calculatedAmount: "30000.00",
    },
    {
      id: 2,
      code: "HRA",
      name: "HRA",
      baseAmount: "25000.00",
      earningRatio: "1.0000",
      calculatedAmount: "25000.00",
    },
  ],
  deductions: [
    { id: 9, code: "PF", name: "PF", amount: "2800.00", sourceType: "PF" },
  ],
  payslip: null,
};

const page1 = <T>(rows: T[]) => ({
  data: rows,
  meta: { page: 1, limit: 20, total: rows.length, totalPages: 1 },
});

/** Serves /hr/payroll/* and /hr/employees from fixtures; everything else
 * (auth, menu) goes to the real API. Records what the UI posted. */
async function mockPayroll(page: Page) {
  const state = { runs: [] as (typeof RUN)[], runBodies: [] as unknown[] };
  await page.route(`${API}/hr/**`, async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const json = (status: number, body: unknown) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });

    if (url.pathname === "/hr/employees") return json(200, page1([EMPLOYEE]));
    if (url.pathname === "/hr/payroll/periods")
      return json(200, page1([{ ...PERIOD, runs: state.runs }]));
    if (url.pathname === "/hr/payroll/runs" && req.method() === "POST") {
      state.runBodies.push(req.postDataJSON());
      state.runs = [RUN];
      return json(201, { data: RUN });
    }
    if (url.pathname === "/hr/payroll/runs")
      return json(200, page1(state.runs));
    if (url.pathname === `/hr/payroll/runs/${RUN.id}/approve`)
      return json(403, {
        statusCode: 403,
        error: "SELF_APPROVAL_FORBIDDEN",
        message: "You cannot approve a payroll run you created",
      });
    if (url.pathname === "/hr/payroll/entries")
      return json(200, page1([ENTRY]));
    if (url.pathname === `/hr/payroll/entries/${ENTRY.id}`)
      return json(200, { data: ENTRY });
    return route.continue();
  });
  return state;
}

async function openPeriod(page: Page) {
  await signInAsAdmin(page);
  await page.getByRole("link", { name: "Payroll", exact: true }).click();
  await page.getByRole("button", { name: "Manage May 2031" }).click();
  return page.getByRole("region", { name: "May 2031" });
}

test("runs payroll for selected employees and drills into one employee", async ({
  page,
}) => {
  const state = await mockPayroll(page);
  const detail = await openPeriod(page);

  const progress = detail.getByRole("list", { name: "Payroll progress" });
  await expect(progress.locator('[aria-current="step"]')).toContainText(
    "Period created",
  );
  await expect(detail.getByText("Next: run payroll")).toBeVisible();

  // Selected-employees mode requires at least one employee.
  await detail.getByRole("button", { name: "Run payroll" }).click();
  const dialog = page.getByRole("dialog", { name: "Run payroll" });
  await dialog.getByLabel("Selected employees only").check();
  await dialog.getByRole("button", { name: "Run payroll" }).click();
  await expect(dialog.getByText("Add at least one employee")).toBeVisible();
  expect(state.runBodies).toHaveLength(0);

  await dialog.getByLabel("Add employee").selectOption(String(EMPLOYEE.id));
  await expect(
    dialog
      .getByRole("list", { name: "Selected employees" })
      .getByText("Asha Rao (EMP501)"),
  ).toBeVisible();
  await dialog.getByLabel("Notes").fill("Asha only");
  await dialog.getByRole("button", { name: "Run payroll" }).click();
  await expect(page.getByText("Run #1 processed")).toBeVisible();
  expect(state.runBodies).toEqual([
    {
      payrollPeriodId: PERIOD.id,
      employeeIds: [EMPLOYEE.id],
      notes: "Asha only",
    },
  ]);

  // The tracker moves on to approval; the run lists its note.
  await expect(progress.locator('[aria-current="step"]')).toContainText(
    "Payroll run",
  );
  const runs = detail.getByRole("table", { name: "Payroll runs" });
  await expect(runs.getByText("Asha only")).toBeVisible();

  // Entries → one employee's full calculation → back.
  await runs.getByRole("button", { name: "View entries" }).click();
  const entries = page.getByRole("dialog", { name: "Run #1 — May 2031" });
  await expect(
    entries
      .getByRole("table", { name: "Payroll entries" })
      .getByText("₹ 52,200.00"),
  ).toBeVisible();
  await entries
    .getByRole("button", { name: "View payroll for Asha Rao" })
    .click();
  const calc = entries.getByRole("region", { name: "Payroll for Asha Rao" });
  await expect(calc.getByText("Per-day rate")).toBeVisible();
  await expect(calc.getByText("₹ 2,500.00")).toBeVisible();
  await expect(
    calc.getByRole("table", { name: "Earnings" }).getByText("Basic"),
  ).toBeVisible();
  await expect(
    calc.getByRole("table", { name: "Deductions" }).getByText("Provident Fund"),
  ).toBeVisible();
  await entries
    .getByRole("button", { name: "← Back to all employees" })
    .click();
  await expect(
    entries.getByRole("table", { name: "Payroll entries" }),
  ).toBeVisible();
});

test("explains why the creator of a run cannot approve it", async ({
  page,
}) => {
  const state = await mockPayroll(page);
  state.runs = [RUN];
  const detail = await openPeriod(page);

  await detail
    .getByRole("table", { name: "Payroll runs" })
    .getByRole("button", { name: "Approve" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Approve payroll run" });
  await dialog.getByRole("button", { name: "Approve" }).click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "You created this payroll run, so someone else must approve it.",
  );
});
