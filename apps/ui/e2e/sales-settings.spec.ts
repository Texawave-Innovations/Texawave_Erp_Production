import { expect, type Page, test } from "@playwright/test";
import {
  type MockAnswer,
  type MockRequest,
  navigateToMasterTab,
  page1,
  signInWithMockedApi,
} from "./helpers/mock-api";

/**
 * Sales & Document Masters screen (Docs/SALES_SETTINGS_FOUNDATION.md): the
 * three top-level tabs render, the Company Detail form (Sales Settings →
 * Company) sends only the declared fields and shows a success toast on
 * save, the Seals & Signatures masterlists (company seal / authorized
 * signature) add and delete through the real UI, and the Terms & Inventory
 * masterlist (8 categories, same shape as the SCM/Finance master screens)
 * adds and deletes a chip. API fully mocked — the backend's own rules are
 * proven by apps/api/test/sales-settings.e2e-spec.ts.
 */

// 1x1 transparent PNG, well under the 5MB/5MB base64 limit.
const PNG_DATA_URI =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

interface MockSealSignature {
  id: number;
  organizationId: number;
  kind: "company_seal" | "authorized_signature";
  title: string;
  signatoryName: string | null;
  designation: string | null;
  imageDataUri: string;
  customFields: Record<string, unknown>;
  createdBy: number;
  updatedBy: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

const SEED_COMPANY_SEALS: MockSealSignature[] = [
  {
    id: 11,
    organizationId: 1,
    kind: "company_seal",
    title: "Head Office Seal",
    signatoryName: null,
    designation: null,
    imageDataUri: PNG_DATA_URI,
    customFields: {},
    createdBy: 1,
    updatedBy: 1,
    createdAt: "2026-10-01T10:00:00.000Z",
    updatedAt: "2026-10-01T10:00:00.000Z",
    deletedAt: null,
  },
];

const SEED_AUTHORIZED_SIGNATURES: MockSealSignature[] = [
  {
    id: 21,
    organizationId: 1,
    kind: "authorized_signature",
    title: "Finance Director",
    signatoryName: "A. Director",
    designation: "Finance Director",
    imageDataUri: PNG_DATA_URI,
    customFields: {},
    createdBy: 1,
    updatedBy: 1,
    createdAt: "2026-10-01T10:00:00.000Z",
    updatedAt: "2026-10-01T10:00:00.000Z",
    deletedAt: null,
  },
];

const SEED_MASTER_LIST_ITEMS: Record<
  string,
  Array<{ id: number; value: string }>
> = {
  payment_term: [{ id: 31, value: "Net 30" }],
};

// Reset before every test so mutations in one test (add/delete) never leak
// into the next — Playwright may reuse this module's state across tests
// assigned to the same worker.
let companySeals: MockSealSignature[] = [];
let authorizedSignatures: MockSealSignature[] = [];
let masterListItems: Record<string, Array<{ id: number; value: string }>> = {};

test.beforeEach(() => {
  companySeals = SEED_COMPANY_SEALS.map((s) => ({ ...s }));
  authorizedSignatures = SEED_AUTHORIZED_SIGNATURES.map((s) => ({ ...s }));
  masterListItems = Object.fromEntries(
    Object.entries(SEED_MASTER_LIST_ITEMS).map(([category, items]) => [
      category,
      items.map((i) => ({ ...i })),
    ]),
  );
});

function masterListItemsHandler(req: MockRequest): MockAnswer | undefined {
  const { method, pathname, search, body } = req;

  if (pathname === "/sales-settings/master-list-items" && method === "GET") {
    const category = search.get("category") ?? "";
    return { body: page1(masterListItems[category] ?? []) };
  }

  if (pathname === "/sales-settings/master-list-items" && method === "POST") {
    const input = body as { category: string; value: string };
    const created = { id: 32, value: input.value };
    masterListItems[input.category] = [
      ...(masterListItems[input.category] ?? []),
      created,
    ];
    return {
      status: 201,
      body: { data: { ...created, category: input.category } },
    };
  }

  if (
    pathname.startsWith("/sales-settings/master-list-items/") &&
    method === "DELETE"
  ) {
    const id = Number(pathname.split("/")[3]);
    for (const category of Object.keys(masterListItems)) {
      masterListItems[category] = (masterListItems[category] ?? []).filter(
        (item) => item.id !== id,
      );
    }
    return { status: 204, body: {} };
  }

  return undefined;
}

function sealSignatureHandler(req: MockRequest): MockAnswer | undefined {
  const { method, pathname, body } = req;

  if (pathname === "/sales-settings/company-seals" && method === "GET") {
    return { body: page1(companySeals) };
  }
  if (pathname === "/sales-settings/company-seals" && method === "POST") {
    const input = body as { title: string; imageDataUri: string };
    const created = {
      id: 12,
      organizationId: 1,
      kind: "company_seal" as const,
      title: input.title,
      signatoryName: null,
      designation: null,
      imageDataUri: input.imageDataUri,
      customFields: {},
      createdBy: 1,
      updatedBy: 1,
      createdAt: "2026-10-01T10:00:00.000Z",
      updatedAt: "2026-10-01T10:00:00.000Z",
      deletedAt: null,
    };
    companySeals = [...companySeals, created];
    return { status: 201, body: { data: created } };
  }
  if (
    pathname.startsWith("/sales-settings/company-seals/") &&
    method === "DELETE"
  ) {
    const id = Number(pathname.split("/")[3]);
    companySeals = companySeals.filter((item) => item.id !== id);
    return { status: 204, body: {} };
  }

  if (
    pathname === "/sales-settings/authorized-signatures" &&
    method === "GET"
  ) {
    return { body: page1(authorizedSignatures) };
  }
  if (
    pathname === "/sales-settings/authorized-signatures" &&
    method === "POST"
  ) {
    const input = body as {
      title: string;
      signatoryName?: string;
      designation?: string;
      imageDataUri: string;
    };
    const created = {
      id: 22,
      organizationId: 1,
      kind: "authorized_signature" as const,
      title: input.title,
      signatoryName: input.signatoryName ?? null,
      designation: input.designation ?? null,
      imageDataUri: input.imageDataUri,
      customFields: {},
      createdBy: 1,
      updatedBy: 1,
      createdAt: "2026-10-01T10:00:00.000Z",
      updatedAt: "2026-10-01T10:00:00.000Z",
      deletedAt: null,
    };
    authorizedSignatures = [...authorizedSignatures, created];
    return { status: 201, body: { data: created } };
  }
  if (
    pathname.startsWith("/sales-settings/authorized-signatures/") &&
    method === "DELETE"
  ) {
    const id = Number(pathname.split("/")[3]);
    authorizedSignatures = authorizedSignatures.filter(
      (item) => item.id !== id,
    );
    return { status: 204, body: {} };
  }

  return undefined;
}

const COMPANY_DETAIL = {
  id: 1,
  organizationId: 1,
  name: "Texawave Innovations",
  phone: null,
  email: null,
  website: null,
  addressLine1: null,
  addressLine2: null,
  city: null,
  state: null,
  pincode: null,
  country: null,
  gstin: null,
  pan: null,
  logoDataUri: null,
  customFields: {},
  createdBy: 1,
  updatedBy: 1,
  createdAt: "2026-10-01T10:00:00.000Z",
  updatedAt: "2026-10-01T10:00:00.000Z",
  deletedAt: null,
};

function handler(req: MockRequest): MockAnswer | undefined {
  const { method, pathname } = req;
  if (pathname === "/sales-settings/company-detail" && method === "GET")
    return { body: { data: COMPANY_DETAIL } };
  if (pathname === "/sales-settings/company-detail" && method === "PUT")
    return {
      body: { data: { ...COMPANY_DETAIL, ...(req.body as object) } },
    };
  return masterListItemsHandler(req) ?? sealSignatureHandler(req);
}

const READ = [
  "sales_settings.company_detail.read",
  "sales_settings.document_numbering.read",
  "sales_settings.bank_account.read",
  "sales_settings.authorized_signatory.read",
  "sales_settings.salesperson.read",
  "sales_settings.seal_signature.read",
  "sales_settings.master_list_item.read",
];
const WRITE = [
  "sales_settings.company_detail.write",
  "sales_settings.document_numbering.write",
  "sales_settings.bank_account.write",
  "sales_settings.authorized_signatory.write",
  "sales_settings.salesperson.write",
  "sales_settings.seal_signature.write",
  "sales_settings.master_list_item.write",
];

async function openSalesSettings(page: Page, extraPermissions: string[] = []) {
  const session = await signInWithMockedApi(page, {
    workspace: "hr",
    permissions: ["hr.workspace.access", ...READ, ...extraPermissions],
    menu: [
      {
        code: "sales-settings",
        label: "Sales Settings",
        path: "/settings/sales-settings",
      },
    ],
    handler,
  });
  await navigateToMasterTab(page, "Sales & Document Masters");
  return session;
}

test("shows the three Sales & Document Masters tabs", async ({ page }) => {
  await openSalesSettings(page);
  await expect(page.getByRole("tab", { name: "Sales Settings" })).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "Seals & Signatures" }),
  ).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "Terms & Inventory" }),
  ).toBeVisible();
});

test("saves the company detail form and shows a success toast", async ({
  page,
}) => {
  const { calls } = await openSalesSettings(page, WRITE);
  await expect(page.getByLabel("Company name")).toHaveValue(
    "Texawave Innovations",
  );

  await page.getByLabel("GSTIN").fill("29ABCDE1234F1Z5");
  await page.getByRole("button", { name: "Save company details" }).click();

  await expect(page.getByText("Company details saved")).toBeVisible();
  const [put] = calls
    .filter((c) => c.startsWith("PUT /sales-settings/company-detail"))
    .map((c) => JSON.parse(c.slice(c.indexOf("{"))) as Record<string, unknown>);
  expect(put).toMatchObject({
    name: "Texawave Innovations",
    gstin: "29ABCDE1234F1Z5",
  });
});

test("a reader without the write permission sees no save button", async ({
  page,
}) => {
  await openSalesSettings(page);
  await expect(
    page.getByRole("button", { name: "Save company details" }),
  ).toHaveCount(0);
});

test("adds and deletes a company seal through the Seals & Signatures tab", async ({
  page,
}) => {
  const { calls } = await openSalesSettings(page, WRITE);
  await page.getByRole("tab", { name: "Seals & Signatures" }).click();

  await expect(
    page.getByText("Head Office Seal", { exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Add" }).first().click();
  const dialog = page.getByRole("dialog", {
    name: "Add to Company Seal Masterlist",
  });
  await dialog.getByLabel("Title").fill("Branch Office Seal");
  await dialog.getByLabel("Image").setInputFiles({
    name: "seal.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      PNG_DATA_URI.slice(PNG_DATA_URI.indexOf(",") + 1),
      "base64",
    ),
  });
  await dialog.getByRole("button", { name: "Add" }).click();

  await expect(page.getByText("Item added")).toBeVisible();
  await expect(page.getByText("Branch Office Seal")).toBeVisible();
  expect(
    calls.some(
      (c) =>
        c.startsWith("POST /sales-settings/company-seals") &&
        c.includes("Branch Office Seal"),
    ),
  ).toBe(true);

  await page.getByRole("button", { name: "Delete Head Office Seal" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByText("Head Office Seal")).toHaveCount(0);
});

test("a reader without the write permission sees no Add button on Seals & Signatures", async ({
  page,
}) => {
  await openSalesSettings(page);
  await page.getByRole("tab", { name: "Seals & Signatures" }).click();

  await expect(page.getByText("Head Office Seal")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add" })).toHaveCount(0);
});

test("adds and deletes a payment term chip through the Terms & Inventory tab", async ({
  page,
}) => {
  const { calls } = await openSalesSettings(page, WRITE);
  await page.getByRole("tab", { name: "Terms & Inventory" }).click();

  await expect(
    page.getByRole("heading", { name: "Payment Terms" }),
  ).toBeVisible();
  await expect(page.getByText("Net 30")).toBeVisible();

  await page.getByLabel("New Payment Terms value").fill("Net 60");
  await page.getByLabel("New Payment Terms value").press("Enter");

  await expect(page.getByText("Net 60")).toBeVisible();
  expect(
    calls.some(
      (c) =>
        c.startsWith("POST /sales-settings/master-list-items") &&
        c.includes("Net 60"),
    ),
  ).toBe(true);

  await page.getByRole("button", { name: "Remove Net 30" }).click();
  await expect(page.getByText("Net 30")).toHaveCount(0);
});

test("a reader without the write permission sees no add form on Terms & Inventory", async ({
  page,
}) => {
  await openSalesSettings(page);
  await page.getByRole("tab", { name: "Terms & Inventory" }).click();

  await expect(page.getByLabel("New Payment Terms value")).toHaveCount(0);
});
