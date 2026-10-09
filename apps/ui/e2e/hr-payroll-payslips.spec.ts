import { expect, type Page, type Route, test } from "@playwright/test";
import { signInAsAdmin } from "./helpers/auth";

/**
 * Real-browser coverage for HR → Payroll → Payslips: "My payslips" (and
 * hiding it for an account with no employee record), the HR list with its
 * filters, the payslip breakdown, the PDF download from both routes,
 * re-generating a period's payslips, and the loading/error/empty states.
 *
 * Signs in for real, then serves /hr/payslips, /self-service/payslips,
 * /hr/employees and /hr/payroll/periods from fixtures. PDF rendering and
 * payslip scope are covered by apps/api (payslip-pdf.*.spec.ts and
 * test/payroll.e2e-spec.ts).
 */

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
const ASHA = { id: 501, employeeCode: "EMP501", fullName: "Asha Rao" };

const PERIOD = {
  id: 905,
  year: 2031,
  month: 6,
  periodStart: "2031-06-01",
  periodEnd: "2031-06-30",
  status: "FINALIZED",
  finalizedAt: null,
  finalizedBy: null,
  runs: [],
  createdAt: "2031-05-20",
};

function payslip(id: number) {
  return {
    id,
    payrollPeriodId: PERIOD.id,
    payrollEntryId: 4000 + id,
    employeeId: ASHA.id,
    payslipNumber: `PS-203106-00000${id}`,
    netPayable: "48200",
    status: "GENERATED",
    generatedAt: "2031-07-01T10:00:00.000Z",
    employee: {
      ...ASHA,
      userId: 9001,
      designation: { id: 1, name: "Engineer" },
      department: { id: 2, name: "Software" },
      team: { id: 3, name: "Platform" },
      bankDetails: {
        bankName: "HDFC Bank",
        accountNumber: "********4321",
        ifscCode: "HDFC0000123",
        panNumber: "******234F",
      },
      pfProfile: { uan: "100123456789", pfNumber: null },
      esiProfile: null,
    },
    payrollPeriod: {
      id: PERIOD.id,
      year: 2031,
      month: 6,
      periodStart: PERIOD.periodStart,
      periodEnd: PERIOD.periodEnd,
      status: "FINALIZED",
    },
    payrollEntry: {
      payableDays: "22",
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
        {
          code: "HRA",
          name: "HRA",
          baseAmount: "20000",
          calculatedAmount: "20000",
        },
      ],
      deductions: [
        { code: "PF", name: "PF (employee)", amount: "1800", sourceType: "PF" },
      ],
    },
  };
}

const page1 = <T>(rows: T[]) => ({
  data: rows,
  meta: { page: 1, limit: 20, total: rows.length, totalPages: 1 },
});

const NOT_AN_EMPLOYEE = {
  statusCode: 403,
  error: "NOT_AN_EMPLOYEE",
  message: "Your account is not linked to an employee record",
};

async function mockPayslips(
  page: Page,
  opts: { mine?: boolean; hrRows?: number; hrFailures?: number } = {},
) {
  const state = {
    listQueries: [] as string[],
    pdfPaths: [] as string[],
    generated: [] as unknown[],
  };
  // The query client retries a 5xx twice, so 3 failures reach the error state.
  let hrFailures = opts.hrFailures ?? 0;
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

    if (p.endsWith("/pdf")) {
      state.pdfPaths.push(p);
      return route.fulfill({
        status: 200,
        contentType: "application/pdf",
        body: "%PDF-1.4 fixture",
      });
    }
    if (p === "/self-service/payslips")
      return opts.mine
        ? json(200, page1([payslip(1)]))
        : json(403, NOT_AN_EMPLOYEE);
    if (p === "/hr/payslips/generate") {
      state.generated.push(req.postDataJSON());
      return json(200, { data: [payslip(1), payslip(2)] });
    }
    if (p === "/hr/payslips") {
      state.listQueries.push(url.search);
      if (hrFailures > 0) {
        hrFailures--;
        return json(500, {
          statusCode: 500,
          error: "INTERNAL_SERVER_ERROR",
          message: "boom",
        });
      }
      const n = opts.hrRows ?? 1;
      return json(200, page1(n > 0 ? [payslip(1)] : []));
    }
    if (p === "/hr/employees") return json(200, page1([ASHA]));
    if (p === "/hr/payroll/periods") return json(200, page1([PERIOD]));
    return route.continue();
  });
  return state;
}

async function openPayslips(page: Page) {
  await signInAsAdmin(page);
  await page.getByRole("link", { name: "Payroll", exact: true }).click();
  await page.getByRole("tab", { name: "Payslips" }).click();
}

test("lists payslips, shows the breakdown and downloads the PDF", async ({
  page,
}) => {
  const state = await mockPayslips(page);
  await openPayslips(page);

  // No employee record → no "My payslips" section, and no error either.
  await expect(page.getByRole("heading", { name: "My payslips" })).toHaveCount(
    0,
  );
  const table = page.getByRole("table", { name: "Employee payslips" });
  await expect(table.getByText("PS-203106-000001")).toBeVisible();
  await expect(table.getByText("₹ 48,200.00")).toBeVisible();

  await page
    .getByRole("button", { name: "View payslip PS-203106-000001" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Payslip PS-203106-000001" });
  await expect(
    dialog.getByRole("table", { name: "Earnings" }).getByText("₹ 30,000.00"),
  ).toBeVisible();
  await expect(
    dialog.getByText("PF (employee) (Provident Fund)"),
  ).toBeVisible();
  // Bank account and PAN only ever arrive masked.
  await expect(dialog.getByText("HDFC Bank · ********4321")).toBeVisible();
  await expect(dialog.getByText("******234F")).toBeVisible();

  const download = page.waitForEvent("download");
  await dialog
    .getByRole("button", { name: "Download PDF of payslip PS-203106-000001" })
    .click();
  expect((await download).suggestedFilename()).toBe("PS-203106-000001.pdf");
  expect(state.pdfPaths).toEqual(["/hr/payslips/1/pdf"]);
});

test("filters by period and employee, and re-generates a period", async ({
  page,
}) => {
  const state = await mockPayslips(page);
  await openPayslips(page);
  await expect(
    page.getByRole("table", { name: "Employee payslips" }),
  ).toBeVisible();

  await page
    .getByLabel("Filter by payroll period")
    .selectOption({ label: "June 2031" });
  await page
    .getByRole("combobox", { name: "Filter by employee" })
    .selectOption(String(ASHA.id));
  await expect
    .poll(() => state.listQueries.at(-1))
    .toMatch(/(?=.*payrollPeriodId=905)(?=.*employeeId=501)/);

  await page.getByRole("button", { name: "Generate payslips" }).click();
  const dialog = page.getByRole("dialog", { name: "Generate payslips" });
  await dialog.getByRole("button", { name: "Generate" }).click();
  await expect(dialog.getByText("Choose a payroll period")).toBeVisible();
  expect(state.generated).toHaveLength(0);

  await dialog
    .getByLabel("Payroll period")
    .selectOption({ label: "June 2031" });
  await dialog.getByRole("button", { name: "Generate" }).click();
  await expect(page.getByText("2 payslips generated")).toBeVisible();
  expect(state.generated).toEqual([{ payrollPeriodId: PERIOD.id }]);
});

test("an employee sees and downloads their own payslip", async ({ page }) => {
  const state = await mockPayslips(page, { mine: true });
  await openPayslips(page);

  const mine = page.getByRole("table", { name: "My payslips" });
  await expect(mine.getByText("PS-203106-000001")).toBeVisible();
  const download = page.waitForEvent("download");
  await mine
    .getByRole("button", { name: "Download PDF of payslip PS-203106-000001" })
    .click();
  await download;
  // The self-service route, never the HR one.
  expect(state.pdfPaths).toEqual(["/self-service/payslips/1/pdf"]);
});

test("shows the error state with retry, then the empty state", async ({
  page,
}) => {
  await mockPayslips(page, { hrRows: 0, hrFailures: 3 });
  await openPayslips(page);

  await expect(page.getByText("Something went wrong")).toBeVisible();
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("No payslips", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Payslips are issued when a payroll period is finalized."),
  ).toBeVisible();
});
