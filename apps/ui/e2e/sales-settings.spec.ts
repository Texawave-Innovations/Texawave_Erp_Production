import { expect, type Page, test } from "@playwright/test";
import {
  type MockAnswer,
  type MockRequest,
  navigateToMasterTab,
  signInWithMockedApi,
} from "./helpers/mock-api";

/**
 * Sales & Document Masters screen (Docs/SALES_SETTINGS_FOUNDATION.md): the
 * three top-level tabs render, and the Company Detail form (Sales Settings
 * → Company) sends only the declared fields and shows a success toast on
 * save. API fully mocked — the backend's own rules are proven by
 * apps/api/test/sales-settings.e2e-spec.ts.
 */

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
  return undefined;
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
