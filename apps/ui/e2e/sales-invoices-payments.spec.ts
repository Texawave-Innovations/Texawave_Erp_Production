import { expect, test, type Page } from "@playwright/test";
import {
  page1,
  signInWithMockedApi,
  type MockRequest,
} from "./helpers/mock-api";

// Invoices, payments received and delivery challans against a mocked API:
// invoice detail → record payment (balance check) → delivery challan;
// proforma → tax; a new invoice with the server preview; the Payments
// Received page (alerts, overdue filter, permissions); a new challan.
// Server rules: apps/api/test/sales-documents.e2e-spec.ts and
// sales-payments-rdc.e2e-spec.ts.

const MANAGER = [
  "sales.dashboard.read",
  "sales.customer.read",
  "sales.master.read",
  "sales.invoice.read",
  "sales.invoice.write",
  "sales.invoice.delete",
  "sales.invoice.send",
  "sales.invoice_payment.write",
  "sales.payment.read",
  "sales.delivery_challan.read",
  "sales.delivery_challan.write",
];

const MENU = [
  { code: "sales-dashboard", label: "Dashboard", path: "/sales/dashboard" },
  {
    code: "sales-proforma-invoices",
    label: "Proforma Invoices",
    path: "/sales/proforma-invoices",
  },
  {
    code: "sales-tax-invoices",
    label: "Tax Invoices",
    path: "/sales/tax-invoices",
  },
  {
    code: "sales-delivery-challans",
    label: "Delivery Challans",
    path: "/sales/delivery-challans",
  },
  {
    code: "sales-payments",
    label: "Payments Received",
    path: "/sales/payments",
  },
];

const SNAPSHOT = {
  customerId: 7,
  customerCode: "CUS-IN-001",
  companyName: "Global Enterprises Pvt Ltd",
  contactPerson: "Jane",
  email: "jane@global.test",
  mobile: "+91 9876543210",
  gstin: null,
  stateCode: "33",
  stateName: "Tamil Nadu",
  billingAddress: null,
  shippingAddress: null,
};

const invoice = (over: Record<string, unknown> = {}) => ({
  id: 21,
  invoiceType: "TAX",
  invoiceNumber: "TW/IN/26-27/0001",
  customerId: 7,
  customerSnapshot: SNAPSHOT,
  invoiceDate: "2026-08-28T00:00:00.000Z",
  dueDate: "2026-09-27T00:00:00.000Z",
  paymentTerms: "30 Days",
  sourceQuotation: null,
  sourceInvoice: null,
  convertedTo: null,
  supplierStateCode: "33",
  placeOfSupply: "33",
  taxMode: "INTRA",
  transportDescription: null,
  transportCharge: "0",
  transportHsn: null,
  cgstRate: "9",
  sgstRate: "9",
  igstRate: "0",
  itemsSubtotal: "600",
  taxableAmount: "600",
  cgstAmount: "54",
  sgstAmount: "54",
  igstAmount: "0",
  roundOff: "0",
  totalAmount: "708",
  amountReceived: "200",
  balance: "508",
  amountInWords: "Rupees Seven Hundred Eight Only",
  bankDetails: null,
  sealName: null,
  signatureName: null,
  sealItemId: null,
  signatureItemId: null,
  preparedBy: "Rafic",
  terms: null,
  status: "PARTIALLY_PAID",
  convertedAt: null,
  lines: [
    {
      lineNo: 1,
      description: "Control panel",
      hsnCode: "8471",
      quantity: "1",
      unitPrice: "600",
      amount: "600",
    },
  ],
  payments: [
    {
      id: 5,
      paymentNumber: "TW/PR/26-27/0001",
      paymentDate: "2026-08-28T00:00:00.000Z",
      dueDate: null,
      amount: "200",
      mode: "Bank Transfer",
      modeItemId: 31,
      reference: null,
      notes: null,
      createdAt: "2026-08-28T00:00:00.000Z",
    },
  ],
  createdAt: "2026-08-28T00:00:00.000Z",
  updatedAt: "2026-08-28T00:00:00.000Z",
  ...over,
});

const PAYMENT = {
  id: 5,
  invoiceId: 21,
  paymentNumber: "TW/PR/26-27/0001",
  paymentDate: "2026-08-28T00:00:00.000Z",
  dueDate: "2020-01-15T00:00:00.000Z",
  effectiveDueDate: "2020-01-15T00:00:00.000Z",
  overdueDays: 126,
  amount: "200",
  mode: "Bank Transfer",
  modeItemId: 31,
  reference: "UTR1",
  notes: null,
  invoice: {
    id: 21,
    invoiceNumber: "TW/IN/26-27/0001",
    invoiceType: "TAX",
    invoiceDate: "2026-08-28T00:00:00.000Z",
    dueDate: null,
    status: "PARTIALLY_PAID",
    totalAmount: "708",
    amountReceived: "200",
    balance: "508",
  },
  customer: {
    id: 7,
    customerCode: "CUS-IN-001",
    companyName: "Global Enterprises Pvt Ltd",
  },
  createdAt: "2026-08-28T00:00:00.000Z",
  updatedAt: "2026-08-28T00:00:00.000Z",
};

const MODES = [
  {
    id: 31,
    documentType: "PAYMENT_RECEIVED",
    field: "PAYMENT_MODE",
    label: "Bank Transfer",
    value: null,
    bankDetails: null,
    isDefault: true,
    sortOrder: 0,
    hasImage: false,
  },
];

function answer(req: MockRequest) {
  const { method, pathname } = req;
  if (method === "GET" && pathname === "/sales/invoices") {
    const type = req.search.get("invoiceType");
    return {
      body: page1(
        type === "PROFORMA"
          ? [
              invoice({
                id: 22,
                invoiceType: "PROFORMA",
                invoiceNumber: "TW/PI/26-27/0003",
                status: "UNPAID",
                amountReceived: "0",
                balance: "708",
                payments: [],
              }),
            ]
          : [invoice()],
      ),
    };
  }
  if (method === "GET" && pathname === "/sales/invoices/21")
    return { body: { data: invoice() } };
  if (method === "GET" && pathname === "/sales/invoices/22") {
    return {
      body: {
        data: invoice({
          id: 22,
          invoiceType: "PROFORMA",
          invoiceNumber: "TW/PI/26-27/0003",
          status: "UNPAID",
          amountReceived: "0",
          balance: "708",
          payments: [],
        }),
      },
    };
  }
  if (method === "GET" && /^\/sales\/invoices\/2[12]\/pdf$/.test(pathname)) {
    return { file: "%PDF-1.4", contentType: "application/pdf" };
  }
  if (method === "POST" && pathname === "/sales/invoices/22/convert-to-tax") {
    return { status: 201, body: { data: invoice({ id: 21 }) } };
  }
  if (method === "POST" && pathname === "/sales/invoices/21/delivery-challan") {
    return {
      status: 201,
      body: { data: { id: 61, dcNumber: "TW/DC/26-27/0004" } },
    };
  }
  if (method === "POST" && pathname === "/sales/invoices/preview") {
    return {
      body: {
        data: {
          number: "TW/IN/26-27/0002",
          html: "<html><body>TAX INVOICE TW/IN/26-27/0002</body></html>",
          totals: {
            placeOfSupply: "33",
            taxMode: "INTRA",
            itemsSubtotal: "100",
            transportCharge: "0",
            taxableAmount: "100",
            cgstRate: "9",
            sgstRate: "9",
            igstRate: "0",
            cgstAmount: "9",
            sgstAmount: "9",
            igstAmount: "0",
            roundOff: "0",
            totalAmount: "118",
            amountInWords: "x",
            lineAmounts: ["100"],
          },
        },
      },
    };
  }
  if (method === "POST" && pathname === "/sales/invoices") {
    return { status: 201, body: { data: invoice() } };
  }
  if (method === "GET" && pathname === "/sales/payments")
    return { body: page1([PAYMENT]) };
  if (method === "GET" && pathname === "/sales/payments/alerts") {
    return {
      body: {
        data: {
          overduePayments: 1,
          overdueInvoices: 1,
          overdueBalance: "14770.80",
        },
      },
    };
  }
  if (method === "GET" && pathname === "/sales/payments/next-number") {
    return { body: { data: { number: "TW/PR/26-27/0002" } } };
  }
  if (method === "POST" && pathname === "/sales/payments") {
    return {
      status: 201,
      body: {
        data: {
          ...PAYMENT,
          id: 6,
          paymentNumber: "TW/PR/26-27/0002",
          invoice: { ...PAYMENT.invoice, balance: "0" },
        },
      },
    };
  }
  if (method === "GET" && pathname === "/sales/master/document-fields") {
    return {
      body: {
        data:
          req.search.get("documentType") === "PAYMENT_RECEIVED" ? MODES : [],
      },
    };
  }
  if (method === "GET" && pathname === "/sales/customers") {
    return {
      body: page1([
        {
          ...SNAPSHOT,
          id: 7,
          mobileCountryCode: "+91",
          mobileNumber: "9876543210",
          status: "ACTIVE",
          addresses: [],
          defaultAddress: null,
        },
      ]),
    };
  }
  if (method === "GET" && pathname === "/sales/delivery-challans")
    return { body: page1([]) };
  if (method === "POST" && pathname === "/sales/delivery-challans/preview") {
    return {
      body: {
        data: {
          number: "TW/DC/26-27/0005",
          html: "<html><body>DELIVERY CHALLAN</body></html>",
        },
      },
    };
  }
  if (method === "POST" && pathname === "/sales/delivery-challans") {
    return {
      status: 201,
      body: {
        data: {
          id: 62,
          dcNumber: "TW/DC/26-27/0005",
          customerId: 7,
          customerSnapshot: SNAPSHOT,
          dcDate: "2026-10-15T00:00:00.000Z",
          sourceInvoiceId: null,
          sourceInvoice: null,
          sealName: null,
          signatureName: null,
          sealItemId: null,
          signatureItemId: null,
          preparedBy: null,
          notes: null,
          status: "DRAFT",
          itemsCount: 1,
          lines: [],
          createdAt: "2026-10-15T00:00:00.000Z",
          updatedAt: "2026-10-15T00:00:00.000Z",
        },
      },
    };
  }
  if (
    method === "GET" &&
    /^\/sales\/delivery-challans\/6[12]$/.test(pathname)
  ) {
    return {
      body: {
        data: {
          id: 61,
          dcNumber: "TW/DC/26-27/0004",
          customerId: 7,
          customerSnapshot: SNAPSHOT,
          dcDate: "2026-10-15T00:00:00.000Z",
          sourceInvoiceId: 21,
          sourceInvoice: { id: 21, invoiceNumber: "TW/IN/26-27/0001" },
          sealName: null,
          signatureName: null,
          sealItemId: null,
          signatureItemId: null,
          preparedBy: null,
          notes: null,
          status: "DRAFT",
          itemsCount: 1,
          lines: [],
          createdAt: "2026-10-15T00:00:00.000Z",
          updatedAt: "2026-10-15T00:00:00.000Z",
        },
      },
    };
  }
  if (
    method === "GET" &&
    /^\/sales\/delivery-challans\/6[12]\/pdf$/.test(pathname)
  ) {
    return { file: "%PDF-1.4", contentType: "application/pdf" };
  }
  return undefined;
}

async function open(page: Page, category: string, link: string) {
  await page
    .getByRole("navigation", { name: "Main application navigation" })
    .getByRole("button", { name: "Sales" })
    .click();
  const menu = page.getByRole("menu", { name: "Sales categories" });
  await menu.getByRole("button", { name: category }).click();
  await menu.getByRole("link", { name: link }).click();
}

async function signIn(page: Page, permissions = MANAGER) {
  return signInWithMockedApi(page, {
    permissions,
    workspace: "sales",
    menu: MENU,
    handler: answer,
  });
}

test.describe("Sales invoices, payments and challans", () => {
  test("tax invoice: record a payment within the balance, then raise a challan", async ({
    page,
  }) => {
    const { calls } = await signIn(page);
    await open(page, "Documents", "Tax Invoices");
    await expect(
      page.getByRole("heading", { name: "Tax invoices" }),
    ).toBeVisible();
    await page.getByText("TW/IN/26-27/0001").click();
    await expect(page.getByText("TW/PR/26-27/0001")).toBeVisible();

    await page.getByRole("button", { name: "Record payment" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Against TW/IN/26-27/0001")).toBeVisible();
    await expect(dialog.getByLabel("Payment mode")).toHaveValue("");
    await dialog.getByLabel("Amount received (₹)").fill("600");
    await dialog.getByLabel("Payment date").focus();
    await expect(dialog.getByText(/The balance is ₹508.00/)).toBeVisible();
    await dialog.getByLabel("Amount received (₹)").fill("508");
    await dialog.getByLabel("Payment mode").selectOption("31");
    await dialog.getByRole("button", { name: "Record payment" }).click();
    await expect(
      page.getByText("Payment TW/PR/26-27/0002 recorded"),
    ).toBeVisible();
    const post = calls.find((c) => c.startsWith("POST /sales/payments {"));
    expect(post).toContain('"amount":508');
    expect(post).toContain('"modeItemId":31');
    expect(post).toContain('"invoiceId":21');

    await page.getByRole("button", { name: "Create delivery challan" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Create delivery challan" })
      .click();
    await expect(page).toHaveURL(/\/sales\/delivery-challans\/61$/);
    await expect(
      page.getByRole("heading", { name: "TW/DC/26-27/0004" }),
    ).toBeVisible();
  });

  test("proforma → tax invoice", async ({ page }) => {
    const { calls } = await signIn(page);
    await open(page, "Documents", "Proforma Invoices");
    await page.getByText("TW/PI/26-27/0003").click();
    await page.getByRole("button", { name: "Move to tax invoice" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Move to tax invoice" })
      .click();
    await expect(page).toHaveURL(/\/sales\/invoices\/21$/);
    expect(
      calls.some((c) => c.startsWith("POST /sales/invoices/22/convert-to-tax")),
    ).toBe(true);
  });

  test("new tax invoice: server preview, due-date bubble, save", async ({
    page,
  }) => {
    const { calls } = await signIn(page);
    await open(page, "Documents", "Tax Invoices");
    await page.getByRole("button", { name: "New tax invoice" }).first().click();
    await expect(page.getByLabel("Type")).toHaveValue("TAX");

    await page.getByLabel("Invoice date").fill("2026-10-15");
    await page.getByLabel("Due date").fill("2026-10-01");
    await page.getByLabel("Payment terms").focus();
    await expect(
      page.getByText("The due date cannot be before the invoice date."),
    ).toBeVisible();
    await page.getByLabel("Due date").fill("2026-11-14");

    await page.getByRole("combobox", { name: /^Customer/ }).selectOption("7");
    const item = page.getByRole("group", { name: "Item 1" });
    await item.getByLabel("Description").fill("Service");
    await item.getByLabel("Unit price (₹)").fill("100");
    await expect(
      page.locator('iframe[title="Invoice preview"]'),
    ).toHaveAttribute("srcdoc", /TAX INVOICE/);
    await expect(page.getByLabel("Invoice number")).toHaveValue(
      "TW/IN/26-27/0002",
    );
    await expect(page.getByText("₹118.00")).toBeVisible();

    await page.getByRole("button", { name: "Save invoice" }).click();
    await expect(page).toHaveURL(/\/sales\/invoices\/21$/);
    const post = calls.find((c) => c.startsWith("POST /sales/invoices {"));
    expect(post).toContain('"invoiceType":"TAX"');
    expect(post).toContain('"dueDate":"2026-11-14"');
  });

  test("payments received: alerts, overdue filter, read-only users", async ({
    page,
  }) => {
    const { calls } = await signIn(page);
    await open(page, "Collections", "Payments Received");
    await expect(
      page.getByText(/1 overdue payment on 1 invoice — ₹14,770.80 outstanding/),
    ).toBeVisible();
    await expect(page.getByText("Overdue (126d)")).toBeVisible();
    await page.getByRole("button", { name: "Filter overdue only" }).click();
    await expect(
      page.getByRole("button", { name: "Show all payments" }),
    ).toBeVisible();
    await expect
      .poll(() => calls.some((c) => c.includes("overdueOnly=true")))
      .toBe(true);
    await page
      .getByRole("button", { name: "Actions for TW/PR/26-27/0001" })
      .click();
    await expect(
      page.getByRole("menuitem", { name: "Delete payment" }),
    ).toBeVisible();
  });

  test("a payments reader cannot record, edit or delete", async ({ page }) => {
    await signIn(page, ["sales.dashboard.read", "sales.payment.read"]);
    await open(page, "Collections", "Payments Received");
    await expect(
      page.getByRole("button", { name: "Record payment" }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Actions for TW/PR/26-27/0001" })
      .click();
    await expect(
      page.getByRole("menuitem", { name: "View receipt" }),
    ).toBeVisible();
    await expect(
      page.getByRole("menuitem", { name: "Delete payment" }),
    ).toHaveCount(0);
  });

  test("new delivery challan with its preview", async ({ page }) => {
    const { calls } = await signIn(page);
    await open(page, "Documents", "Delivery Challans");
    await page
      .getByRole("button", { name: "New delivery challan" })
      .first()
      .click();
    await page.getByRole("combobox", { name: /^Customer/ }).selectOption("7");
    const item = page.getByRole("group", { name: "Item 1" });
    await item.getByLabel("Description").fill("Panel");
    await item.getByLabel("Quantity").fill("0");
    await item.getByLabel("HSN code").focus();
    await expect(
      page.getByText("Enter a quantity above 0 (up to 3 decimals)."),
    ).toBeVisible();
    await item.getByLabel("Quantity").fill("2");
    await expect(
      page.locator('iframe[title="Delivery challan preview"]'),
    ).toHaveAttribute("srcdoc", /DELIVERY CHALLAN/);
    await expect(page.getByLabel("DC number")).toHaveValue("TW/DC/26-27/0005");
    await page.getByRole("button", { name: "Save challan" }).click();
    await expect(page).toHaveURL(/\/sales\/delivery-challans\/62$/);
    const post = calls.find((c) =>
      c.startsWith("POST /sales/delivery-challans {"),
    );
    expect(post).toContain('"quantity":2');
  });
});
