import { expect, type Page, type Route, test } from "@playwright/test";
import { adminUserId, signInAsAdmin } from "./helpers/auth";

/**
 * Real-browser coverage for HR → Payroll → Bonuses: creating a bonus
 * (validated client-side), filtering, and approving/rejecting — never by
 * the bonus's creator or its recipient (maker-checker, mirrored from the
 * API).
 *
 * Signs in for real, then serves /hr/bonuses, /hr/employees and
 * /hr/payroll/periods from fixtures. Bonus payment through payroll is
 * covered by apps/api/test/payroll.e2e-spec.ts.
 */

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
const ASHA = {
  id: 501,
  employeeCode: "EMP501",
  fullName: "Asha Rao",
  userId: 9001,
};
const RAVI = {
  id: 502,
  employeeCode: "EMP502",
  fullName: "Ravi Kumar",
  userId: 9002,
};

function bonus(
  id: number,
  employee: typeof ASHA,
  createdBy: number,
  status = "PENDING",
) {
  return {
    id,
    employeeId: employee.id,
    payrollPeriodId: 903,
    bonusType: "PERFORMANCE",
    calculationBase: null,
    tenureMonths: null,
    attendanceDays: null,
    amount: "5000",
    status,
    reason: "Q1 top contributor",
    createdBy,
    approvedAt: null,
    createdAt: "2031-04-01T00:00:00.000Z",
    employee,
    payrollPeriod: { id: 903, year: 2031, month: 4, status: "DRAFT" },
    approver: null,
  };
}

const page1 = <T>(rows: T[]) => ({
  data: rows,
  meta: { page: 1, limit: 20, total: rows.length, totalPages: 1 },
});

async function mockBonuses(page: Page, me: number) {
  const state = {
    posts: [] as Array<{ path: string; body: unknown }>,
    listQueries: [] as string[],
  };
  await page.route(`${API}/hr/**`, async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname;
    const json = (status: number, body: unknown) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });

    if (p === "/hr/employees") return json(200, page1([ASHA, RAVI]));
    if (p === "/hr/payroll/periods")
      return json(
        200,
        page1([
          {
            id: 903,
            year: 2031,
            month: 4,
            periodStart: "2031-04-01",
            periodEnd: "2031-04-30",
            status: "DRAFT",
            finalizedAt: null,
            finalizedBy: null,
            runs: [],
            createdAt: "2031-03-20",
          },
          {
            id: 904,
            year: 2089,
            month: 2,
            periodStart: "2089-02-01",
            periodEnd: "2089-02-28",
            status: "CANCELLED",
            finalizedAt: null,
            finalizedBy: null,
            runs: [],
            createdAt: "2031-03-21",
          },
        ]),
      );
    if (req.method() === "POST" && p.startsWith("/hr/bonuses")) {
      state.posts.push({ path: p, body: req.postDataJSON() });
      return json(201, { data: bonus(99, RAVI, me) });
    }
    if (p === "/hr/bonuses") {
      state.listQueries.push(url.search);
      // #1 was created by someone else; #2 by the signed-in admin.
      return json(200, page1([bonus(1, ASHA, 777), bonus(2, RAVI, me)]));
    }
    return route.continue();
  });
  return state;
}

async function openBonuses(page: Page) {
  await signInAsAdmin(page);
  await page.getByRole("link", { name: "Payroll", exact: true }).click();
  await page.getByRole("tab", { name: "Bonuses" }).click();
}

test("creates a bonus once employee, type and amount are valid", async ({
  page,
}) => {
  const state = await mockBonuses(page, await adminUserId(page));
  await openBonuses(page);

  await page.getByRole("button", { name: "New bonus" }).click();
  const dialog = page.getByRole("dialog", { name: "New bonus" });
  await dialog.getByRole("button", { name: "Create bonus" }).click();
  await expect(dialog.getByText("Choose an employee")).toBeVisible();
  await expect(dialog.getByText("Choose a bonus type")).toBeVisible();
  await expect(dialog.getByText("Must be at least ₹1")).toBeVisible();
  expect(state.posts).toHaveLength(0);

  await dialog
    .getByRole("combobox", { name: /^Employee/ })
    .selectOption(String(RAVI.id));
  await dialog.getByLabel("Bonus type").selectOption("FESTIVAL");
  await dialog.getByLabel("Amount (₹)").fill("2500");
  await dialog
    .getByLabel("Pay with payroll period")
    .selectOption({ label: "April 2031" });
  await dialog.getByLabel("Reason").fill("Diwali");
  await dialog.getByRole("button", { name: "Create bonus" }).click();
  await expect(
    page.getByText("Bonus created for Ravi Kumar — awaiting approval"),
  ).toBeVisible();
  expect(state.posts).toEqual([
    {
      path: "/hr/bonuses",
      body: {
        employeeId: RAVI.id,
        bonusType: "FESTIVAL",
        amount: 2500,
        payrollPeriodId: 903,
        reason: "Diwali",
      },
    },
  ]);
});

test("approves another person's bonus but not one the admin created", async ({
  page,
}) => {
  const state = await mockBonuses(page, await adminUserId(page));
  await openBonuses(page);

  // Defaults to the approval queue.
  await expect.poll(() => state.listQueries[0]).toContain("status=PENDING");
  const table = page.getByRole("table", { name: "Bonuses" });
  await expect(
    table.getByRole("button", { name: "Approve bonus for Asha Rao" }),
  ).toBeVisible();
  await expect(
    table.getByRole("button", { name: "Approve bonus for Ravi Kumar" }),
  ).toHaveCount(0);
  await expect(table.getByText("Someone else must decide")).toHaveCount(1);

  await table
    .getByRole("button", { name: "Reject bonus for Asha Rao" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Reject bonus" });
  await expect(dialog.getByText("₹ 5,000.00")).toBeVisible();
  await dialog.getByLabel("Note").fill("Not in this cycle");
  await dialog.getByRole("button", { name: "Reject" }).click();
  await expect(page.getByText("Bonus rejected")).toBeVisible();
  expect(state.posts).toEqual([
    {
      path: "/hr/bonuses/1/decide",
      body: { decision: "REJECTED", note: "Not in this cycle" },
    },
  ]);

  // Cancelled periods are not offered as a filter.
  const periodFilter = page.getByLabel("Filter by payroll period");
  await expect(
    periodFilter.locator("option", { hasText: "April 2031" }),
  ).toHaveCount(1);
  await expect(
    periodFilter.locator("option", { hasText: "February 2089" }),
  ).toHaveCount(0);

  await page.getByLabel("Filter by bonus status").selectOption("");
  await expect.poll(() => state.listQueries.at(-1)).not.toContain("status=");
});
