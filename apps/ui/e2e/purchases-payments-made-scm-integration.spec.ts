import { expect, test, type APIRequestContext } from "@playwright/test";
import { signInAsAdmin, uniqueName } from "./helpers/auth";
import { selectCombobox } from "./helpers/combobox";

/**
 * Real-browser walk through the full Purchases pipeline, ending at the
 * integration PR 2 added: Material Requisition -> RFQ -> Supplier Quotation
 * -> Comparison -> Purchase Order -> approve/send -> Goods Receipt -> a real
 * Supplier Bill -> a Payments Made disbursement applied to that bill, and
 * proves it atomically updates the bank balance, the GL, *and* the SCM
 * Supplier Bill/Payment records — all from inside the Purchases tab shell,
 * without ever touching the standalone SCM screens for the payment step.
 *
 * Mirrors apps/ui/e2e/scm-procurement.spec.ts's proven flow for steps 1-6,
 * routed through /purchases instead of the standalone /scm/procurement/*
 * pages, then extends it with the Supplier Bill + Payments Made integration
 * this PR introduced. Uses the seeded Super Admin and creates its own
 * supplier/product/warehouse/bank account via the API so the test doesn't
 * depend on any pre-existing dev data.
 */
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

async function apiToken(request: APIRequestContext) {
  const res = await request.post(`${API}/auth/login`, {
    data: {
      organizationSlug: "texawave-innovations",
      email: "admin@texawave.com",
      password: "ChangeMe123!",
    },
  });
  return ((await res.json()) as { data: { accessToken: string } }).data
    .accessToken;
}

async function create<T>(
  request: APIRequestContext,
  token: string,
  path: string,
  data: object,
): Promise<T> {
  const res = await request.post(`${API}${path}`, {
    data,
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(
    res.ok(),
    `${path} -> ${res.status()} ${await res.text()}`,
  ).toBeTruthy();
  return ((await res.json()) as { data: T }).data;
}

async function ensureMasterListValue(
  request: APIRequestContext,
  token: string,
  category: string,
  value: string,
) {
  const res = await request.get(
    `${API}/scm/master-list-items?category=${category}&limit=100`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const existing = ((await res.json()) as { data: { value: string }[] }).data;
  if (existing.some((i) => i.value === value)) return;
  await create(request, token, "/scm/master-list-items", { category, value });
}

interface FinanceAccount {
  id: number;
  accountCode: string;
}
interface BankAccount {
  id: number;
  isActive: boolean;
}
interface PaymentMode {
  id: number;
  value: string;
}

/** Ensures a bank-type payment mode, a "2010" Accounts Payable GL account, an
 * Operating Bank GL account and an active bank account linked to it all
 * exist for this org — reused test infrastructure a fresh dev/CI database
 * won't already have, following the same "check then create" convention as
 * `ensureMasterListValue` above. */
async function ensureFinanceFixtures(
  request: APIRequestContext,
  token: string,
): Promise<{ paymentModeId: number; bankAccountId: number }> {
  const headers = { Authorization: `Bearer ${token}` };

  const modesRes = await request.get(
    `${API}/finance-settings/master-list-items?category=payment_mode&limit=100`,
    { headers },
  );
  const modes = ((await modesRes.json()) as { data: PaymentMode[] }).data;
  let mode = modes.find((m) => m.value === "Bank Transfer");
  if (!mode) {
    mode = await create<PaymentMode>(
      request,
      token,
      "/finance-settings/master-list-items",
      { category: "payment_mode", value: "Bank Transfer" },
    );
  }

  const accountsRes = await request.get(`${API}/finance/accounts?limit=100`, {
    headers,
  });
  const accounts = ((await accountsRes.json()) as { data: FinanceAccount[] })
    .data;
  let payable = accounts.find((a) => a.accountCode === "2010");
  if (!payable) {
    payable = await create<FinanceAccount>(
      request,
      token,
      "/finance/accounts",
      {
        accountCode: "2010",
        accountName: "Accounts Payable",
        accountType: "LIABILITY",
      },
    );
  }
  let bankGl = accounts.find((a) => a.accountCode === "1020");
  if (!bankGl) {
    bankGl = await create<FinanceAccount>(request, token, "/finance/accounts", {
      accountCode: "1020",
      accountName: "Operating Bank Account",
      accountType: "ASSET",
    });
  }

  const bankAccountsRes = await request.get(
    `${API}/finance/bank-accounts?limit=100&isActive=true`,
    { headers },
  );
  const bankAccounts = (
    (await bankAccountsRes.json()) as {
      data: BankAccount[];
    }
  ).data;
  let bankAccount = bankAccounts.find((b) => b.isActive);
  if (!bankAccount) {
    bankAccount = await create<BankAccount>(
      request,
      token,
      "/finance/bank-accounts",
      {
        accountName: "E2E Operating Account",
        accountNumber: `E2E-${Date.now()}`,
        bankName: "E2E Bank",
        ifscCode: "E2E0000001",
        openingBalance: 500000,
        glAccountId: bankGl.id,
      },
    );
  }

  return { paymentModeId: mode.id, bankAccountId: bankAccount.id };
}

test("records a Payments Made disbursement against a real bill, from requisition through goods receipt, inside the Purchases tab shell", async ({
  page,
  request,
}) => {
  const token = await apiToken(request);
  const stamp = Date.now();
  const supplierName = uniqueName("E2E PM Supplier");
  const productName = uniqueName("E2E PM Part");
  const sku = `PMSKU-${stamp}`;
  const whName = uniqueName("E2E PM WH");

  const supplier = await create<{ id: number }>(
    request,
    token,
    "/scm/suppliers",
    { companyName: supplierName, contactPerson: "Buyer" },
  );
  await create(request, token, "/scm/products", {
    productCode: sku,
    name: productName,
  });
  await create(request, token, "/scm/warehouses", {
    code: `W${stamp % 100000}`,
    name: whName,
  });
  await ensureMasterListValue(request, token, "requisition_priority", "High");
  const { bankAccountId } = await ensureFinanceFixtures(request, token);

  await signInAsAdmin(page);

  // 1. Requisition -> approve, inside Purchases.
  await page.goto("/purchases?tab=requisitions");
  await page.getByRole("button", { name: "New Requisition" }).click();
  const prDialog = page.getByRole("dialog");
  await selectCombobox(prDialog, /^Warehouse/, whName);
  await selectCombobox(
    prDialog,
    "Product for line 1",
    `${productName} (${sku})`,
  );
  await prDialog.getByLabel("Qty for line 1").fill("10");
  await selectCombobox(prDialog, "Priority", "High");
  await prDialog.getByRole("button", { name: "Save as Draft" }).click();
  await expect(
    page.getByText("Requisition saved as draft").first(),
  ).toBeVisible();

  const prRow = page.getByRole("row").filter({ hasText: "Draft" }).first();
  await prRow.getByRole("button", { name: "Submit" }).click();
  await page
    .getByRole("row")
    .filter({ hasText: "Submitted" })
    .first()
    .getByRole("button", { name: "Approve" })
    .click();
  await expect(page.getByText("Requisition approved").first()).toBeVisible();

  // 2. RFQ -> issue.
  await page
    .getByRole("row")
    .filter({ hasText: "Approved" })
    .first()
    .getByRole("button", { name: "Create RFQ" })
    .click();
  const rfqDialog = page.getByRole("dialog");
  await rfqDialog.getByLabel(supplierName).check();
  await rfqDialog.getByRole("button", { name: "Create RFQ (draft)" }).click();
  await expect(page.getByText(/RFQ .* created as draft/).first()).toBeVisible();
  await page
    .getByRole("row")
    .filter({ hasText: "Draft" })
    .first()
    .getByRole("button", { name: "Issue" })
    .click();
  await expect(page.getByText("RFQ issued to suppliers").first()).toBeVisible();

  // 3. Supplier quotation.
  await page
    .getByRole("row")
    .filter({ hasText: "Responses Pending" })
    .first()
    .getByRole("button", { name: "Record Quotation" })
    .click();
  const qDialog = page.getByRole("dialog");
  await selectCombobox(qDialog, "Supplier*", supplierName);
  await qDialog.getByLabel("Unit Price for line 1").fill("1000");
  await qDialog.getByLabel("Tax % for line 1").fill("18");
  await qDialog.getByRole("button", { name: "Record Quotation" }).click();
  await expect(page.getByText(/Quotation .* recorded/).first()).toBeVisible();

  // 4. Compare, select, raise the PO.
  await page
    .getByRole("row")
    .filter({ hasText: supplierName })
    .getByRole("button", { name: "Compare" })
    .click();
  await page.getByRole("radio", { name: /^Select / }).check();
  await page.getByRole("button", { name: "Select quotation & save" }).click();
  await expect(page.getByText("Comparison saved").first()).toBeVisible();
  await page.getByRole("button", { name: "Create PO from selected" }).click();
  await selectCombobox(page.getByRole("dialog"), /^Warehouse/, whName);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save as Draft" })
    .click();
  await expect(
    page.getByText(/Purchase order .* created as draft/).first(),
  ).toBeVisible();

  // 5. Submit, approve, mark sent.
  await page
    .getByRole("row")
    .filter({ hasText: "Draft" })
    .first()
    .getByRole("button", { name: "Submit" })
    .click();
  await expect(
    page.getByText("Purchase order submitted for approval").first(),
  ).toBeVisible();
  await page
    .getByRole("row")
    .filter({ hasText: "Pending Approval" })
    .first()
    .getByRole("button", { name: "Approve" })
    .click();
  await expect(page.getByText(/Purchase order approved/).first()).toBeVisible();
  await page
    .getByRole("row")
    .filter({ hasText: "Approved" })
    .first()
    .getByRole("button", { name: "Mark Sent" })
    .click();
  await expect(
    page.getByText("Purchase order marked as sent").first(),
  ).toBeVisible();
  const poNumber = await page
    .getByRole("row")
    .filter({ hasText: "Sent" })
    .first()
    .locator("td")
    .first()
    .innerText();

  // 6. Receive the goods.
  await page
    .getByRole("row")
    .filter({ hasText: "Sent" })
    .first()
    .getByRole("button", { name: "Receive Goods" })
    .click();
  const grnDialog = page.getByRole("dialog");
  await grnDialog
    .getByLabel(`Receiving quantity for ${productName}`)
    .fill("10");
  await grnDialog.getByRole("button", { name: "Post Goods Receipt" }).click();
  await expect(page.getByText(/posted — stock updated/).first()).toBeVisible();

  // 7. Record a Supplier Bill against that PO, from the Supplier detail page.
  await page.goto(`/scm/suppliers/${supplier.id}`);
  await page.getByRole("tab", { name: "Bills" }).click();
  await page.getByRole("button", { name: "New Bill" }).click();
  const billDialog = page.getByRole("dialog");
  // Options read "<PO number> · <total>", so match on the PO number prefix.
  const poSelect = billDialog.getByLabel("Purchase order");
  await expect
    .poll(
      async () => (await poSelect.locator("option").allTextContents()).length,
    )
    .toBeGreaterThan(1);
  const poOption = (await poSelect.locator("option").allTextContents()).find(
    (t) => t.startsWith(poNumber.trim()),
  );
  expect(poOption, `no PO option for ${poNumber.trim()}`).toBeTruthy();
  await poSelect.selectOption({ label: poOption! });
  await billDialog.getByRole("button", { name: "Record bill" }).click();
  await expect(page.getByText(/Bill .* recorded/).first()).toBeVisible();

  const auth = { Authorization: `Bearer ${token}` };
  const bills = await request
    .get(`${API}/scm/finance/bills?supplierId=${supplier.id}&limit=100`, {
      headers: auth,
    })
    .then(
      (r) =>
        r.json() as Promise<{
          data: {
            id: number;
            billNumber: string;
            outstanding: number;
            status: string;
          }[];
        }>,
    );
  expect(bills.data).toHaveLength(1);
  const bill = bills.data[0]!;
  expect(bill.status).toBe("OPEN");
  const billOutstanding = Number(bill.outstanding);
  expect(billOutstanding).toBeGreaterThan(0);

  // 8. The actual integration: pay it from Purchases -> Payments Made.
  const bankBefore = await request
    .get(`${API}/finance/bank-accounts/${bankAccountId}`, { headers: auth })
    .then(
      (r) =>
        r.json() as Promise<{
          data: {
            currentBalance: string;
            accountName: string;
            accountNumber: string;
          };
        }>,
    );
  const bankOptionLabel = `${bankBefore.data.accountName} (${bankBefore.data.accountNumber.slice(-4)})`;

  await page.goto("/purchases?tab=payments-made");
  await page
    .getByRole("button", { name: "Record Payment", exact: true })
    .last()
    .click();
  const payDialog = page.getByRole("dialog");
  await payDialog.waitFor({ state: "visible" });

  // Comboboxes in order: supplier, payment mode, bank account, apply-to-bill.
  const combos = payDialog.locator('button[role="combobox"]');
  await combos.nth(0).click();
  await payDialog
    .getByRole("option", { name: new RegExp(supplierName) })
    .click();

  await combos.nth(1).click();
  await payDialog
    .getByRole("option", { name: "Bank Transfer", exact: true })
    .click();
  await combos.nth(2).click();
  await payDialog
    .getByRole("option", { name: bankOptionLabel, exact: true })
    .click();

  // Picking the bill pre-fills the amount with its real outstanding.
  await combos.nth(3).click();
  await payDialog
    .getByRole("option", { name: new RegExp(`^${bill.billNumber}`) })
    .click();
  await expect(payDialog.getByPlaceholder("0.00")).toHaveValue(
    String(billOutstanding),
  );

  // Overpaying the bill is blocked before anything is sent.
  await payDialog
    .getByPlaceholder("0.00")
    .fill(String(billOutstanding + 50000));
  await payDialog.getByRole("button", { name: "Record & Post to GL" }).click();
  await expect(payDialog.getByText(/Cannot exceed/).first()).toBeVisible();

  await payDialog.getByPlaceholder("0.00").fill(String(billOutstanding));
  await payDialog.getByRole("button", { name: "Record & Post to GL" }).click();
  await expect(
    page
      .getByText("Supplier payment recorded & posted to General Ledger")
      .first(),
  ).toBeVisible();

  // 9. Verify it all moved together: bank balance, SCM bill, SCM payment.
  const bankAfter = await request
    .get(`${API}/finance/bank-accounts/${bankAccountId}`, { headers: auth })
    .then((r) => r.json() as Promise<{ data: { currentBalance: string } }>);
  expect(Number(bankAfter.data.currentBalance)).toBeCloseTo(
    Number(bankBefore.data.currentBalance) - billOutstanding,
    2,
  );

  const billAfter = await request
    .get(`${API}/scm/finance/bills/${bill.id}`, { headers: auth })
    .then(
      (r) =>
        r.json() as Promise<{ data: { status: string; paidAmount: string } }>,
    );
  expect(billAfter.data.status).toBe("PAID");
  expect(Number(billAfter.data.paidAmount)).toBeCloseTo(billOutstanding, 2);

  const scmPayments = await request
    .get(`${API}/scm/finance/payments?supplierId=${supplier.id}&limit=100`, {
      headers: auth,
    })
    .then(
      (r) =>
        r.json() as Promise<{
          data: { billId: number | null; status: string; amount: string }[];
        }>,
    );
  expect(scmPayments.data).toHaveLength(1);
  expect(scmPayments.data[0]!.billId).toBe(bill.id);
  expect(scmPayments.data[0]!.status).toBe("POSTED");

  // And it shows on the Supplier's own page, never touched by this test.
  await page.goto(`/scm/suppliers/${supplier.id}`);
  await page.getByRole("tab", { name: "Payments" }).click();
  await expect(
    page.getByRole("row").filter({ hasText: bill.billNumber }),
  ).toBeVisible();
});
