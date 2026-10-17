import { expect, test, type Page } from "@playwright/test";
import {
  apiError,
  page1,
  signInWithMockedApi,
  type MockRequest,
} from "./helpers/mock-api";

// Quotations against a mocked API: list → detail (PDF, email, WhatsApp,
// convert, delete), create with the live server preview and field-by-field
// validation, and permission-driven actions. Pricing and the preview's
// rules are proven by apps/api/test/sales-documents.e2e-spec.ts.

const MANAGER = [
  "sales.dashboard.read",
  "sales.customer.read",
  "sales.master.read",
  "sales.quotation.read",
  "sales.quotation.write",
  "sales.quotation.delete",
  "sales.quotation.send",
  "sales.invoice.write",
];
const READER = ["sales.dashboard.read", "sales.quotation.read"];

const MENU = [
  { code: "sales-dashboard", label: "Dashboard", path: "/sales/dashboard" },
  { code: "sales-quotations", label: "Quotations", path: "/sales/quotations" },
];

const CUSTOMER = {
  id: 7,
  customerCode: "CUS-IN-001",
  companyName: "Global Enterprises Pvt Ltd",
  contactPerson: "Jane",
  email: "jane@global.test",
  mobileCountryCode: "+91",
  mobileNumber: "9876543210",
  gstin: null,
  stateCode: "33",
  stateName: "Tamil Nadu",
  status: "ACTIVE",
  addresses: [],
  defaultAddress: null,
};

const QUOTATION = {
  id: 3,
  quotationNumber: "TW/QUO/26-27/0007",
  customerId: 7,
  customerSnapshot: {
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
  },
  quotationDate: "2026-10-15T00:00:00.000Z",
  validity: "30 Days",
  deliveryTerms: "2-3 Weeks",
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
  amountInWords: "Rupees Seven Hundred Eight Only",
  bankDetails: null,
  sealName: null,
  signatureName: null,
  sealItemId: null,
  signatureItemId: null,
  preparedBy: "Rafic",
  terms: null,
  status: "OPEN",
  convertedAt: null as string | null,
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
  createdAt: "2026-10-15T00:00:00.000Z",
  updatedAt: "2026-10-15T00:00:00.000Z",
};

const OPTIONS = [
  {
    id: 11,
    documentType: "QUOTATION",
    field: "VALIDITY",
    label: "30 Days",
    value: null,
    bankDetails: null,
    isDefault: true,
    sortOrder: 0,
    hasImage: false,
  },
  {
    id: 12,
    documentType: "QUOTATION",
    field: "PREPARED_BY",
    label: "Rafic",
    value: null,
    bankDetails: null,
    isDefault: true,
    sortOrder: 0,
    hasImage: false,
  },
];

function preview(body: {
  lines: Array<{ quantity: number; unitPrice: number }>;
}) {
  const items = body.lines.map((l) => l.quantity * l.unitPrice);
  const subtotal = items.reduce((a, b) => a + b, 0);
  return {
    number: "TW/QUO/26-27/0008",
    html: `<html><body><h1>QUOTATION</h1><p>TW/QUO/26-27/0008</p></body></html>`,
    totals: {
      placeOfSupply: "33",
      taxMode: "INTRA",
      itemsSubtotal: String(subtotal),
      transportCharge: "0",
      taxableAmount: String(subtotal),
      cgstRate: "9",
      sgstRate: "9",
      igstRate: "0",
      cgstAmount: String(subtotal * 0.09),
      sgstAmount: String(subtotal * 0.09),
      igstAmount: "0",
      roundOff: "0",
      totalAmount: String(subtotal * 1.18),
      amountInWords: "Rupees",
      lineAmounts: items.map(String),
    },
  };
}

function handler(
  quotation: typeof QUOTATION = QUOTATION,
): (req: MockRequest) => ReturnType<typeof answer> {
  return (req) => answer(req, quotation);
}

function answer(req: MockRequest, quotation: typeof QUOTATION) {
  const { method, pathname } = req;
  if (method === "GET" && pathname === "/sales/quotations") {
    return { body: page1([quotation]) };
  }
  if (method === "GET" && pathname === "/sales/quotations/next-number") {
    return { body: { data: { number: "TW/QUO/26-27/0008" } } };
  }
  if (method === "GET" && pathname === "/sales/quotations/3") {
    return { body: { data: quotation } };
  }
  if (method === "GET" && pathname === "/sales/quotations/3/pdf") {
    return { file: "%PDF-1.4 test", contentType: "application/pdf" };
  }
  if (method === "POST" && pathname === "/sales/quotations/preview") {
    return {
      body: {
        data: preview(
          req.body as { lines: Array<{ quantity: number; unitPrice: number }> },
        ),
      },
    };
  }
  if (method === "POST" && pathname === "/sales/quotations/3/preview") {
    return {
      body: {
        data: {
          ...preview(
            req.body as {
              lines: Array<{ quantity: number; unitPrice: number }>;
            },
          ),
          number: quotation.quotationNumber,
        },
      },
    };
  }
  if (method === "PATCH" && pathname === "/sales/quotations/3") {
    return { body: { data: quotation } };
  }
  if (method === "POST" && pathname === "/sales/quotations") {
    return { status: 201, body: { data: { ...quotation, id: 3 } } };
  }
  if (method === "POST" && pathname === "/sales/quotations/3/email") {
    return {
      body: { data: { status: "SENT", to: ["buyer@global.test"] } },
    };
  }
  if (method === "POST" && pathname === "/sales/quotations/3/whatsapp") {
    return { body: { data: { url: "https://wa.me/919876543210?text=x" } } };
  }
  if (method === "POST" && pathname === "/sales/quotations/3/convert") {
    return {
      status: 201,
      body: {
        data: {
          id: 40,
          invoiceNumber: "TW/PI/26-27/0001",
          invoiceType: "PROFORMA",
        },
      },
    };
  }
  if (method === "GET" && pathname === "/sales/customers") {
    return { body: page1([CUSTOMER]) };
  }
  if (method === "GET" && pathname === "/sales/master/document-fields") {
    return { body: { data: OPTIONS } };
  }
  return undefined;
}

async function goToQuotations(page: Page) {
  await page
    .getByRole("navigation", { name: "Main application navigation" })
    .getByRole("button", { name: "Sales" })
    .click();
  const menu = page.getByRole("menu", { name: "Sales categories" });
  await menu.getByRole("button", { name: "Documents" }).click();
  await menu.getByRole("link", { name: "Quotations" }).click();
  await expect(page.getByRole("heading", { name: "Quotations" })).toBeVisible();
}

test.describe("Sales quotations", () => {
  test("list → detail with the PDF, email, WhatsApp and convert", async ({
    page,
  }) => {
    const { calls } = await signInWithMockedApi(page, {
      permissions: MANAGER,
      workspace: "sales",
      menu: MENU,
      handler: handler(),
    });
    await goToQuotations(page);
    await expect(page.getByText("TW/QUO/26-27/0007")).toBeVisible();
    await page.getByText("Global Enterprises Pvt Ltd").click();

    await expect(
      page.getByRole("heading", { name: "TW/QUO/26-27/0007" }),
    ).toBeVisible();
    await expect(page.locator('iframe[title^="Quotation"]')).toHaveAttribute(
      "src",
      /^blob:/,
    );

    await page.getByRole("button", { name: "Email" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("To").fill("not-an-email");
    await dialog.getByLabel("Cc").focus();
    await expect(
      dialog.getByText("Enter email addresses separated by commas."),
    ).toBeVisible();
    await dialog.getByLabel("To").fill("buyer@global.test");
    await dialog.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText("Emailed to buyer@global.test")).toBeVisible();
    expect(
      calls.some((c) =>
        c.startsWith(
          'POST /sales/quotations/3/email {"to":["buyer@global.test"]}',
        ),
      ),
    ).toBe(true);

    await page.getByRole("button", { name: "Convert to invoice" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Convert" })
      .click();
    await expect(
      page.getByText("Proforma invoice TW/PI/26-27/0001 created"),
    ).toBeVisible();
    expect(
      calls.some((c) =>
        c.startsWith(
          'POST /sales/quotations/3/convert {"invoiceType":"PROFORMA"',
        ),
      ),
    ).toBe(true);
  });

  test("create: master-list defaults, server preview, bubbles, save", async ({
    page,
  }) => {
    const { calls } = await signInWithMockedApi(page, {
      permissions: MANAGER,
      workspace: "sales",
      menu: MENU,
      handler: handler(),
    });
    await goToQuotations(page);
    await page.getByRole("button", { name: "New quotation" }).first().click();

    await expect(page.getByLabel("Quotation number")).toHaveValue(
      "TW/QUO/26-27/0008",
    );
    await expect(page.getByLabel("Validity")).toHaveValue("30 Days");
    await expect(page.getByLabel("Prepared by")).toHaveValue("Rafic");
    await expect(
      page.getByText("Choose a customer and fill in at least one item"),
    ).toBeVisible();

    // Bubbles as each field is left.
    await page
      .getByRole("group", { name: "Item 1" })
      .getByLabel("Quantity")
      .fill("0");
    await page
      .getByRole("group", { name: "Item 1" })
      .getByLabel("Unit price (₹)")
      .focus();
    await expect(
      page.getByText("Enter a quantity above 0 (up to 3 decimals)."),
    ).toBeVisible();

    await page.getByRole("combobox", { name: /^Customer/ }).selectOption("7");
    await page
      .getByRole("group", { name: "Item 1" })
      .getByLabel("Description")
      .fill("Control panel");
    await page
      .getByRole("group", { name: "Item 1" })
      .getByLabel("Quantity")
      .fill("2");
    await page
      .getByRole("group", { name: "Item 1" })
      .getByLabel("Unit price (₹)")
      .fill("600");

    // The server prices it; the preview and totals follow.
    const frame = page.locator('iframe[title="Quotation preview"]');
    await expect(frame).toHaveAttribute("srcdoc", /QUOTATION/);
    await expect(page.getByText("₹1,200.00").first()).toBeVisible();
    await expect(page.getByText("₹1,416.00")).toBeVisible();
    expect(
      calls.some((c) => c.startsWith("POST /sales/quotations/preview")),
    ).toBe(true);

    await page.getByRole("button", { name: "Save quotation" }).click();
    await expect(page).toHaveURL(/\/sales\/quotations\/3$/);
    const post = calls.find((c) => c.startsWith("POST /sales/quotations {"));
    expect(post).toContain('"customerId":7');
    expect(post).toContain('"quantity":2,"unitPrice":600');
    expect(post).toContain('"validity":"30 Days"');
  });

  test("edit: previews under its own number and saves the change", async ({
    page,
  }) => {
    const { calls } = await signInWithMockedApi(page, {
      permissions: MANAGER,
      workspace: "sales",
      menu: MENU,
      handler: handler(),
    });
    await goToQuotations(page);
    await page.getByText("Global Enterprises Pvt Ltd").click();
    await page.getByRole("button", { name: "Edit" }).click();
    await expect(page.getByLabel("Quotation number")).toHaveValue(
      "TW/QUO/26-27/0007",
    );
    const item = page.getByRole("group", { name: "Item 1" });
    await expect(item.getByLabel("Description")).toHaveValue("Control panel");
    await item.getByLabel("Quantity").fill("3");
    await expect(page.getByText("₹1,800.00").first()).toBeVisible();
    expect(
      calls.some((c) => c.startsWith("POST /sales/quotations/3/preview")),
    ).toBe(true);
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page).toHaveURL(/\/sales\/quotations\/3$/);
    const patch = calls.find((c) => c.startsWith("PATCH /sales/quotations/3"));
    expect(patch).toContain('"quantity":3,"unitPrice":600');
    expect(patch).toContain('"placeOfSupply":"33"');
  });

  test("a preview the server refuses shows why", async ({ page }) => {
    await signInWithMockedApi(page, {
      permissions: MANAGER,
      workspace: "sales",
      menu: MENU,
      handler: (req) =>
        req.method === "POST" && req.pathname === "/sales/quotations/preview"
          ? apiError(
              422,
              "COMPANY_PROFILE_REQUIRED",
              "Add the company details in the Sales master list first",
            )
          : answer(req, QUOTATION),
    });
    await goToQuotations(page);
    await page.getByRole("button", { name: "New quotation" }).first().click();
    await page.getByRole("combobox", { name: /^Customer/ }).selectOption("7");
    await page
      .getByRole("group", { name: "Item 1" })
      .getByLabel("Description")
      .fill("Panel");
    await page
      .getByRole("group", { name: "Item 1" })
      .getByLabel("Unit price (₹)")
      .fill("10");
    await expect(page.getByText("Preview not updated")).toBeVisible();
    await expect(
      page.getByText("Add the company details in the Sales master list first"),
    ).toBeVisible();
  });

  test("a reader sees quotations but no write, send, convert or delete", async ({
    page,
  }) => {
    await signInWithMockedApi(page, {
      permissions: READER,
      workspace: "sales",
      menu: MENU,
      handler: handler(),
    });
    await goToQuotations(page);
    await expect(
      page.getByRole("button", { name: "New quotation" }),
    ).toHaveCount(0);
    await page.getByText("Global Enterprises Pvt Ltd").click();
    await expect(
      page.getByRole("button", { name: "Download PDF" }),
    ).toBeVisible();
    for (const name of [
      "Email",
      "WhatsApp",
      "Edit",
      "Convert to invoice",
      "Delete",
    ]) {
      await expect(page.getByRole("button", { name })).toHaveCount(0);
    }
  });

  test("a converted quotation is locked", async ({ page }) => {
    await signInWithMockedApi(page, {
      permissions: MANAGER,
      workspace: "sales",
      menu: MENU,
      handler: handler({
        ...QUOTATION,
        status: "CONVERTED",
        convertedAt: "2026-10-16T00:00:00.000Z",
      }),
    });
    await goToQuotations(page);
    await page.getByText("Global Enterprises Pvt Ltd").click();
    await expect(page.getByText("Converted to an invoice")).toBeVisible();
    for (const name of ["Edit", "Convert to invoice", "Delete"]) {
      await expect(page.getByRole("button", { name })).toHaveCount(0);
    }
    await expect(page.getByRole("button", { name: "Email" })).toBeVisible();
  });
});
