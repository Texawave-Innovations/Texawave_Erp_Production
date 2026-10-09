import { expect, type Page, type Route, test } from "@playwright/test";
import { signInAsAdmin } from "./helpers/auth";

/**
 * Real-browser coverage for HR → Compliance (PF and ESI): looking up one
 * employee's registration, creating/updating it with client-side format
 * checks, and the read-only contributions list.
 *
 * The first test runs against the real API (the tabs must load without
 * errors on whatever the dev DB holds). The rest serve /hr/employees and
 * /hr/compliance/* from fixtures, because a dev DB rarely has employees or
 * payroll-generated contributions. The scope rules behind these endpoints
 * are covered by apps/api/test/payroll.e2e-spec.ts.
 */

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
const ASHA = { id: 501, employeeCode: "EMP501", fullName: "Asha Rao" };
const RAVI = { id: 502, employeeCode: "EMP502", fullName: "Ravi Kumar" };

const page1 = <T>(rows: T[]) => ({
  data: rows,
  meta: { page: 1, limit: 20, total: rows.length, totalPages: 1 },
});

async function openCompliance(page: Page) {
  await signInAsAdmin(page);
  await page.getByRole("link", { name: "Compliance", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Compliance", level: 1 }),
  ).toBeVisible();
}

test("PF and ESI tabs load against the real API", async ({ page }) => {
  await openCompliance(page);
  await expect(
    page.getByRole("heading", { name: "PF registration" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("table", { name: "PF contributions" })
      .or(page.getByText("No PF contributions")),
  ).toBeVisible();

  await page.getByRole("tab", { name: "ESI" }).click();
  await expect(
    page.getByRole("heading", { name: "ESI registration" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("table", { name: "ESI contributions" })
      .or(page.getByText("No ESI contributions")),
  ).toBeVisible();
});

/** Fixtures: Asha has no PF profile; Ravi has an ESI profile. Records PUTs
 * and the contributions queries. */
async function mockCompliance(page: Page) {
  const state = {
    puts: [] as Array<{ path: string; body: unknown }>,
    contributionQueries: [] as string[],
  };
  await page.route(`${API}/hr/**`, async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const json = (status: number, body: unknown) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    const p = url.pathname;

    if (p === "/hr/employees") return json(200, page1([ASHA, RAVI]));
    if (req.method() === "PUT" && p.startsWith("/hr/compliance/")) {
      const body = req.postDataJSON() as Record<string, unknown>;
      state.puts.push({ path: p, body });
      return json(200, {
        data: {
          id: 1,
          employeeId: ASHA.id,
          effectiveFrom: "2026-10-09T00:00:00.000Z",
          effectiveTo: null,
          updatedAt: "2026-10-09T10:00:00.000Z",
          employee: ASHA,
          ...body,
        },
      });
    }
    if (p === `/hr/compliance/pf/profiles/${ASHA.id}`)
      return json(404, {
        statusCode: 404,
        error: "RESOURCE_NOT_FOUND",
        message: "Employee PF profile not found",
      });
    if (p === `/hr/compliance/esi/profiles/${RAVI.id}`)
      return json(200, {
        data: {
          id: 7,
          employeeId: RAVI.id,
          esiApplicable: true,
          insuranceNumber: "3100123456",
          effectiveFrom: "2026-01-01T00:00:00.000Z",
          effectiveTo: null,
          updatedAt: "2026-05-02T00:00:00.000Z",
          employee: RAVI,
        },
      });
    if (p === "/hr/compliance/pf/contributions") {
      state.contributionQueries.push(url.search);
      return json(
        200,
        page1([
          {
            id: 11,
            payrollPeriodId: 900,
            payrollEntryId: 3001,
            employeeId: ASHA.id,
            pfIncluded: true,
            pfWage: "15000",
            employeeContribution: "1800",
            employerContribution: "1800",
            paymentStatus: "PENDING",
            salaryCredited: false,
            employee: ASHA,
            payrollPeriod: {
              id: 900,
              year: 2031,
              month: 5,
              status: "FINALIZED",
            },
          },
        ]),
      );
    }
    if (p === "/hr/payroll/periods")
      return json(
        200,
        page1([
          {
            id: 900,
            year: 2031,
            month: 5,
            periodStart: "2031-05-01",
            periodEnd: "2031-05-31",
            status: "FINALIZED",
            finalizedAt: null,
            finalizedBy: null,
            runs: [],
            createdAt: "2031-04-01",
          },
        ]),
      );
    return route.continue();
  });
  return state;
}

test("registers an employee for PF, checking the UAN format first", async ({
  page,
}) => {
  const state = await mockCompliance(page);
  await openCompliance(page);

  await page
    .getByLabel("Employee", { exact: true })
    .selectOption(String(ASHA.id));
  const form = page.getByRole("form", { name: "PF profile for Asha Rao" });
  await expect(form.getByText("No PF profile yet")).toBeVisible();

  // An 11-digit UAN is caught before any request.
  await form.getByLabel("UAN").fill("10012345678");
  await form.getByRole("button", { name: "Save PF profile" }).click();
  await expect(form.getByText("UAN is 12 digits")).toBeVisible();
  expect(state.puts).toHaveLength(0);

  await form.getByLabel("UAN").fill("100123456789");
  await form.getByLabel("PF number").fill("MH/PUN/0012345/000/0001");
  await form.getByLabel("Effective from").fill("2026-04-01");
  await form.getByRole("button", { name: "Save PF profile" }).click();
  await expect(page.getByText("PF profile saved for Asha Rao")).toBeVisible();
  expect(state.puts).toEqual([
    {
      path: `/hr/compliance/pf/profiles/${ASHA.id}`,
      body: {
        pfApplicable: true,
        uan: "100123456789",
        pfNumber: "MH/PUN/0012345/000/0001",
        effectiveFrom: "2026-04-01",
      },
    },
  ]);
});

test("loads an existing ESI profile into the form and updates it", async ({
  page,
}) => {
  const state = await mockCompliance(page);
  await openCompliance(page);
  await page.getByRole("tab", { name: "ESI" }).click();

  await page
    .getByLabel("Employee", { exact: true })
    .selectOption(String(RAVI.id));
  const form = page.getByRole("form", { name: "ESI profile for Ravi Kumar" });
  await expect(form.getByLabel("ESI (IP) number")).toHaveValue("3100123456");
  await expect(form.getByLabel("Effective from")).toHaveValue("2026-01-01");
  await expect(form.getByLabel("ESI applicable")).toBeChecked();

  await form.getByLabel("ESI applicable").uncheck();
  await form.getByLabel("Effective to").fill("2025-12-31");
  await form.getByRole("button", { name: "Save ESI profile" }).click();
  await expect(
    form.getByText("End date cannot be before start date"),
  ).toBeVisible();
  expect(state.puts).toHaveLength(0);

  await form.getByLabel("Effective to").fill("2026-09-30");
  await form.getByRole("button", { name: "Save ESI profile" }).click();
  await expect(
    page.getByText("ESI profile saved for Ravi Kumar"),
  ).toBeVisible();
  expect(state.puts[0]?.body).toEqual({
    esiApplicable: false,
    insuranceNumber: "3100123456",
    effectiveFrom: "2026-01-01",
    effectiveTo: "2026-09-30",
  });
});

test("lists PF contributions and filters them server-side", async ({
  page,
}) => {
  const state = await mockCompliance(page);
  await openCompliance(page);

  const table = page.getByRole("table", { name: "PF contributions" });
  await expect(table.getByText("Asha Rao")).toBeVisible();
  await expect(table.getByText("₹ 15,000.00")).toBeVisible();
  await expect(table.getByText("₹ 1,800.00")).toHaveCount(2);

  await page
    .getByLabel("Filter by payroll period")
    .selectOption({ label: "May 2031" });
  await page.getByLabel("Filter by payment status").selectOption("PENDING");
  await expect
    .poll(() => state.contributionQueries.at(-1))
    .toMatch(
      /payrollPeriodId=900.*paymentStatus=PENDING|paymentStatus=PENDING.*payrollPeriodId=900/,
    );
});
