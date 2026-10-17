import { expect, test, type Page } from "@playwright/test";
import {
  apiError,
  page1,
  signInWithMockedApi,
  type MockRequest,
} from "./helpers/mock-api";

// Returnable DCs and the Sales master list against a mocked API: the RDC
// list (overdue badge), a new RDC with the server preview and the
// return-date bubble, mark returned / reopen, read-only users; master list
// numbering (running number, format), company details and logo, document
// fields with seal images. Server rules: apps/api/test/
// sales-payments-rdc.e2e-spec.ts and sales-master-list.e2e-spec.ts.

const MANAGER = [
  "sales.dashboard.read",
  "sales.customer.read",
  "sales.master.read",
  "sales.master.write",
  "sales.running_number.write",
  "sales.returnable_dc.read",
  "sales.returnable_dc.write",
  "sales.returnable_dc.delete",
  "sales.returnable_dc.send",
];

const MENU = [
  { code: "sales-dashboard", label: "Dashboard", path: "/sales/dashboard" },
  {
    code: "sales-returnable-dcs",
    label: "Returnable DCs",
    path: "/sales/returnable-dcs",
  },
  {
    code: "sales-master-list",
    label: "Master List",
    path: "/sales/master-list",
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

const rdc = (over: Record<string, unknown> = {}) => ({
  id: 41,
  rdcNumber: "TW/RDC/26-27/0101",
  customerId: 7,
  customerSnapshot: SNAPSHOT,
  issueDate: "2026-09-01T00:00:00.000Z",
  purpose: "Demonstration / Testing",
  expectedReturnDate: "2026-09-15T00:00:00.000Z",
  takenBy: "Ravi",
  sealName: null,
  signatureName: null,
  sealItemId: null,
  signatureItemId: null,
  preparedBy: "Rafic",
  notes: "Returnable terms",
  status: "ISSUED",
  returnedDate: null,
  overdueDays: 32,
  itemsCount: 1,
  lines: [{ lineNo: 1, description: "Demo control panel", quantity: "2" }],
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
  ...over,
});

const RUNNING = [
  "quotation",
  "proforma_invoice",
  "tax_invoice",
  "delivery_challan",
  "payment_received",
  "returnable_dc",
].map((codeType) => ({
  codeType,
  prefix: codeType === "returnable_dc" ? "TW/RDC" : "TW/X",
  padding: 4,
  fiscalYear: "26-27",
  lastNumber: codeType === "returnable_dc" ? 101 : 0,
  lastCode: codeType === "returnable_dc" ? "TW/RDC/26-27/0101" : null,
  nextCode:
    codeType === "returnable_dc" ? "TW/RDC/26-27/0102" : "TW/X/26-27/0001",
}));

const FORMATS = [
  {
    codeType: "customer",
    prefix: "CUS",
    padding: 3,
    isDefault: true,
    updatedAt: null,
    example: "CUS-IN-001",
  },
  ...RUNNING.map((r) => ({
    codeType: r.codeType,
    prefix: r.prefix,
    padding: r.padding,
    isDefault: true,
    updatedAt: null,
    example: r.nextCode,
  })),
];

const PROFILE = {
  legalName: "Texawave Innovations Private Limited",
  tagline: null,
  address: "No 93/206 Canal Bank Road, Adyar, Chennai - 600 020",
  gstin: "33AAMCT4293K1ZU",
  stateCode: "33",
  stateName: "Tamil Nadu",
  pan: "AAMCT4293K",
  email: "sales@texawave.com",
  phone: null,
  hasLogo: false,
};

const SEAL = {
  id: 51,
  field: "COMPANY_SEAL",
  label: "Texawave Official Corporate Seal",
  value: null,
  bankDetails: null,
  isDefault: true,
  sortOrder: 0,
  hasImage: false,
};

const SEAL_DOCS = [
  "QUOTATION",
  "PROFORMA_INVOICE",
  "TAX_INVOICE",
  "DELIVERY_CHALLAN",
  "RETURNABLE_DC",
];
const LAYOUT = [
  { field: "VALIDITY", hasImage: false, documentTypes: ["QUOTATION"] },
  { field: "COMPANY_SEAL", hasImage: true, documentTypes: SEAL_DOCS },
  { field: "AUTHORIZED_SIGNATURE", hasImage: true, documentTypes: SEAL_DOCS },
];

function answer(req: MockRequest) {
  const { method, pathname } = req;
  if (method === "GET" && pathname === "/sales/returnable-dcs") {
    return { body: page1([rdc()]) };
  }
  if (method === "GET" && pathname === "/sales/returnable-dcs/41") {
    return { body: { data: rdc() } };
  }
  if (method === "GET" && pathname === "/sales/returnable-dcs/41/pdf") {
    return { file: "%PDF-1.4", contentType: "application/pdf" };
  }
  if (method === "POST" && pathname === "/sales/returnable-dcs/preview") {
    return {
      body: {
        data: {
          number: "TW/RDC/26-27/0102",
          html: "<html><body>RETURNABLE DELIVERY CHALLAN</body></html>",
        },
      },
    };
  }
  if (method === "POST" && pathname === "/sales/returnable-dcs") {
    return { status: 201, body: { data: rdc() } };
  }
  if (method === "POST" && pathname === "/sales/returnable-dcs/41/return") {
    return {
      body: {
        data: rdc({
          status: "RETURNED",
          returnedDate: "2026-10-15T00:00:00.000Z",
          overdueDays: null,
        }),
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
  if (method === "GET" && pathname === "/sales/master/code-formats") {
    return { body: { data: FORMATS } };
  }
  if (method === "GET" && pathname === "/sales/master/running-numbers") {
    return { body: { data: RUNNING } };
  }
  if (
    method === "PATCH" &&
    pathname === "/sales/master/running-numbers/returnable_dc"
  ) {
    const last = (req.body as { lastNumber: number }).lastNumber;
    if (last < 101) {
      return apiError(
        422,
        "RUNNING_NUMBER_IN_USE",
        "TW/RDC/26-27/0101 is already issued; the last number cannot go below 101",
      );
    }
    return {
      body: {
        data: {
          ...RUNNING[5],
          lastNumber: last,
          nextCode: "TW/RDC/26-27/0201",
        },
      },
    };
  }
  if (
    method === "PATCH" &&
    pathname === "/sales/master/code-formats/quotation"
  ) {
    return {
      body: {
        data: { ...FORMATS[1], prefix: "TW/QT", example: "TW/QT/26-27/0001" },
      },
    };
  }
  if (method === "GET" && pathname === "/sales/master/company-profile") {
    return { body: { data: PROFILE } };
  }
  if (method === "PUT" && pathname === "/sales/master/company-profile") {
    return { body: { data: PROFILE } };
  }
  if (method === "PUT" && pathname === "/sales/master/company-profile/logo") {
    return { body: { data: { ...PROFILE, hasLogo: true } } };
  }
  if (method === "GET" && pathname === "/sales/master/document-fields/layout") {
    return { body: { data: LAYOUT } };
  }
  if (method === "GET" && pathname === "/sales/master/document-fields") {
    return {
      body: {
        // Shared: the seal is offered on every document with seals.
        data: ["RETURNABLE_DC", null].includes(req.search.get("documentType"))
          ? [SEAL]
          : [],
      },
    };
  }
  if (method === "POST" && pathname === "/sales/master/document-fields") {
    return {
      status: 201,
      body: { data: { ...SEAL, id: 52, field: "AUTHORIZED_SIGNATURE" } },
    };
  }
  if (
    method === "PUT" &&
    pathname === "/sales/master/document-fields/51/image"
  ) {
    return { body: { data: { ...SEAL, hasImage: true } } };
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

// A 1×1 PNG.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

test.describe("Sales returnable DCs", () => {
  test("new returnable DC: return-date bubble, server preview, save", async ({
    page,
  }) => {
    const { calls } = await signIn(page);
    await open(page, "Documents", "Returnable DCs");
    await expect(page.getByText("Overdue (32d)")).toBeVisible();
    await page
      .getByRole("button", { name: "New returnable DC" })
      .first()
      .click();

    await page.getByLabel("Issue date").fill("2026-10-15");
    await page.getByLabel("Expected return date").fill("2026-10-01");
    await page.getByLabel("Taken by / handed to").focus();
    await expect(
      page.getByText("The return date cannot be before the issue date."),
    ).toBeVisible();
    await page.getByLabel("Expected return date").fill("2026-10-29");

    await page.getByRole("combobox", { name: /^Recipient/ }).selectOption("7");
    const item = page.getByRole("group", { name: "Item 1" });
    await item.getByLabel("Description of goods").fill("Demo control panel");
    await item.getByLabel("Quantity").fill("2");
    await expect(
      page.locator('iframe[title="Returnable DC preview"]'),
    ).toHaveAttribute("srcdoc", /RETURNABLE DELIVERY CHALLAN/);
    await expect(page.getByLabel("RDC number")).toHaveValue(
      "TW/RDC/26-27/0102",
    );
    // The master list's default seal is pre-selected.
    await expect(page.getByLabel("Company seal")).toHaveValue("51");

    await page.getByRole("button", { name: "Save returnable DC" }).click();
    await expect(page).toHaveURL(/\/sales\/returnable-dcs\/41$/);
    const post = calls.find((c) =>
      c.startsWith("POST /sales/returnable-dcs {"),
    );
    expect(post).toContain('"expectedReturnDate":"2026-10-29"');
    expect(post).toContain('"sealItemId":51');
    expect(post).toContain('"quantity":2');
    // Blank terms are left out so the server prints its standard text.
    expect(post).not.toContain('"notes"');
  });

  test("mark an overdue returnable DC returned", async ({ page }) => {
    const { calls } = await signIn(page);
    await open(page, "Documents", "Returnable DCs");
    await page.getByText("TW/RDC/26-27/0101").click();
    await expect(page.getByText("Return overdue")).toBeVisible();
    await page.getByRole("button", { name: "Mark returned" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Returned on").fill("2026-10-15");
    await dialog.getByRole("button", { name: "Mark returned" }).click();
    await expect
      .poll(() =>
        calls.find((c) => c.startsWith("POST /sales/returnable-dcs/41/return")),
      )
      .toContain('"returnedDate":"2026-10-15"');
  });

  test("a returnable DC reader cannot create, edit or return", async ({
    page,
  }) => {
    await signIn(page, ["sales.dashboard.read", "sales.returnable_dc.read"]);
    await open(page, "Documents", "Returnable DCs");
    await expect(
      page.getByRole("button", { name: "New returnable DC" }),
    ).toHaveCount(0);
    await page.getByText("TW/RDC/26-27/0101").click();
    await expect(
      page.getByRole("button", { name: "Download PDF" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Mark returned" }),
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Edit" })).toHaveCount(0);
  });
});

test.describe("Sales master list", () => {
  test("numbering: set a running number and change a format", async ({
    page,
  }) => {
    const { calls } = await signIn(page);
    await open(page, "Setup", "Master List");
    await expect(page.getByText("TW/RDC/26-27/0102")).toBeVisible();

    await page
      .getByRole("button", { name: "Set Returnable DC running number" })
      .click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel("Last number used").fill("50");
    await dialog.getByRole("button", { name: "Save number" }).click();
    await expect(dialog.getByText(/cannot go below 101/).first()).toBeVisible();
    await dialog.getByLabel("Last number used").fill("200");
    await dialog.getByRole("button", { name: "Save number" }).click();
    await expect(dialog).toBeHidden();
    expect(
      calls.some((c) =>
        c.includes(
          'PATCH /sales/master/running-numbers/returnable_dc {"lastNumber":200,"fiscalYear":"26-27"}',
        ),
      ),
    ).toBe(true);

    await page.getByRole("button", { name: "Edit Quotation format" }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Prefix").fill("tw-qt");
    await dialog.getByLabel("Digits").focus();
    await expect(
      dialog.getByText(/Letters or digits starting with a letter/),
    ).toBeVisible();
    await dialog.getByLabel("Prefix").fill("tw/qt");
    await dialog.getByRole("button", { name: "Save format" }).click();
    await expect(dialog).toBeHidden();
    expect(
      calls.some((c) =>
        c.includes(
          'PATCH /sales/master/code-formats/quotation {"prefix":"TW/QT","padding":4}',
        ),
      ),
    ).toBe(true);
  });

  test("company details: validation bubble, save and logo upload", async ({
    page,
  }) => {
    const { calls } = await signIn(page);
    await open(page, "Setup", "Master List");
    await page.getByRole("tab", { name: "Company details" }).click();
    const form = page.getByRole("form", { name: "Company details" });
    await expect(form.getByLabel("Legal name")).toHaveValue(PROFILE.legalName);
    await expect(form.getByLabel("GST state")).toBeDisabled();

    await form.getByLabel("PAN").fill("ABCDE1234F");
    await form.getByLabel("Email").focus();
    await expect(form.getByText("PAN does not match the GSTIN.")).toBeVisible();
    await form.getByLabel("PAN").fill("AAMCT4293K");
    await form.getByLabel("Phone").fill("+91 44 1234 5678");
    await form.getByRole("button", { name: "Save company details" }).click();
    await expect
      .poll(() =>
        calls.find((c) => c.startsWith("PUT /sales/master/company-profile {")),
      )
      .toContain('"phone":"+91 44 1234 5678"');

    await page.getByLabel("Logo file").setInputFiles({
      name: "logo.png",
      mimeType: "image/png",
      buffer: PNG,
    });
    await expect
      .poll(() =>
        calls.some((c) =>
          c.startsWith("PUT /sales/master/company-profile/logo"),
        ),
      )
      .toBe(true);
  });

  test("document fields: one shared list per field; add a signature, upload a seal image", async ({
    page,
  }) => {
    const { calls } = await signIn(page);
    await open(page, "Setup", "Master List");
    await page.getByRole("tab", { name: "Document fields" }).click();
    const seals = page.getByRole("region", { name: "Company seals" });
    await expect(seals.getByText(SEAL.label)).toBeVisible();
    await expect(seals.getByText("Default")).toBeVisible();
    // Added once, offered on every document that has a seal.
    const usedOn = seals.getByRole("list", {
      name: "Company seals are used on",
    });
    for (const doc of ["Quotation", "Tax invoice", "Returnable DC"]) {
      await expect(usedOn.getByText(doc, { exact: true })).toBeVisible();
    }
    await expect(page.getByLabel("Document", { exact: true })).toHaveCount(0);

    await page.getByLabel(`Image for ${SEAL.label}`).setInputFiles({
      name: "seal.png",
      mimeType: "image/png",
      buffer: PNG,
    });
    await expect
      .poll(() =>
        calls.some((c) =>
          c.startsWith("PUT /sales/master/document-fields/51/image"),
        ),
      )
      .toBe(true);

    await page
      .getByRole("button", { name: "Add authorized signatures" })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Add option" }).click();
    await expect(dialog.getByText("This field is required.")).toBeVisible();
    await dialog.getByLabel("Label").fill("Managing Director Signature");
    await dialog.getByRole("button", { name: "Add option" }).click();
    await expect(dialog).toBeHidden();
    const post = calls.find((c) =>
      c.startsWith("POST /sales/master/document-fields {"),
    );
    expect(post).not.toContain("documentType");
    expect(post).toContain('"field":"AUTHORIZED_SIGNATURE"');
    expect(post).toContain('"label":"Managing Director Signature"');
  });

  test("a master-list reader sees values but no edit controls", async ({
    page,
  }) => {
    await signIn(page, ["sales.dashboard.read", "sales.master.read"]);
    await open(page, "Setup", "Master List");
    await expect(page.getByText("TW/RDC/26-27/0102")).toBeVisible();
    await expect(page.getByRole("button", { name: /format$/ })).toHaveCount(0);
    await page.getByRole("tab", { name: "Company details" }).click();
    await expect(page.getByLabel("Legal name")).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Save company details" }),
    ).toHaveCount(0);
  });
});
