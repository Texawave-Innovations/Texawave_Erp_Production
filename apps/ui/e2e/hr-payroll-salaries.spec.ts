import { expect, type Page, test } from "@playwright/test";
import {
  type MockAnswer,
  type MockRequest,
  page1,
  signInWithMockedApi,
} from "./helpers/mock-api";

/**
 * HR → Payroll → Salaries (Docs/PAYROLL_AND_COMPLIANCE.md §3.0): a structure
 * from a template (with its preview), from component lines, or a gross
 * split; editing lines sends them all. API fully mocked.
 */

const ASHA = { id: 501, employeeCode: "EMP-000501", fullName: "Asha Rao" };

const COMPONENTS = [
  {
    id: 1,
    code: "BASIC",
    name: "Basic Salary",
    kind: "EARNING",
    isProrated: true,
    isTaxable: true,
    pfApplicable: true,
    esiApplicable: true,
    isSystem: true,
    displayOrder: 10,
    isActive: true,
  },
  {
    id: 2,
    code: "HRA",
    name: "House Rent Allowance",
    kind: "EARNING",
    isProrated: true,
    isTaxable: true,
    pfApplicable: false,
    esiApplicable: true,
    isSystem: true,
    displayOrder: 30,
    isActive: true,
  },
  {
    id: 8,
    code: "CANTEEN",
    name: "Canteen",
    kind: "DEDUCTION",
    isProrated: false,
    isTaxable: false,
    pfApplicable: false,
    esiApplicable: false,
    isSystem: false,
    displayOrder: 90,
    isActive: true,
  },
];

const SALARY = {
  id: 70,
  employeeId: ASHA.id,
  effectiveFrom: "2026-04-01",
  effectiveTo: null,
  grossMonthly: "30000",
  arrearsSalary: "0",
  arrearsPaidPeriodId: null,
  employee: { ...ASHA, teamId: 3, userId: 9001, status: "ACTIVE" },
  components: [
    {
      monthlyAmount: "18000",
      component: {
        id: 1,
        code: "BASIC",
        name: "Basic Salary",
        kind: "EARNING",
        displayOrder: 10,
      },
    },
    {
      monthlyAmount: "12000",
      component: {
        id: 2,
        code: "HRA",
        name: "House Rent Allowance",
        kind: "EARNING",
        displayOrder: 30,
      },
    },
  ],
  salaryTemplate: null,
  revisionLetter: null,
};

function handler(req: MockRequest): MockAnswer | undefined {
  const { method, pathname } = req;
  if (pathname === "/hr/salaries" && method === "GET")
    return { body: page1([SALARY]) };
  if (pathname === "/hr/salaries" && method === "POST")
    return { status: 201, body: { data: SALARY } };
  if (pathname === "/hr/salaries/70" && method === "PATCH")
    return { body: { data: SALARY } };
  if (pathname === "/hr/payroll/salary-components")
    return { body: { data: COMPONENTS } };
  if (pathname === "/hr/payroll/salary-templates" && method === "GET")
    return {
      body: {
        data: [
          {
            id: 5,
            code: "GRADE-A",
            name: "Grade A",
            description: null,
            isActive: true,
            lines: [],
          },
        ],
      },
    };
  if (pathname === "/hr/payroll/salary-templates/5/preview")
    return {
      body: {
        data: {
          grossMonthly: 40000,
          totalEarnings: 40000,
          lines: [
            {
              componentId: 1,
              code: "BASIC",
              kind: "EARNING",
              monthlyAmount: 16000,
            },
            {
              componentId: 2,
              code: "HRA",
              kind: "EARNING",
              monthlyAmount: 24000,
            },
          ],
        },
      },
    };
  if (pathname.startsWith("/hr/employees")) return { body: page1([ASHA]) };
  return undefined;
}

async function openSalaries(page: Page, permissions: string[]) {
  const session = await signInWithMockedApi(page, {
    workspace: "hr",
    permissions: [
      "hr.workspace.access",
      "hr.employee.read.all",
      ...permissions,
    ],
    menu: [{ code: "hr-payroll", label: "Payroll", path: "/hr/payroll" }],
    handler,
  });
  await page.getByRole("link", { name: "Payroll", exact: true }).click();
  await page.getByRole("tab", { name: "Salaries" }).click();
  return session;
}

const bodies = (calls: string[], prefix: string) =>
  calls
    .filter((c) => c.startsWith(prefix))
    .map((c) => JSON.parse(c.slice(c.indexOf("{"))) as Record<string, unknown>);

async function pickAsha(page: Page) {
  await page
    .getByRole("dialog")
    .getByRole("combobox", { name: /^Employee/ })
    .selectOption(String(ASHA.id));
}

const WRITER = [
  "hr.salary.read.all",
  "hr.salary.write.all",
  "hr.payroll_settings.read",
];

test("lists structures with their lines", async ({ page }) => {
  await openSalaries(page, WRITER);
  const table = page.getByRole("table", { name: "Salary structures" });
  await expect(table.getByText("Asha Rao")).toBeVisible();
  await expect(table.getByText("House Rent Allowance")).toBeVisible();
  await expect(table.getByText("₹ 30,000.00")).toBeVisible();
});

test("creates a salary from a template, showing its breakup first", async ({
  page,
}) => {
  const { calls } = await openSalaries(page, WRITER);
  await page.getByRole("button", { name: "New salary" }).click();
  await pickAsha(page);
  const dialog = page.getByRole("dialog", { name: "New salary structure" });
  await dialog.getByLabel("Effective from").fill("2026-11-01");
  await dialog.getByLabel("Template").selectOption("5");
  await dialog.getByLabel("Gross monthly (₹)").fill("40000");
  await expect(
    dialog
      .getByRole("table", { name: "Template preview" })
      .getByText("₹ 24,000.00"),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Save salary" }).click();
  await expect(
    page.getByText("Salary structure saved for Asha Rao"),
  ).toBeVisible();
  expect(bodies(calls, "POST /hr/salaries")).toEqual([
    {
      employeeId: ASHA.id,
      effectiveFrom: "2026-11-01",
      grossMonthly: 40000,
      salaryTemplateId: 5,
    },
  ]);
});

test("creates a salary from component lines, a deduction not counted in the gross", async ({
  page,
}) => {
  const { calls } = await openSalaries(page, WRITER);
  await page.getByRole("button", { name: "New salary" }).click();
  await pickAsha(page);
  const dialog = page.getByRole("dialog", { name: "New salary structure" });
  await dialog.getByLabel("Effective from").fill("2026-11-01");
  await dialog.getByLabel("How to build the salary").selectOption("lines");
  await dialog.getByLabel("Component of line 1").selectOption("1");
  await dialog.getByLabel("Monthly amount of line 1").fill("20000");
  await dialog.getByRole("button", { name: "Add line" }).click();
  await dialog.getByLabel("Component of line 2").selectOption("8");
  await dialog.getByLabel("Monthly amount of line 2").fill("300");
  await expect(dialog.getByText("Gross: ₹ 20,000.00")).toBeVisible();
  await dialog.getByRole("button", { name: "Save salary" }).click();
  await expect(
    page.getByText("Salary structure saved for Asha Rao"),
  ).toBeVisible();
  expect(bodies(calls, "POST /hr/salaries")).toEqual([
    {
      employeeId: ASHA.id,
      effectiveFrom: "2026-11-01",
      components: [
        { componentId: 1, monthlyAmount: 20000 },
        { componentId: 8, monthlyAmount: 300 },
      ],
    },
  ]);
});

test("edits a structure's lines", async ({ page }) => {
  const { calls } = await openSalaries(page, WRITER);
  await page.getByRole("button", { name: "Edit salary of Asha Rao" }).click();
  const dialog = page.getByRole("dialog", { name: "Salary of Asha Rao" });
  await dialog.getByLabel("Monthly amount of line 2").fill("13000");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Salary structure updated")).toBeVisible();
  expect(bodies(calls, "PATCH /hr/salaries/70")).toEqual([
    {
      components: [
        { componentId: 1, monthlyAmount: 18000 },
        { componentId: 2, monthlyAmount: 13000 },
      ],
    },
  ]);
});

test("without the settings read grant only the gross split is offered; a reader sees no buttons", async ({
  page,
}) => {
  await openSalaries(page, ["hr.salary.read.team", "hr.salary.write.team"]);
  await page.getByRole("button", { name: "New salary" }).click();
  const dialog = page.getByRole("dialog", { name: "New salary structure" });
  await expect(
    dialog.getByLabel("How to build the salary").locator("option"),
  ).toHaveText(["Split a gross (settings percentages)"]);
});

test("a read-only grant shows no write buttons", async ({ page }) => {
  await openSalaries(page, ["hr.salary.read.own"]);
  await expect(
    page.getByRole("table", { name: "Salary structures" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "New salary" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Edit salary/ })).toHaveCount(
    0,
  );
});
