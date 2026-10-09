import { expect, type Page, type Route, test } from "@playwright/test";
import { signInAsAdmin } from "./helpers/auth";

/**
 * Real-browser coverage for payroll permission handling: tabs and action
 * buttons follow what the API would actually allow, not just "has some
 * grant of this permission".
 *
 * - whole-organization actions (periods, runs, approval, payslip
 *   generation, payment batches) need `.all`;
 * - single-employee writes and approvals need `.team` or `.all`;
 * - `.own` only reads.
 *
 * Signs in for real, then swaps the permission list in GET /auth/me (the
 * UI's only source of permissions) and serves list endpoints from empty
 * fixtures. The API enforces the same rules — apps/api/test/payroll.e2e-spec.ts.
 */

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

const MENU_AND_NAV = ["hr.payroll.read.team"];

const TEAM_LEAD = [
  ...MENU_AND_NAV,
  "hr.payroll.write.team",
  "hr.payroll.approve.team",
  "hr.bonus.read.team",
  "hr.bonus.write.team",
  "hr.bonus.approve.team",
  "hr.payslip.read.team",
  "hr.payment.read.team",
  "hr.payment.write.team",
  "hr.employee.read.team",
];

const EMPLOYEE = [
  "hr.payroll.read.own",
  "hr.payroll.write.own",
  "hr.bonus.read.own",
  "hr.bonus.write.own",
  "hr.bonus.approve.own",
  "hr.pf.read.own",
  "hr.pf.write.own",
  "employee_self_service.payslip.read",
];

const empty = {
  data: [],
  meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
};

async function signInWith(page: Page, permissions: string[]) {
  const batchCalls: string[] = [];
  await page.route(`${API}/auth/me`, async (route: Route) => {
    const res = await route.fetch();
    const body = (await res.json()) as { data: Record<string, unknown> };
    await route.fulfill({
      response: res,
      json: { ...body, data: { ...body.data, permissions } },
    });
  });
  await page.route(`${API}/hr/**`, async (route: Route) => {
    const p = new URL(route.request().url()).pathname;
    if (p.startsWith("/hr/payment-batches")) batchCalls.push(p);
    return route.fulfill({ status: 200, json: empty });
  });
  await page.route(`${API}/self-service/**`, (route: Route) =>
    route.fulfill({ status: 200, json: empty }),
  );
  await signInAsAdmin(page);
  return { batchCalls };
}

test("a team lead gets team actions but no organization-wide ones", async ({
  page,
}) => {
  const { batchCalls } = await signInWith(page, TEAM_LEAD);
  await page.getByRole("link", { name: "Payroll", exact: true }).click();

  // Periods & runs: readable, but creating a period needs `.all`.
  await expect(
    page.getByText("No payroll periods", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "New period" })).toHaveCount(0);

  // Bonuses: `.team` may create.
  await page.getByRole("tab", { name: "Bonuses" }).click();
  await expect(page.getByRole("button", { name: "New bonus" })).toBeVisible();

  // Payslips: may read their teams', but not generate.
  await page.getByRole("tab", { name: "Payslips" }).click();
  await expect(
    page.getByRole("heading", { name: "Employee payslips" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Generate payslips" }),
  ).toHaveCount(0);

  // Payments: batches are organization-wide — explained, never requested.
  await page.getByRole("tab", { name: "Payments" }).click();
  await expect(
    page.getByText("Payment batches need organization-wide access"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "New payment batch" }),
  ).toHaveCount(0);
  expect(batchCalls).toEqual([]);
});

test("an employee with `.own` grants only reads", async ({ page }) => {
  await signInWith(page, EMPLOYEE);
  await page.getByRole("link", { name: "Payroll", exact: true }).click();

  // Only the tabs they can read.
  const tabs = page.getByRole("tablist", { name: "Payroll sections" });
  await expect(tabs.getByRole("tab")).toHaveText([
    "Periods & runs",
    "Bonuses",
    "Payslips",
    "Salary report",
  ]);
  await expect(page.getByRole("button", { name: "New period" })).toHaveCount(0);

  await tabs.getByRole("tab", { name: "Bonuses" }).click();
  await expect(page.getByText("No bonuses", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "New bonus" })).toHaveCount(0);

  // "My payslips" (exact self-service code) shows; the HR list does not.
  await tabs.getByRole("tab", { name: "Payslips" }).click();
  await expect(
    page.getByRole("heading", { name: "My payslips" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Employee payslips" }),
  ).toHaveCount(0);
});
