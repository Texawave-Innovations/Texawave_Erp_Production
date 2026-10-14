import { readFile } from "node:fs/promises";
import { expect, type Page, type Route, test } from "@playwright/test";
import { signInAsAdmin } from "./helpers/auth";

/**
 * Real-browser coverage for HR → Payroll → Salary report: it reads every
 * page of a run's saved entries, totals them, filters by employee, and
 * exports a CSV that a spreadsheet can't execute.
 *
 * Signs in for real, then serves /hr/payroll/* from fixtures (a dev DB rarely
 * has a processed run). The figures themselves come from the API's payroll
 * calculation, covered by apps/api/test/payroll.e2e-spec.ts.
 */

const API = "http://localhost:3000";

function entry(
  id: number,
  name: string,
  code: string,
  gross: string,
  ded: Array<[string, string, string | null]>,
  net: string,
) {
  const total = ded.reduce((s, [, amt]) => s + Number(amt), 0).toFixed(2);
  return {
    id,
    payrollRunId: 88,
    employeeId: id,
    totalCalendarDays: 31,
    requiredWorkingDays: 22,
    presentDays: "22",
    halfDays: "0",
    holidayDays: "0",
    leaveDays: "0",
    lopDays: id === 2 ? "1.5" : "0",
    payableDays: id === 2 ? "20.5" : "22",
    monthlyGross: gross,
    perDayRate: "0",
    earningRatio: "1",
    baseEarnings: gross,
    totalGrossEarnings: gross,
    totalDeductions: total,
    netPayable: net,
    status: "CALCULATED",
    employee: {
      id,
      employeeCode: code,
      fullName: name,
      // Two teams in two departments, so the filters have something to split.
      team:
        id === 1
          ? { id: 11, name: "Software" }
          : { id: 12, name: "Mechanical" },
      department:
        id === 1
          ? { id: 21, name: "Engineering" }
          : { id: 22, name: "Manufacturing" },
    },
    earnings: [],
    deductions: ded.map(([n, amount, sourceType], i) => ({
      id: id * 10 + i,
      code: n.toUpperCase(),
      name: n,
      amount,
      sourceType,
    })),
    payslip: null,
  };
}

// Page 1 and page 2 of the run's entries: the report must fetch both.
const PAGE_1 = [
  entry(
    1,
    "Asha Rao",
    "EMP001",
    "55000.00",
    [["PF", "2800.00", "PF"]],
    "52200.00",
  ),
];
const PAGE_2 = [
  entry(
    2,
    '=HYPERLINK("x")',
    "EMP002",
    "20000.10",
    [
      ["ESI", "150.00", "ESI"],
      ["Loan", "1000.00", "LOAN"],
    ],
    "18850.10",
  ),
];

function period(status: "APPROVED" | "PROCESSED") {
  return {
    id: 910,
    year: 2031,
    month: 6,
    periodStart: "2031-06-01T00:00:00.000Z",
    periodEnd: "2031-06-30T00:00:00.000Z",
    status: "DRAFT",
    finalizedAt: null,
    finalizedBy: null,
    runs: [
      {
        id: 88,
        runNumber: 2,
        status,
        startedAt: null,
        completedAt: null,
        approvedAt: null,
      },
    ],
    createdAt: "2031-05-25T00:00:00.000Z",
  };
}

async function mock(page: Page, status: "APPROVED" | "PROCESSED") {
  const requestedPages: number[] = [];
  await page.route(`${API}/hr/payroll/**`, async (route: Route) => {
    const url = new URL(route.request().url());
    const json = (body: unknown) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    if (url.pathname === "/hr/payroll/periods")
      return json({
        data: [period(status)],
        meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
      });
    if (url.pathname === "/hr/payroll/entries") {
      const p = Number(url.searchParams.get("page"));
      requestedPages.push(p);
      return json({
        data: p === 1 ? PAGE_1 : PAGE_2,
        meta: { page: p, limit: 100, total: 2, totalPages: 2 },
      });
    }
    return route.continue();
  });
  return requestedPages;
}

async function openReport(page: Page) {
  await signInAsAdmin(page);
  await page.getByRole("link", { name: "Payroll", exact: true }).click();
  await page.getByRole("tab", { name: "Salary report" }).click();
  return page.getByRole("region", {
    name: "Salary report — June 2031 · Run #2",
  });
}

test("totals every page of the approved run and filters by employee", async ({
  page,
}) => {
  const requestedPages = await mock(page, "APPROVED");
  const report = await openReport(page);

  const table = report.getByRole("table", { name: "Salary report" });
  await expect(table.getByText("Asha Rao")).toBeVisible();
  await expect(table.getByText("EMP002")).toBeVisible();
  expect(requestedPages.sort()).toEqual([1, 2]);
  await expect(page.getByText("Not yet approved")).toHaveCount(0);

  // 52,200.00 + 18,850.10 — summed in paise, no float drift.
  await expect(report.getByText("₹ 71,050.10").first()).toBeVisible();
  await expect(
    report.getByText(/PF ₹ 2,800\.00 · ESI ₹ 150\.00 · loan EMI ₹ 1,000\.00/),
  ).toBeVisible();

  await page.getByLabel("Search employees").fill("emp001");
  await expect(table.getByText("Asha Rao")).toBeVisible();
  await expect(table.getByText("EMP002")).toHaveCount(0);
  await expect(report.getByText("₹ 52,200.00").first()).toBeVisible();
});

test("exports a formula-safe CSV and flags an unapproved run", async ({
  page,
}) => {
  await mock(page, "PROCESSED");
  const report = await openReport(page);
  await expect(page.getByText("Not yet approved")).toBeVisible();
  await expect(
    report.getByRole("table", { name: "Salary report" }).getByText("Asha Rao"),
  ).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export CSV" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("salary-report-2031-06-run2.csv");
  const csv = await readFile((await download.path()) as string, "utf8");
  const lines = csv
    .replace(new RegExp(`^${String.fromCharCode(0xfeff)}`), "")
    .trim()
    .split("\r\n");

  expect(lines[0]).toBe(
    '"Employee code","Employee","Team","Department","Payable days","LOP days","Gross","PF","ESI","Loan EMI","Other deductions","Total deductions","Net payable"',
  );
  expect(lines[1]).toBe(
    '"EMP001","Asha Rao","Software","Engineering","22","0","55000.00","2800.00","0.00","0.00","0.00","2800.00","52200.00"',
  );
  // Leading "=" neutralised so a spreadsheet shows it as text.
  expect(lines[2]).toContain(`"'=HYPERLINK(""x"")"`);
  expect(lines[3]).toBe(
    '"","Total","","","","","75000.10","2800.00","150.00","1000.00","0.00","3950.00","71050.10"',
  );
});

test("filters by team and department from the run's own employees", async ({
  page,
}) => {
  await mock(page, "APPROVED");
  const report = await openReport(page);
  const table = report.getByRole("table", { name: "Salary report" });
  await expect(table.getByText("Asha Rao")).toBeVisible();

  // Options come from the run's own employees, sorted by name.
  const team = page.getByLabel("Team", { exact: true });
  await expect(team.locator("option")).toHaveText([
    "All teams",
    "Mechanical",
    "Software",
  ]);

  await team.selectOption({ label: "Software" });
  await expect(table.getByText("Asha Rao")).toBeVisible();
  await expect(table.getByText("EMP002")).toHaveCount(0);
  await expect(report.getByText("₹ 52,200.00").first()).toBeVisible();

  // Team + a department nobody in that team belongs to → empty, explained.
  await page
    .getByLabel("Department", { exact: true })
    .selectOption({ label: "Manufacturing" });
  await expect(page.getByText("No matching employees")).toBeVisible();

  await team.selectOption({ label: "All teams" });
  await expect(table.getByText("EMP002")).toBeVisible();
  await expect(table.getByText("Asha Rao")).toHaveCount(0);
  await expect(table.getByText("Manufacturing")).toBeVisible();
});
