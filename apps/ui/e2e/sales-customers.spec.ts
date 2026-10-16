import { expect, test, type Page } from "@playwright/test";
import {
  apiError,
  page1,
  signInWithMockedApi,
  type MockRequest,
} from "./helpers/mock-api";

// Customers screens against a mocked API: list, search, create (GSTIN
// fills state and PAN, client-side validation, server errors on the right
// field), detail with bank reveal, delete guard, and permission-driven
// buttons. Server rules are proven by apps/api/test/sales.e2e-spec.ts.

const MANAGER = [
  "sales.dashboard.read",
  "sales.customer.read",
  "sales.customer.write",
  "sales.customer.delete",
  "sales.customer_bank.reveal",
];
const EXECUTIVE = ["sales.dashboard.read", "sales.customer.read"];

const MENU = [
  { code: "sales-dashboard", label: "Dashboard", path: "/sales/dashboard" },
  { code: "sales-customers", label: "Customers", path: "/sales/customers" },
];

const CUSTOMER = {
  id: 7,
  customerCode: "CUS-IN-001",
  companyName: "Global Enterprises Pvt Ltd",
  contactPerson: "Jane",
  email: "jane@global.test",
  mobileCountryCode: "+91",
  mobileNumber: "9876543210",
  gstin: "33ABCDE1234F1Z5",
  stateCode: "33",
  stateName: "Tamil Nadu",
  cgstRate: "9",
  sgstRate: "9",
  igstRate: null,
  pan: "ABCDE1234F",
  cin: null,
  bankName: "HDFC Bank",
  bankAccountNumberMasked: "XXXXXXXX7890",
  bankIfsc: "HDFC0001234",
  bankBranch: "Adyar",
  paymentNotes: null,
  status: "ACTIVE",
  addresses: [
    {
      id: 1,
      addressType: "BILLING",
      label: "Head Office",
      street: "No 12, Industrial Estate",
      area: "Guindy",
      city: "Chennai",
      stateCode: "33",
      stateName: "Tamil Nadu",
      pincode: "600032",
      country: "India",
      isDefault: true,
    },
  ],
  defaultAddress: null,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
};

function handler(req: MockRequest) {
  const { method, pathname } = req;
  if (method === "GET" && pathname === "/sales/customers") {
    const search = req.search.get("search");
    return {
      body: page1(
        search && !CUSTOMER.companyName.toLowerCase().includes(search)
          ? []
          : [CUSTOMER],
      ),
    };
  }
  if (method === "GET" && pathname === "/sales/customers/next-code") {
    return { body: { data: { customerCode: "CUS-IN-002" } } };
  }
  if (method === "GET" && pathname === "/sales/customers/7") {
    return { body: { data: CUSTOMER } };
  }
  if (method === "GET" && pathname === "/sales/customers/7/bank-account") {
    return { body: { data: { bankAccountNumber: "50100234567890" } } };
  }
  if (method === "POST" && pathname === "/sales/customers") {
    return {
      status: 201,
      body: {
        data: {
          ...CUSTOMER,
          ...(req.body as object),
          id: 7,
          customerCode: "CUS-IN-002",
        },
      },
    };
  }
  if (method === "DELETE" && pathname === "/sales/customers/7") {
    return apiError(
      409,
      "CUSTOMER_HAS_DOCUMENTS",
      "Customer CUS-IN-001 has documents",
    );
  }
  return undefined;
}

/** In-app navigation (a full page load would drop the in-memory session). */
async function goToCustomers(page: Page) {
  await page
    .getByRole("navigation", { name: "Main application navigation" })
    .getByRole("button", { name: "Sales" })
    .click();
  await page
    .getByRole("menu", { name: "Sales categories" })
    .getByRole("link", { name: "Customers" })
    .click();
  await expect(page.getByRole("heading", { name: "Customers" })).toBeVisible();
}

async function openCustomers(
  page: Page,
  permissions: string[],
  answer: (req: MockRequest) => ReturnType<typeof handler> = handler,
) {
  const session = await signInWithMockedApi(page, {
    permissions,
    workspace: "sales",
    menu: MENU,
    handler: answer,
  });
  await goToCustomers(page);
  return session;
}

test.describe("Sales customers", () => {
  test("lists, searches and opens a customer", async ({ page }) => {
    const { calls } = await openCustomers(page, MANAGER);
    await expect(page.getByText("CUS-IN-001")).toBeVisible();

    await page.getByRole("searchbox", { name: "Search customers" }).fill("zzz");
    await expect(
      page.getByText("No customers matched your filters"),
    ).toBeVisible();
    expect(calls.some((c) => c.includes("search=zzz"))).toBe(true);
    await page.getByRole("searchbox", { name: "Search customers" }).fill("");

    await page.getByText("Global Enterprises Pvt Ltd").click();
    await expect(page).toHaveURL(/\/sales\/customers\/7$/);
    await expect(page.getByText("Head Office")).toBeVisible();
    await expect(page.getByText("XXXXXXXX7890")).toBeVisible();
  });

  test("creates a customer; a GSTIN fills in the state and PAN", async ({
    page,
  }) => {
    const { calls } = await openCustomers(page, MANAGER);
    await page.getByRole("button", { name: "New customer" }).first().click();
    await expect(page.getByText(/next: CUS-IN-002/)).toBeVisible();

    // Nothing is sent while required fields are missing.
    await page.getByRole("button", { name: "Create customer" }).click();
    await expect(
      page.getByText("This field is required.").first(),
    ).toBeVisible();
    expect(calls.some((c) => c.startsWith("POST /sales/customers"))).toBe(
      false,
    );

    await page.getByLabel("Company name").fill("ABC Industries Pvt Ltd");
    await page.getByLabel("Contact person").fill("John");
    await page.getByLabel("Email").fill("john@abc.test");
    await page.getByLabel("Mobile number").fill("9876543210");
    await page.getByLabel("GSTIN").fill("29abcde1234f1z5");
    await expect(page.getByLabel("PAN", { exact: true })).toHaveValue(
      "ABCDE1234F",
    );
    await expect(page.getByLabel("State", { exact: true }).first()).toHaveValue(
      "29",
    );

    const address = page.getByRole("group", { name: "Address 1" });
    await address.getByLabel("Street").fill("12 MG Road");
    await address.getByLabel("City").fill("Bengaluru");
    await address.getByLabel("State").selectOption("29");
    await address.getByLabel("Pincode").fill("560001");

    await page.getByRole("button", { name: "Create customer" }).click();
    await expect(page).toHaveURL(/\/sales\/customers\/7$/);
    const post = calls.find((c) => c.startsWith("POST /sales/customers"));
    expect(post).toContain('"gstin":"29ABCDE1234F1Z5"');
    expect(post).toContain('"stateCode":"29"');
    expect(post).toContain('"pan":"ABCDE1234F"');
    expect(post).toContain('"cgstRate":null');
  });

  test("a field's error shows in a bubble as soon as it is left, and clears when fixed", async ({
    page,
  }) => {
    await openCustomers(page, MANAGER);
    await page.getByRole("button", { name: "New customer" }).first().click();

    const mobile = page.getByLabel("Mobile number");
    const message =
      "Enter a valid 10-digit mobile number starting with 6 to 9.";
    await mobile.fill("12345");
    // Nothing yet while typing; the bubble appears on leaving the field.
    await expect(page.getByText(message)).toHaveCount(0);
    await mobile.press("Tab");
    const bubble = page.getByRole("alert").filter({ hasText: message });
    await expect(bubble).toBeVisible();
    // The bubble is wired to the input for screen readers.
    const bubbleId = await bubble.getAttribute("id");
    await expect(mobile).toHaveAttribute(
      "aria-describedby",
      new RegExp(bubbleId ?? "missing"),
    );
    await expect(mobile).toHaveAttribute("aria-invalid", "true");

    await mobile.fill("9876543210");
    await expect(page.getByText(message)).toHaveCount(0);

    // Untouched fields stay quiet until Save.
    await expect(page.getByText("This field is required.")).toHaveCount(0);
  });

  test("every field is validated before anything is sent", async ({ page }) => {
    const { calls } = await openCustomers(page, MANAGER);
    await page.getByRole("button", { name: "New customer" }).first().click();

    await page.getByLabel("Company name").fill("12345");
    await page.getByLabel("Contact person").fill("J0hn");
    await page.getByLabel("Email").fill("not-an-email");
    await page.getByLabel("Mobile number").fill("1234567890");
    await page.getByLabel("GSTIN").fill("99ABCDE1234F1Z5");
    await page.getByLabel("CIN").fill("X123");
    await page.getByLabel("CGST %").fill("9");
    await page.getByLabel("Bank name").fill("Bank 1");
    await page.getByLabel("Account number").fill("1234");
    const address = page.getByRole("group", { name: "Address 1" });
    await address.getByLabel("City").fill("Chennai 2");
    await address.getByLabel("Pincode").fill("012345");
    await page.getByRole("button", { name: "Create customer" }).click();

    for (const message of [
      "Enter a company name (it must contain letters).",
      "Enter a valid email address.",
      "Enter a valid 10-digit mobile number starting with 6 to 9.",
      "The GSTIN does not start with a valid state code.",
      "Enter a valid 21-character CIN.",
      "Enter CGST and SGST together.",
      "Account number must be 9 to 18 digits.",
      "Enter the IFSC code.",
      "Enter a valid 6-digit pincode.",
      "This field is required.",
    ]) {
      await expect(page.getByText(message).first()).toBeVisible();
    }
    // Names (contact, bank, city) use the onboarding rule.
    await expect(
      page.getByText("Enter a valid name (letters only).").first(),
    ).toBeVisible();

    // A customer needs a billing address.
    await address.getByRole("button", { name: "Remove address 1" }).click();
    await page.getByRole("button", { name: "Create customer" }).click();
    await expect(page.getByText("Add a billing address.")).toBeVisible();

    expect(calls.some((c) => c.startsWith("POST /sales/customers"))).toBe(
      false,
    );
  });

  test("a duplicate GSTIN is shown on the GSTIN field", async ({ page }) => {
    await openCustomers(page, MANAGER, (req) =>
      req.method === "POST" && req.pathname === "/sales/customers"
        ? apiError(
            409,
            "CUSTOMER_GSTIN_EXISTS",
            "GSTIN 33ABCDE1234F1Z5 is already used by CUS-IN-001",
          )
        : handler(req),
    );
    await page.getByRole("button", { name: "New customer" }).first().click();
    await page.getByLabel("Company name").fill("Dup Ltd");
    await page.getByLabel("Contact person").fill("A");
    await page.getByLabel("Email").fill("a@dup.test");
    await page.getByLabel("Mobile number").fill("9876543210");
    await page.getByLabel("GSTIN").fill("33ABCDE1234F1Z5");
    const address = page.getByRole("group", { name: "Address 1" });
    await address.getByLabel("Street").fill("1 Main Road");
    await address.getByLabel("City").fill("Chennai");
    await address.getByLabel("State").selectOption("33");
    await address.getByLabel("Pincode").fill("600001");
    await page.getByRole("button", { name: "Create customer" }).click();

    await expect(page.getByText("Customer not saved")).toBeVisible();
    await expect(
      page.getByText("is already used by CUS-IN-001").first(),
    ).toBeVisible();
    // The typed values stay for a retry.
    await expect(page.getByLabel("Company name")).toHaveValue("Dup Ltd");
  });

  test("detail: reveal the bank account; a customer with documents is not deleted", async ({
    page,
  }) => {
    await openCustomers(page, MANAGER);
    await page.getByText("Global Enterprises Pvt Ltd").click();
    await page
      .getByRole("button", { name: "Reveal full account number" })
      .click();
    await expect(page.getByText("50100234567890")).toBeVisible();

    await page.getByRole("button", { name: "Delete" }).first().click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Delete" })
      .click();
    await expect(
      page.getByText("has documents and cannot be deleted"),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/sales\/customers\/7$/);
  });

  test("an executive sees customers but no write, delete or reveal actions", async ({
    page,
  }) => {
    await openCustomers(page, EXECUTIVE);
    await expect(
      page.getByRole("button", { name: "New customer" }),
    ).toHaveCount(0);
    await page.getByText("Global Enterprises Pvt Ltd").click();
    await expect(page.getByText("XXXXXXXX7890")).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Delete" })).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Reveal full account number" }),
    ).toHaveCount(0);
  });
});
