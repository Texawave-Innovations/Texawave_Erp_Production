import { expect, type Page, type Route, test } from "@playwright/test";
import { signInAsAdmin } from "./helpers/auth";

/**
 * Real-browser coverage for HR → Payroll → Payments: creating a batch for a
 * finalized period, the batch's payments, exporting the bank file,
 * processing the batch (with a confirmation step), correcting one payment
 * within the API's allowed transitions, and the no-access/empty states.
 *
 * Signs in for real, then serves /hr/payment-batches, /hr/payments and
 * /hr/payroll/periods from fixtures. Batch rules (finalized period only,
 * one batch per period, bank details, `.all` scope) are covered by
 * apps/api/test/payroll.e2e-spec.ts.
 */

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

const period = (id: number, month: number, status: string) => ({
  id,
  year: 2031,
  month,
  periodStart: `2031-0${month}-01`,
  periodEnd: `2031-0${month}-28`,
  status,
  finalizedAt: null,
  finalizedBy: null,
  runs: [],
  createdAt: "2031-01-01",
});

function payment(id: number, name: string, status: string) {
  return {
    id,
    paymentBatchId: 81,
    employeeId: 500 + id,
    amount: "48200",
    paymentMethod: "BANK_TRANSFER",
    status,
    bankReference: null,
    creditedAt: null,
    employee: {
      id: 500 + id,
      employeeCode: `EMP50${id}`,
      fullName: name,
      bankDetails: {
        bankName: "HDFC Bank",
        accountNumber: "********4321",
        ifscCode: "HDFC0000123",
      },
    },
  };
}

function batch(status = "PENDING") {
  return {
    id: 81,
    payrollPeriodId: 906,
    batchNumber: "BATCH-203107-000001",
    totalEmployees: 2,
    totalAmount: "96400",
    generatedAt: "2031-08-01T10:00:00.000Z",
    status,
    processedAt: null,
    payrollPeriod: { id: 906, year: 2031, month: 7, status: "FINALIZED" },
    generator: { id: 1, fullName: "Super Admin" },
    payments: [
      payment(1, "Asha Rao", status === "PROCESSED" ? "PAID" : "PENDING"),
      payment(2, "Ravi Kumar", "PAID"),
    ],
  };
}

const page1 = <T>(rows: T[]) => ({
  data: rows,
  meta: { page: 1, limit: 20, total: rows.length, totalPages: 1 },
});

async function mockPayments(
  page: Page,
  opts: { batches?: boolean; forbidden?: boolean } = {},
) {
  const state = {
    calls: [] as Array<{ method: string; path: string; body: unknown }>,
  };
  let processed = false;
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
    const record = () =>
      state.calls.push({
        method: req.method(),
        path: p,
        body: req.postDataJSON(),
      });

    if (p === "/hr/payroll/periods")
      return json(
        200,
        page1([period(907, 8, "APPROVED"), period(906, 7, "FINALIZED")]),
      );
    if (p === "/hr/payment-batches" && req.method() === "POST") {
      record();
      return json(201, { data: batch() });
    }
    if (p === "/hr/payment-batches") {
      if (opts.forbidden)
        return json(403, {
          statusCode: 403,
          error: "FORBIDDEN",
          message:
            "You may not view payment batches: this operation covers the whole organization and requires an organization-wide (.all) grant",
        });
      return json(200, page1(opts.batches === false ? [] : [batch()]));
    }
    if (p === "/hr/payment-batches/81/process") {
      record();
      processed = true;
      return json(200, { data: batch("PROCESSED") });
    }
    if (p === "/hr/payment-batches/81/export")
      return json(200, {
        data: {
          fileName: "bank-transfer-batch-81.csv",
          content: '"Employee Code","Employee Name"\n"EMP501","Asha Rao"',
        },
      });
    if (p === "/hr/payment-batches/81")
      return json(200, { data: batch(processed ? "PROCESSED" : "PENDING") });
    if (p.startsWith("/hr/payments/")) {
      record();
      return json(200, { data: payment(1, "Asha Rao", "FAILED") });
    }
    return route.continue();
  });
  return state;
}

async function openPayments(page: Page) {
  await signInAsAdmin(page);
  await page.getByRole("link", { name: "Payroll", exact: true }).click();
  await page.getByRole("tab", { name: "Payments" }).click();
}

test("creates a batch for a finalized period only", async ({ page }) => {
  const state = await mockPayments(page, { batches: false });
  await openPayments(page);
  await expect(page.getByText("No payment batches")).toBeVisible();

  await page.getByRole("button", { name: "New payment batch" }).click();
  const dialog = page.getByRole("dialog", { name: "New payment batch" });
  const periodSelect = dialog.getByLabel("Payroll period");
  // August is approved but not finalized: not offered.
  await expect(
    periodSelect.locator("option", { hasText: "July 2031" }),
  ).toHaveCount(1);
  await expect(
    periodSelect.locator("option", { hasText: "August 2031" }),
  ).toHaveCount(0);

  await dialog.getByRole("button", { name: "Create batch" }).click();
  await expect(dialog.getByText("Choose a payroll period")).toBeVisible();
  expect(state.calls).toHaveLength(0);

  await periodSelect.selectOption({ label: "July 2031" });
  await dialog.getByLabel("Payment method").selectOption("CHEQUE");
  await dialog.getByRole("button", { name: "Create batch" }).click();
  await expect(
    page.getByText("Payment batch BATCH-203107-000001 created"),
  ).toBeVisible();
  expect(state.calls).toEqual([
    {
      method: "POST",
      path: "/hr/payment-batches",
      body: { payrollPeriodId: 906, paymentMethod: "CHEQUE" },
    },
  ]);
  // The new batch opens straight away.
  await expect(
    page.getByRole("dialog", { name: "Payment batch BATCH-203107-000001" }),
  ).toBeVisible();
});

test("exports the bank file and processes the batch after confirming", async ({
  page,
}) => {
  const state = await mockPayments(page);
  await openPayments(page);

  await page
    .getByRole("button", { name: "Open batch BATCH-203107-000001" })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Payment batch BATCH-203107-000001",
  });
  const payments = dialog.getByRole("table", { name: "Payments" });
  await expect(payments.getByText("Asha Rao")).toBeVisible();
  await expect(payments.getByText("HDFC Bank · ********4321")).toHaveCount(2);

  const download = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Export bank file" }).click();
  expect((await download).suggestedFilename()).toBe(
    "bank-transfer-batch-81.csv",
  );

  await dialog.getByRole("button", { name: "Process batch" }).click();
  // Keyboard focus follows the inline confirmation, and comes back.
  await expect(
    dialog.getByRole("button", { name: "Yes, process batch" }),
  ).toBeFocused();
  await dialog.getByRole("button", { name: "Not yet" }).click();
  await expect(
    dialog.getByRole("button", { name: "Process batch" }),
  ).toBeFocused();
  expect(state.calls).toHaveLength(0);

  await dialog.getByRole("button", { name: "Process batch" }).click();
  await dialog.getByRole("button", { name: "Yes, process batch" }).click();
  await expect(
    page.getByText("Batch processed — payments marked paid"),
  ).toBeVisible();
  expect(state.calls).toEqual([
    { method: "POST", path: "/hr/payment-batches/81/process", body: {} },
  ]);
  await expect(
    dialog.getByRole("button", { name: "Process batch" }),
  ).toHaveCount(0);
});

test("corrects one payment within the allowed status changes", async ({
  page,
}) => {
  const state = await mockPayments(page);
  await openPayments(page);
  await page
    .getByRole("button", { name: "Open batch BATCH-203107-000001" })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Payment batch BATCH-203107-000001",
  });

  // A PAID payment is final: no Update button for Ravi.
  await expect(
    dialog.getByRole("button", { name: "Update payment for Ravi Kumar" }),
  ).toHaveCount(0);
  await dialog
    .getByRole("button", { name: "Update payment for Asha Rao" })
    .click();
  const form = dialog.getByRole("form", {
    name: "Update payment for Asha Rao",
  });
  const status = form.getByLabel("Status");
  await expect(status).toBeFocused();
  await expect(status.locator("option")).toHaveText([
    "Pending",
    "Paid",
    "Failed",
    "Cancelled",
  ]);
  await status.selectOption("FAILED");
  await form.getByLabel("Bank reference").fill("UTR123456");
  await form.getByRole("button", { name: "Save payment" }).click();
  await expect(page.getByText("Payment for Asha Rao updated")).toBeVisible();
  expect(state.calls).toEqual([
    {
      method: "PATCH",
      path: "/hr/payments/1",
      body: { status: "FAILED", bankReference: "UTR123456" },
    },
  ]);
});

test("explains missing organization-wide access", async ({ page }) => {
  await mockPayments(page, { forbidden: true });
  await openPayments(page);
  await expect(
    page.getByText("You don't have access to payment batches"),
  ).toBeVisible();
});
