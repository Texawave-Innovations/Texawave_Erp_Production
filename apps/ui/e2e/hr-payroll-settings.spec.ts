import { expect, type Page, test } from "@playwright/test";
import {
  type MockAnswer,
  type MockRequest,
  signInWithMockedApi,
} from "./helpers/mock-api";

/**
 * HR → Payroll → Settings (Docs/PAYROLL_AND_COMPLIANCE.md §4.2a, §4.10–§4.12):
 * policy form sends only what changed with the version; components,
 * templates, tax regimes and PT slabs post exactly what the form shows; a
 * reader without hr.payroll_settings.write gets a read-only screen. API
 * fully mocked — the rules are proven by apps/api payroll-statutory e2e.
 */

const SETTINGS = {
  basicPercent: 35,
  hraPercent: 30,
  conveyancePercent: 20,
  pfWageCeiling: 15000,
  pfEmployeeRate: 12,
  pfEmployerRate: 12,
  esiWageThreshold: 21000,
  esiEmployeeRate: 0.75,
  esiEmployerRate: 3.25,
  payDaysMode: "CALENDAR",
  useAttendance: true,
  unmarkedDaysAsAbsent: true,
  overtimeEnabled: false,
  overtimeRatePerHour: null,
  overtimeMultiplier: 2,
  standardHoursPerDay: 8,
  pfCapAtCeiling: true,
  epsRate: 8.33,
  epsWageCeiling: 15000,
  epsAgeLimit: 58,
  edliRate: 0.5,
  edliWageCeiling: 15000,
  pfAdminRate: 0.5,
  ptEnabled: false,
  ptDefaultStateCode: null,
  tdsEnabled: false,
  defaultTaxRegime: "NEW",
  bonusEligibilityLimit: 21000,
  bonusCalculationCeiling: 7000,
  bonusPercent: 8.33,
  gratuityCap: 2000000,
  gratuityMinYears: 5,
  loanMaxMultiple: 3,
  loanMaxEmiPercent: 100,
  companyName: null,
  companyAddress: null,
  companyGstin: null,
  companyPan: null,
  companyTan: null,
  pfEstablishmentCode: null,
  esiEmployerCode: null,
  isDefault: false,
  version: 4,
  updatedAt: "2026-10-01T10:00:00.000Z",
};

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
    id: 3,
    code: "SPECIAL_ALLOWANCE",
    name: "Special Allowance",
    kind: "EARNING",
    isProrated: true,
    isTaxable: true,
    pfApplicable: false,
    esiApplicable: true,
    isSystem: true,
    displayOrder: 60,
    isActive: true,
  },
];

function handler(req: MockRequest): MockAnswer | undefined {
  const { method, pathname } = req;
  if (pathname === "/hr/payroll/settings" && method === "GET")
    return { body: { data: SETTINGS } };
  if (pathname === "/hr/payroll/settings" && method === "PATCH")
    return {
      body: { data: { ...SETTINGS, ...(req.body as object), version: 5 } },
    };
  if (pathname === "/hr/payroll/salary-components" && method === "GET")
    return { body: { data: COMPONENTS } };
  if (pathname === "/hr/payroll/salary-components" && method === "POST")
    return {
      status: 201,
      body: {
        data: {
          id: 9,
          isSystem: false,
          isActive: true,
          ...(req.body as object),
        },
      },
    };
  if (pathname === "/hr/payroll/salary-templates" && method === "GET")
    return { body: { data: [] } };
  if (pathname === "/hr/payroll/salary-templates" && method === "POST")
    return {
      status: 201,
      body: {
        data: { id: 5, isActive: true, lines: [], ...(req.body as object) },
      },
    };
  if (pathname === "/hr/payroll/tax-regimes" && method === "GET")
    return { body: { data: [] } };
  if (pathname === "/hr/payroll/tax-regimes" && method === "PUT")
    return {
      body: { data: { id: 1, version: 1, slabs: [], ...(req.body as object) } },
    };
  if (pathname === "/hr/payroll/pt-slabs" && method === "GET")
    return { body: { data: [] } };
  if (pathname === "/hr/payroll/pt-slabs" && method === "POST")
    return {
      status: 201,
      body: { data: { id: 3, isActive: true, ...(req.body as object) } },
    };
  if (pathname === "/hr/payroll/pt-location-states")
    return { body: { data: [] } };
  if (pathname === "/master-data/work-locations")
    return { body: { data: [{ id: 4, name: "Chennai" }] } };
  return undefined;
}

async function openSettings(page: Page, permissions: string[]) {
  const session = await signInWithMockedApi(page, {
    workspace: "hr",
    permissions: ["hr.workspace.access", ...permissions],
    menu: [{ code: "hr-payroll", label: "Payroll", path: "/hr/payroll" }],
    handler,
  });
  await page.getByRole("link", { name: "Payroll", exact: true }).click();
  await page.getByRole("tab", { name: "Settings" }).click();
  return session;
}

const WRITER = ["hr.payroll_settings.read", "hr.payroll_settings.write"];
const patches = (calls: string[], prefix: string) =>
  calls
    .filter((c) => c.startsWith(prefix))
    .map((c) => JSON.parse(c.slice(c.indexOf("{"))) as Record<string, unknown>);

test("the policy form sends only the changed fields with the version", async ({
  page,
}) => {
  const { calls } = await openSettings(page, WRITER);
  await expect(page.getByText("Pay days & attendance")).toBeVisible();

  await page.getByLabel("Per-day divisor").selectOption("FIXED_26");
  await page.getByLabel("Pay overtime").check();
  await page.getByLabel("Fixed rate per hour (₹)").fill("70");
  await page.getByLabel("Company name").fill("TexaWave Innovations");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Payroll settings saved")).toBeVisible();

  expect(patches(calls, "PATCH /hr/payroll/settings")).toEqual([
    {
      version: 4,
      payDaysMode: "FIXED_26",
      overtimeEnabled: true,
      overtimeRatePerHour: 70,
      companyName: "TexaWave Innovations",
    },
  ]);
});

test("a reader sees the settings read-only and no save button", async ({
  page,
}) => {
  const { calls } = await openSettings(page, ["hr.payroll_settings.read"]);
  await expect(page.getByText("Read-only")).toBeVisible();
  await expect(page.getByLabel("Per-day divisor")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Save settings" })).toHaveCount(
    0,
  );
  await page.getByRole("tab", { name: "Components" }).click();
  await expect(page.getByRole("button", { name: "New component" })).toHaveCount(
    0,
  );
  expect(calls.filter((c) => !c.startsWith("GET"))).toEqual([]);
});

test("adds a component and a template", async ({ page }) => {
  const { calls } = await openSettings(page, WRITER);
  await page.getByRole("tab", { name: "Components" }).click();
  await expect(
    page
      .getByRole("table", { name: "Salary components" })
      .getByText("House Rent Allowance"),
  ).toBeVisible();

  await page.getByRole("button", { name: "New component" }).click();
  const dialog = page.getByRole("dialog", { name: "New component" });
  await dialog.getByLabel("Code").fill("shift_allowance");
  await dialog.getByLabel("Name").fill("Shift Allowance");
  await dialog.getByLabel("Part of the PF wage").uncheck();
  await dialog.getByLabel("Taxable (TDS)").uncheck();
  await dialog.getByRole("button", { name: "Add component" }).click();
  await expect(page.getByText("Component added")).toBeVisible();
  expect(patches(calls, "POST /hr/payroll/salary-components")).toEqual([
    {
      code: "SHIFT_ALLOWANCE",
      kind: "EARNING",
      name: "Shift Allowance",
      displayOrder: 100,
      isProrated: true,
      isTaxable: false,
      pfApplicable: false,
      esiApplicable: true,
    },
  ]);

  await page.getByRole("tab", { name: "Templates" }).click();
  await page.getByRole("button", { name: "New template" }).click();
  const t = page.getByRole("dialog", { name: "New salary template" });
  await t.getByLabel("Code").fill("grade-a");
  await t.getByRole("textbox", { name: /^Name/ }).fill("Grade A");
  await t.getByLabel("Component of template line 1").selectOption("1");
  await t.getByLabel("Value of template line 1").fill("40");
  await t.getByRole("button", { name: "Add line" }).click();
  await t.getByLabel("Component of template line 2").selectOption("3");
  await t
    .getByLabel("Calculation of template line 2")
    .selectOption("REMAINDER");
  await t.getByRole("button", { name: "Create template" }).click();
  await expect(page.getByText("Template created")).toBeVisible();
  expect(patches(calls, "POST /hr/payroll/salary-templates")).toEqual([
    {
      code: "GRADE-A",
      name: "Grade A",
      description: "",
      lines: [
        { componentId: 1, calculationType: "PERCENT_OF_GROSS", value: 40 },
        { componentId: 3, calculationType: "REMAINDER" },
      ],
    },
  ]);
});

test("sets up a tax regime and a PT slab", async ({ page }) => {
  const { calls } = await openSettings(page, WRITER);
  await page.getByRole("tab", { name: "Tax regimes" }).click();
  await page.getByRole("button", { name: "Set up" }).first().click();
  const r = page.getByRole("dialog", { name: /NEW regime/ });
  await r.getByLabel("Standard deduction (₹)").fill("75000");
  await r.getByLabel("Slab 1 to").fill("400000");
  await r.getByRole("button", { name: "Add slab" }).click();
  await r.getByLabel("Slab 2 rate").fill("5");
  await r.getByRole("button", { name: "Save regime" }).click();
  await expect(page.getByText(/NEW regime .* saved/)).toBeVisible();
  const [regime] = patches(calls, "PUT /hr/payroll/tax-regimes");
  expect(regime).toMatchObject({
    regime: "NEW",
    version: 0,
    standardDeduction: 75000,
    cessPercent: 4,
    slabs: [
      { fromIncome: 0, toIncome: 400000, ratePercent: 0 },
      { fromIncome: 400000, toIncome: null, ratePercent: 5 },
    ],
  });

  await page.getByRole("tab", { name: "Professional Tax" }).click();
  await expect(
    page
      .getByRole("table", { name: "Work location PT states" })
      .getByText("Chennai"),
  ).toBeVisible();
  await page.getByRole("button", { name: "New PT slab" }).click();
  const p = page.getByRole("dialog", { name: "New Professional Tax slab" });
  await p.getByLabel("State code").fill("tn");
  await p.getByLabel("Effective from").fill("2026-04-01");
  await p.getByLabel("Gross from (₹/month)").fill("21001");
  await p.getByLabel("PT per month (₹)").fill("208");
  await p.getByLabel("Sep").check();
  await p.getByLabel("Mar").check();
  await p.getByRole("button", { name: "Add slab" }).click();
  await expect(page.getByText("PT slab added for TN")).toBeVisible();
  expect(patches(calls, "POST /hr/payroll/pt-slabs")).toEqual([
    {
      stateCode: "TN",
      minMonthlyWage: 21001,
      maxMonthlyWage: null,
      monthlyAmount: 208,
      applicableMonths: [9, 3],
      effectiveFrom: "2026-04-01",
    },
  ]);
});
