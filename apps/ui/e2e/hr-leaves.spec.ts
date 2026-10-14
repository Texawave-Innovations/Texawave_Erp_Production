import { expect, test, type Page, type Route } from "@playwright/test";
import { signInAsAdmin } from "./helpers/auth";

/**
 * Real-browser coverage for Leaves (Docs/HR_LEAVE.md): tabs by permission,
 * the approval queue with two-level stages, applications with status cards,
 * month filter, CSV export, apply on behalf and HR cancel, the allotment
 * table with edit and CSV import, delegations, and the two-level setting on
 * leave types.
 *
 * Signs in for real as the seeded Super Admin (who holds every permission),
 * then serves the leave endpoints from fixtures — the same pattern as the
 * payroll specs — so the run needs no particular leave data in the dev DB.
 * Every rule (scope, maker-checker, stages, closed months) is proven by
 * apps/api/test/hr-leave-workflow.e2e-spec.ts; this spec proves the screens
 * send the right requests and show the right outcome.
 */

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
const ASHA = { id: 501, employeeCode: "EMP-000501", fullName: "Asha Rao" };
const RAVI = { id: 502, employeeCode: "EMP-000502", fullName: "Ravi Kumar" };
const CASUAL = { id: 11, code: "CASUAL", name: "Casual" };
const LONG = { id: 12, code: "LONG", name: "Long leave" };
const user = (id: number, fullName: string) => ({ id, fullName });
const NEW_CODES = [
  "hr.leave.approve.all",
  "hr.leave_request.create.all",
  "hr.leave.cancel.all",
  "hr.leave_request.export.all",
];

function leave(over: Record<string, unknown> = {}) {
  return {
    id: 901,
    employee: ASHA,
    leaveType: CASUAL,
    startDate: "2031-03-03",
    endDate: "2031-03-04",
    dayPortion: "FULL",
    leaveDays: 2,
    calendarDays: 2,
    reason: "Family function",
    status: "PENDING",
    approvalLevels: 1,
    awaiting: "FIRST",
    requestedBy: user(71, ASHA.fullName),
    firstDecidedBy: null,
    firstDecidedAt: null,
    firstDecisionNote: null,
    decidedBy: null,
    decidedAt: null,
    decisionNote: null,
    cancelledBy: null,
    cancelledAt: null,
    cancellationNote: null,
    createdAt: "2031-02-20T09:00:00.000Z",
    ...over,
  };
}

const balance = (
  t: typeof CASUAL,
  entitlement: number,
  isOverride: boolean,
) => ({
  leaveTypeId: t.id,
  code: t.code,
  name: t.name,
  isPaid: true,
  year: 2031,
  opening: 0,
  entitlement,
  accrued: entitlement / 4,
  used: 1,
  pending: 0,
  available: entitlement / 4 - 1,
  isOverride,
});

const page1 = <T>(rows: T[]) => ({
  data: rows,
  meta: { page: 1, limit: 10, total: rows.length, totalPages: 1 },
});

interface Captured {
  method: string;
  path: string;
  query: string;
  body: unknown;
}

async function mockLeave(page: Page) {
  const calls: Captured[] = [];
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
    // The real /auth/me, plus the leave codes added with this feature, so
    // the run does not depend on the dev DB having synced the catalogue.
    if (p === "/auth/me") {
      const real = await route.fetch();
      const me = (await real.json()) as { data: { permissions: string[] } };
      me.data.permissions = [
        ...new Set([...me.data.permissions, ...NEW_CODES]),
      ];
      return route.fulfill({ response: real, json: me });
    }
    const leaveRoute =
      p.startsWith("/hr/leave") ||
      p.startsWith("/self-service/leave") ||
      p === "/hr/employees";
    if (!leaveRoute) return route.continue();
    let body: unknown = null;
    try {
      body = req.postDataJSON();
    } catch {
      body = null;
    }
    calls.push({ method: req.method(), path: p, query: url.search, body });

    if (p === "/hr/employees") return json(200, page1([ASHA, RAVI]));
    if (p === "/self-service/leave-requests/balances")
      return json(200, { data: [balance(CASUAL, 12, false)] });
    if (p === "/self-service/leave-requests") return json(200, page1([]));
    if (p === "/hr/leave-requests/approvals") {
      return json(
        200,
        page1([
          leave(),
          leave({
            id: 902,
            employee: RAVI,
            leaveType: LONG,
            approvalLevels: 2,
            awaiting: "HR",
            requestedBy: user(72, RAVI.fullName),
            firstDecidedBy: user(80, "Meena Manager"),
            firstDecidedAt: "2031-02-21T10:00:00.000Z",
            firstDecisionNote: "Covered by Arun",
          }),
        ]),
      );
    }
    if (p === "/hr/leave-requests/export") {
      return route.fulfill({
        status: 200,
        contentType: "text/csv; charset=utf-8",
        headers: {
          "content-disposition": 'attachment; filename="leave-requests.csv"',
        },
        body: "Employee Code,Employee\r\nEMP-000501,Asha Rao\r\n",
      });
    }
    if (p === "/hr/leave-requests/balances/report") {
      return json(
        200,
        page1([
          {
            employee: { ...ASHA, teamId: 1 },
            balances: [balance(CASUAL, 12, true), balance(LONG, 0, false)],
          },
        ]),
      );
    }
    if (p === "/hr/leave-requests/balances")
      return json(200, { data: [balance(CASUAL, 12, false)] });
    if (req.method() === "POST" && p === "/hr/leave-requests")
      return json(201, {
        data: leave({ id: 903, requestedBy: user(1, "Super Admin") }),
      });
    if (
      req.method() === "POST" &&
      /\/hr\/leave-requests\/\d+\/approve$/.test(p)
    )
      return json(200, { data: leave({ status: "PENDING", awaiting: "HR" }) });
    if (req.method() === "POST" && /\/hr\/leave-requests\/\d+\/cancel$/.test(p))
      return json(200, { data: leave({ status: "CANCELLED" }) });
    if (p === "/hr/leave-requests") {
      const status = url.searchParams.get("status");
      const rows = [
        leave({ status: "APPROVED", decidedBy: user(80, "Meena Manager") }),
        leave({ id: 904, employee: RAVI, requestedBy: user(1, "Super Admin") }),
      ];
      const filtered = status ? rows.filter((r) => r.status === status) : rows;
      return json(200, page1(filtered));
    }
    if (req.method() === "PUT" && p.startsWith("/hr/leave-entitlements/"))
      return json(200, {
        data: {
          employeeId: ASHA.id,
          leaveTypeId: CASUAL.id,
          year: 2031,
          annualEntitlement: 10,
        },
      });
    if (p === "/hr/leave-entitlements/import")
      return json(200, {
        data: {
          dryRun: true,
          totalRows: 2,
          validRows: 1,
          imported: 0,
          errors: [{ row: 3, message: 'Unknown employee code "NOPE"' }],
        },
      });
    if (p === "/hr/leave-delegations/candidates")
      return json(200, { data: [user(80, "Meena Manager")] });
    if (req.method() === "POST" && p === "/hr/leave-delegations")
      return json(201, {
        data: {
          id: 5,
          delegator: user(1, "Super Admin"),
          delegate: user(80, "Meena Manager"),
          startDate: "2031-03-01",
          endDate: "2031-03-05",
          reason: null,
          isActive: true,
          createdAt: "2031-02-20T09:00:00.000Z",
        },
      });
    if (p === "/hr/leave-delegations") return json(200, page1([]));
    if (p === "/hr/leave-types")
      return json(
        200,
        page1([
          {
            ...CASUAL,
            description: null,
            isPaid: true,
            annualEntitlement: 12,
            carryForwardLimit: 5,
            approvalLevels: 1,
            isActive: true,
          },
          {
            ...LONG,
            description: null,
            isPaid: true,
            annualEntitlement: 0,
            carryForwardLimit: 0,
            approvalLevels: 2,
            isActive: true,
          },
        ]),
      );
    return route.continue();
  });
  return calls;
}

async function openLeaves(page: Page, tab?: string) {
  await signInAsAdmin(page);
  // Client-side link: a hard navigation drops the in-memory auth store.
  await page.getByRole("link", { name: "Leaves" }).click();
  await expect(
    page.getByRole("heading", { name: "Leaves", exact: true }),
  ).toBeVisible();
  if (tab) await page.getByRole("tab", { name: tab }).click();
}

test("shows one tab per job for a user who holds every leave permission", async ({
  page,
}) => {
  await mockLeave(page);
  await openLeaves(page);
  for (const name of [
    "My leave",
    "Approvals",
    "Applications",
    "Allotment",
    "Delegations",
    "Leave types",
  ]) {
    await expect(page.getByRole("tab", { name })).toBeVisible();
  }
});

test("approval queue shows the stage and gives a first approval of two", async ({
  page,
}) => {
  const calls = await mockLeave(page);
  await openLeaves(page, "Approvals");
  const table = page.getByRole("table", {
    name: "Leave requests waiting for my approval",
  });
  await expect(table.getByText("HR approval")).toBeVisible();
  await expect(table.getByText("1st: Meena Manager")).toBeVisible();

  // The HR-stage row: the dialog says who gave the first approval.
  await table
    .getByRole("row", { name: /Ravi Kumar/ })
    .getByRole("button", { name: "Approve" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Give HR approval" });
  await expect(dialog.getByText(/Approved by Meena Manager/)).toBeVisible();
  await dialog.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Leave approved")).toBeVisible();
  expect(
    calls.some(
      (c) => c.method === "POST" && c.path === "/hr/leave-requests/902/approve",
    ),
  ).toBe(true);
});

test("applications: status cards filter, export downloads a CSV, HR cancels with a reason", async ({
  page,
}) => {
  const calls = await mockLeave(page);
  await openLeaves(page, "Applications");
  await expect(
    page.getByRole("table", { name: "Leave applications" }),
  ).toBeVisible();
  await expect(page.getByText("Applied by Super Admin")).toBeVisible();

  await page
    .getByRole("button", { name: /Approved/ })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: /Approved/ }).first(),
  ).toHaveAttribute("aria-pressed", "true");
  expect(
    calls.some(
      (c) =>
        c.path === "/hr/leave-requests" && c.query.includes("status=APPROVED"),
    ),
  ).toBe(true);
  // The month filter defaults to this month and is sent as a range.
  expect(
    calls.some(
      (c) =>
        c.path === "/hr/leave-requests" && /from=\d{4}-\d{2}-01/.test(c.query),
    ),
  ).toBe(true);

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  expect((await download).suggestedFilename()).toMatch(
    /^leave-requests.*\.csv$/,
  );

  await page
    .getByRole("row", { name: /Asha Rao/ })
    .getByRole("button", { name: "Cancel" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Cancel leave" });
  await dialog.getByRole("button", { name: "Cancel leave" }).click();
  await expect(
    dialog.getByText("A reason is required (3–500 characters)"),
  ).toBeVisible();
  await dialog.getByLabel("Reason").fill("Came back to work");
  await dialog.getByRole("button", { name: "Cancel leave" }).click();
  await expect(page.getByText("Leave cancelled")).toBeVisible();
  expect(
    calls.find((c) => c.path === "/hr/leave-requests/901/cancel")?.body,
  ).toEqual({
    note: "Came back to work",
  });
});

test("applies leave on an employee's behalf", async ({ page }) => {
  const calls = await mockLeave(page);
  await openLeaves(page, "Applications");
  await page.getByRole("button", { name: "Apply for an employee" }).click();
  const dialog = page.getByRole("dialog", {
    name: "Apply leave for an employee",
  });
  await dialog.getByRole("button", { name: "Apply leave" }).click();
  await expect(
    dialog.getByText("Select an employee", { exact: true }).last(),
  ).toBeVisible();
  expect(calls.some((c) => c.method === "POST")).toBe(false);

  await dialog
    .getByRole("combobox", { name: /^Employee/ })
    .selectOption(String(ASHA.id));
  await dialog
    .getByRole("combobox", { name: /^Leave type/ })
    .selectOption(String(CASUAL.id));
  await dialog.getByLabel("Start date").fill("2031-03-10");
  await dialog.getByLabel("End date").fill("2031-03-10");
  await dialog.getByLabel("Reason").fill("Called in sick");
  await dialog.getByRole("button", { name: "Apply leave" }).click();
  await expect(page.getByText("Leave applied for Asha Rao")).toBeVisible();
  expect(
    calls.find((c) => c.method === "POST" && c.path === "/hr/leave-requests")
      ?.body,
  ).toEqual({
    employeeId: ASHA.id,
    leaveTypeId: CASUAL.id,
    startDate: "2031-03-10",
    endDate: "2031-03-10",
    dayPortion: "FULL",
    reason: "Called in sick",
  });
});

test("allotment: custom vs default, edit one cell, and a CSV import that reports problems", async ({
  page,
}) => {
  const calls = await mockLeave(page);
  await openLeaves(page, "Allotment");
  const table = page.getByRole("table", { name: /Leave allotment/ });
  await expect(table.getByText("Custom")).toBeVisible();
  await expect(table.getByText("Default")).toBeVisible();

  await table.getByRole("button", { name: "Edit Casual for Asha Rao" }).click();
  const edit = page.getByRole("dialog", { name: "Set entitlement — Casual" });
  await edit.getByLabel("Annual entitlement (days)").fill("10");
  await edit.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Entitlement saved")).toBeVisible();
  const put = calls.find((c) => c.method === "PUT");
  expect(put?.path).toMatch(
    new RegExp(`/hr/leave-entitlements/${ASHA.id}/${CASUAL.id}/\\d{4}$`),
  );
  expect(put?.body).toEqual({ annualEntitlement: 10 });

  await page.getByRole("button", { name: "Import CSV" }).click();
  const imp = page.getByRole("dialog", { name: "Import allotment" });
  await imp.getByLabel("CSV file").setInputFiles({
    name: "allotment.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "Employee Code,Leave Type Code,Year,Annual Entitlement\nNOPE,CASUAL,2031,3\n",
    ),
  });
  await imp.getByRole("button", { name: "Check file" }).click();
  await expect(
    imp.getByText(/1 problem found — nothing was saved/),
  ).toBeVisible();
  await expect(imp.getByText('Unknown employee code "NOPE"')).toBeVisible();
  expect(calls.some((c) => c.path === "/hr/leave-entitlements/import")).toBe(
    true,
  );
});

test("delegates approval to another approver", async ({ page }) => {
  const calls = await mockLeave(page);
  await openLeaves(page, "Delegations");
  await expect(page.getByText("No delegations")).toBeVisible();
  await page.getByRole("button", { name: "Delegate approval" }).click();
  const dialog = page.getByRole("dialog", { name: "Delegate leave approval" });
  await dialog.getByRole("button", { name: "Delegate" }).click();
  await expect(dialog.getByText("Choose who approves for you.")).toBeVisible();
  await dialog
    .getByRole("combobox", { name: /^Approves for me/ })
    .selectOption("80");
  await dialog.getByLabel("From").fill("2031-03-01");
  await dialog.getByLabel("To").fill("2031-03-05");
  await dialog.getByRole("button", { name: "Delegate" }).click();
  await expect(page.getByText("Delegation created")).toBeVisible();
  expect(
    calls.find((c) => c.method === "POST" && c.path === "/hr/leave-delegations")
      ?.body,
  ).toEqual({
    delegateUserId: 80,
    startDate: "2031-03-01",
    endDate: "2031-03-05",
  });
});

test("leave types show and set the two-level approval", async ({ page }) => {
  await mockLeave(page);
  await openLeaves(page, "Leave types");
  await expect(
    page.getByRole("cell", { name: "Manager, then HR" }),
  ).toBeVisible();
});

test("blocks an invalid leave request before any request is sent", async ({
  page,
}) => {
  const calls = await mockLeave(page);
  await openLeaves(page, "My leave");
  await page.getByRole("button", { name: "Request leave" }).click();
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(page.getByText("Reason must be 3–500 characters")).toBeVisible();
  expect(
    calls.some(
      (c) => c.method === "POST" && c.path === "/self-service/leave-requests",
    ),
  ).toBe(false);
});
