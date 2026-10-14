import { expect, test } from "@playwright/test";
import {
  type MockAnswer,
  type MockRequest,
  page1,
  signInWithMockedApi,
} from "./helpers/mock-api";

/**
 * Tax declarations and Form 16 (Docs/PAYROLL_AND_COMPLIANCE.md §4.13,
 * §4.14): HR verifies with accepted amounts (never their own), enters a
 * declaration on someone's behalf and opens Form 16; an employee fills in,
 * submits and then sees their declaration locked, and downloads Form 16
 * from the portal. API fully mocked.
 */

const ME = 1;
const FY = (() => {
  const d = new Date();
  const start = d.getMonth() + 1 >= 4 ? d.getFullYear() : d.getFullYear() - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
})();

function declaration(
  id: number,
  employee: { id: number; fullName: string; userId: number },
  overrides: Record<string, unknown> = {},
) {
  return {
    id,
    employeeId: employee.id,
    financialYear: FY,
    regime: "OLD",
    status: "SUBMITTED",
    submittedAt: "2026-10-01T09:00:00.000Z",
    verifiedAt: null,
    verificationNote: null,
    version: 2,
    employee: { ...employee, employeeCode: `EMP-${employee.id}`, teamId: 3 },
    verifier: null,
    section80c: "150000",
    section80d: "25000",
    hraExemption: "60000",
    homeLoanInterest: "0",
    otherDeductions: "0",
    otherIncome: "10000",
    previousEmployerIncome: "0",
    previousEmployerTds: "0",
    verifiedSection80c: null,
    verifiedSection80d: null,
    verifiedHraExemption: null,
    verifiedHomeLoanInterest: null,
    verifiedOtherDeductions: null,
    ...overrides,
  };
}

const ASHA = { id: 501, fullName: "Asha Rao", userId: 9001 };
const SELF = { id: 7, fullName: "Tester", userId: ME };

const FORM16 = {
  financialYear: FY,
  employer: {
    name: "TexaWave Innovations",
    address: null,
    pan: "ABCDE1234F",
    tan: "CHEA12345B",
  },
  employee: {
    employeeCode: "EMP-501",
    fullName: "Asha Rao",
    pan: "******234F",
  },
  regime: "OLD",
  months: [
    {
      year: 2026,
      month: 4,
      grossEarnings: 50000,
      taxableEarnings: 50000,
      tds: 1590,
    },
  ],
  totals: {
    grossEarnings: 50000,
    taxableSalary: 50000,
    otherIncome: 0,
    previousEmployerIncome: 0,
    deductions: 50000,
    taxableIncome: 0,
    taxPayable: 0,
    tdsDeducted: 1590,
    previousEmployerTds: 0,
  },
};

const bodiesOf = (calls: string[], prefix: string) =>
  calls
    .filter((c) => c.startsWith(prefix))
    .map((c) => JSON.parse(c.slice(c.indexOf("{"))) as Record<string, unknown>);

test("HR verifies another person's declaration with the accepted amounts; never their own", async ({
  page,
}) => {
  const handler = (req: MockRequest): MockAnswer | undefined => {
    if (req.pathname === "/hr/tax-declarations" && req.method === "GET")
      return { body: page1([declaration(21, ASHA), declaration(22, SELF)]) };
    if (req.pathname === "/hr/tax-declarations/21/verify")
      return { body: { data: declaration(21, ASHA, { status: "VERIFIED" }) } };
    if (req.pathname === `/hr/tax-declarations/form16/${ASHA.id}/${FY}`)
      return { body: { data: FORM16 } };
    if (req.pathname.startsWith("/hr/employees")) return { body: page1([]) };
    return undefined;
  };
  const { calls } = await signInWithMockedApi(page, {
    workspace: "hr",
    userId: ME,
    permissions: [
      "hr.workspace.access",
      "hr.employee.read.all",
      "hr.tax_declaration.read.all",
      "hr.tax_declaration.approve.all",
    ],
    menu: [{ code: "hr-payroll", label: "Payroll", path: "/hr/payroll" }],
    handler,
  });
  await page.getByRole("link", { name: "Payroll", exact: true }).click();
  await page.getByRole("tab", { name: "Tax declarations" }).click();

  const table = page.getByRole("table", { name: "Tax declarations" });
  await expect(
    table.getByText("Your own — someone else must verify"),
  ).toBeVisible();
  await expect(table.getByRole("button", { name: "Verify" })).toHaveCount(1);
  await table.getByRole("button", { name: "Verify" }).click();

  const dialog = page.getByRole("dialog", {
    name: new RegExp(`Verify Asha Rao — FY ${FY}`),
  });
  await dialog
    .getByLabel("80C investments (other than PF) — accepted")
    .fill("120000");
  await dialog.getByRole("button", { name: "Verify" }).click();
  await expect(page.getByText("Declaration verified")).toBeVisible();
  expect(bodiesOf(calls, "POST /hr/tax-declarations/21/verify")).toEqual([
    {
      decision: "VERIFIED",
      verifiedSection80c: 120000,
      verifiedSection80d: 25000,
      verifiedHraExemption: 60000,
      verifiedHomeLoanInterest: 0,
      verifiedOtherDeductions: 0,
    },
  ]);

  await table.getByRole("button", { name: "Form 16" }).first().click();
  const f16 = page.getByRole("dialog", { name: /Form 16 — Asha Rao/ });
  await expect(f16.getByText("TDS deducted")).toBeVisible();
  await expect(f16.getByText("₹ 1,590.00").first()).toBeVisible();
});

test("an employee saves, submits and then sees their declaration locked; Form 16 from the portal", async ({
  page,
}) => {
  let saved: Record<string, unknown> | null = null;
  const handler = (req: MockRequest): MockAnswer | undefined => {
    if (
      req.pathname === "/self-service/tax-declarations" &&
      req.method === "GET"
    )
      return { body: { data: saved ? [saved] : [] } };
    if (req.pathname === `/self-service/tax-declarations/${FY}`) {
      const body = req.body as { submit?: boolean; regime: string };
      saved = declaration(30, SELF, {
        regime: body.regime,
        status: body.submit ? "SUBMITTED" : "DRAFT",
        version: 1,
      });
      return { body: { data: saved } };
    }
    if (req.pathname === `/self-service/form16/${FY}`)
      return { body: { data: FORM16 } };
    if (req.pathname === `/self-service/form16/${FY}/pdf`)
      return { file: "%PDF-1.7 stub", contentType: "application/pdf" };
    return undefined;
  };
  const { calls } = await signInWithMockedApi(page, {
    workspace: "portal",
    userId: ME,
    permissions: [
      "employee_self_service.profile.read",
      "employee_self_service.tax_declaration.read",
      "employee_self_service.tax_declaration.write",
      "employee_self_service.form16.read",
    ],
    menu: [{ code: "portal-tax", label: "My Tax", path: "/portal/tax" }],
    handler,
  });
  await page
    .getByRole("navigation", { name: "My Portal Navigation" })
    .getByRole("link", { name: "My Tax" })
    .click();
  await expect(page.getByRole("heading", { name: "My tax" })).toBeVisible();

  await page.getByLabel("Tax regime").selectOption("OLD");
  await page
    .getByLabel("80C investments (other than PF) (₹ / year)")
    .fill("150000");
  await page.getByRole("button", { name: "Submit for verification" }).click();
  await expect(
    page.getByText("Declaration submitted for verification"),
  ).toBeVisible();
  await expect(page.getByText("Locked")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Submit for verification" }),
  ).toHaveCount(0);

  const [body] = bodiesOf(calls, `PUT /self-service/tax-declarations/${FY}`);
  expect(body).toMatchObject({
    version: 0,
    regime: "OLD",
    section80c: 150000,
    submit: true,
  });

  await expect(page.getByText("TDS deducted")).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download Form 16 (PDF)" }).click();
  expect((await download).suggestedFilename()).toBe(`Form16-EMP-501-${FY}.pdf`);
  // Self-service only — never an HR route.
  expect(calls.filter((c) => / \/hr\//.test(c))).toEqual([]);
});
