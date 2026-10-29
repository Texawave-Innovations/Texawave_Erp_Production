import { expect, type Page, test } from "@playwright/test";
import {
  type MockAnswer,
  type MockRequest,
  page1,
  signInWithMockedApi,
} from "./helpers/mock-api";

interface MockAccount {
  id: number;
  organizationId: number;
  accountCode: string;
  accountName: string;
  accountType: string;
  currency: string;
  currentBalance: number;
  isActive: boolean;
}

interface MockJournalLine {
  id: number;
  journalEntryId: number;
  accountId: number;
  debit: number;
  credit: number;
  description: string | null;
  account: {
    id: number;
    accountCode: string;
    accountName: string;
    accountType: string;
  };
}

interface MockJournalEntry {
  id: number;
  organizationId: number;
  entryNumber: string;
  entryDate: string;
  entryType: string;
  status: "DRAFT" | "POSTED" | "REVERSED";
  narration: string;
  referenceNumber: string | null;
  totalDebit: number;
  totalCredit: number;
  postedAt: string | null;
  postedBy: number | null;
  reversedAt: string | null;
  reversedBy: number | null;
  reversalReason: string | null;
  reversalEntryId: number | null;
  createdAt: string;
  updatedAt: string;
  lines: MockJournalLine[];
}

const mockAccounts: MockAccount[] = [
  {
    id: 1,
    organizationId: 1,
    accountCode: "1010",
    accountName: "Cash on Hand",
    accountType: "ASSET",
    currency: "INR",
    currentBalance: 50000,
    isActive: true,
  },
  {
    id: 2,
    organizationId: 1,
    accountCode: "5010",
    accountName: "Office Supplies Expense",
    accountType: "EXPENSE",
    currency: "INR",
    currentBalance: 12000,
    isActive: true,
  },
  {
    id: 3,
    organizationId: 1,
    accountCode: "2010",
    accountName: "Accounts Payable",
    accountType: "LIABILITY",
    currency: "INR",
    currentBalance: 25000,
    isActive: true,
  },
];

let mockJournalEntries: MockJournalEntry[] = [
  {
    id: 1,
    organizationId: 1,
    entryNumber: "JV-202610-0001",
    entryDate: "2026-10-15T00:00:00.000Z",
    entryType: "MANUAL",
    status: "DRAFT",
    narration: "Office stationery purchase voucher",
    referenceNumber: "INV-8821",
    totalDebit: 4500,
    totalCredit: 4500,
    postedAt: null,
    postedBy: null,
    reversedAt: null,
    reversedBy: null,
    reversalReason: null,
    reversalEntryId: null,
    createdAt: "2026-10-15T10:00:00.000Z",
    updatedAt: "2026-10-15T10:00:00.000Z",
    lines: [
      {
        id: 101,
        journalEntryId: 1,
        accountId: 2,
        debit: 4500,
        credit: 0,
        description: "Stationery and printing supplies",
        account: {
          id: 2,
          accountCode: "5010",
          accountName: "Office Supplies Expense",
          accountType: "EXPENSE",
        },
      },
      {
        id: 102,
        journalEntryId: 1,
        accountId: 1,
        debit: 0,
        credit: 4500,
        description: "Paid via petty cash",
        account: {
          id: 1,
          accountCode: "1010",
          accountName: "Cash on Hand",
          accountType: "ASSET",
        },
      },
    ],
  },
  {
    id: 2,
    organizationId: 1,
    entryNumber: "JV-202610-0002",
    entryDate: "2026-10-16T00:00:00.000Z",
    entryType: "MANUAL",
    status: "POSTED",
    narration: "Vendor invoice settlement",
    referenceNumber: "BILL-1049",
    totalDebit: 15000,
    totalCredit: 15000,
    postedAt: "2026-10-16T11:00:00.000Z",
    postedBy: 1,
    reversedAt: null,
    reversedBy: null,
    reversalReason: null,
    reversalEntryId: null,
    createdAt: "2026-10-16T10:30:00.000Z",
    updatedAt: "2026-10-16T11:00:00.000Z",
    lines: [
      {
        id: 103,
        journalEntryId: 2,
        accountId: 3,
        debit: 15000,
        credit: 0,
        description: "Vendor settlement clearing",
        account: {
          id: 3,
          accountCode: "2010",
          accountName: "Accounts Payable",
          accountType: "LIABILITY",
        },
      },
      {
        id: 104,
        journalEntryId: 2,
        accountId: 1,
        debit: 0,
        credit: 15000,
        description: "Settled from bank cash",
        account: {
          id: 1,
          accountCode: "1010",
          accountName: "Cash on Hand",
          accountType: "ASSET",
        },
      },
    ],
  },
];

function handler(req: MockRequest): MockAnswer | undefined {
  const { method, pathname, search, body } = req;

  // Session restore on page reload
  if (pathname === "/auth/refresh" && method === "POST") {
    const token = `${Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url")}.${Buffer.from(JSON.stringify({ organizationId: 1, sub: 1 })).toString("base64url")}.sig`;
    return {
      body: {
        data: {
          accessToken: token,
          refreshToken: "r",
        },
      },
    };
  }

  // Global unread notifications count query from Navbar
  if (pathname === "/notifications/unread-count" && method === "GET") {
    return { body: { data: { count: 0 } } };
  }

  // Accounts endpoint
  if (pathname === "/finance/accounts" && method === "GET") {
    const limitParam = search.get("limit");
    if (limitParam && Number(limitParam) > 100) {
      return {
        status: 400,
        body: {
          statusCode: 400,
          message: ["limit must not be greater than 100"],
          error: "Bad Request",
        },
      };
    }
    return { body: page1(mockAccounts) };
  }

  // Journal entries list
  if (pathname === "/finance/journal-entries" && method === "GET") {
    const searchVal = search.get("search")?.toLowerCase();
    const statusVal = search.get("status");

    let filtered = [...mockJournalEntries];
    if (searchVal) {
      filtered = filtered.filter(
        (e) =>
          e.entryNumber.toLowerCase().includes(searchVal) ||
          e.narration.toLowerCase().includes(searchVal) ||
          (e.referenceNumber &&
            e.referenceNumber.toLowerCase().includes(searchVal)),
      );
    }
    if (statusVal) {
      filtered = filtered.filter((e) => e.status === statusVal);
    }
    return { body: page1(filtered) };
  }

  // Single journal entry detail
  const detailMatch = pathname.match(/^\/finance\/journal-entries\/(\d+)$/);
  if (detailMatch && method === "GET") {
    const id = Number(detailMatch[1]);
    const found = mockJournalEntries.find((e) => e.id === id);
    if (!found) return { status: 404, body: { message: "Voucher not found" } };
    return { body: { data: found } };
  }

  // Create journal entry
  if (pathname === "/finance/journal-entries" && method === "POST") {
    const input = body as {
      entryDate: string;
      entryType: string;
      narration: string;
      referenceNumber?: string;
      lines: Array<{
        accountId: number;
        debit: number;
        credit: number;
        description?: string;
      }>;
    };

    const nextId = mockJournalEntries.length + 1;
    const totalDebit = input.lines.reduce((s, l) => s + (l.debit || 0), 0);
    const totalCredit = input.lines.reduce((s, l) => s + (l.credit || 0), 0);

    const created: MockJournalEntry = {
      id: nextId,
      organizationId: 1,
      entryNumber: `JV-202610-000${nextId}`,
      entryDate: input.entryDate,
      entryType: input.entryType || "MANUAL",
      status: "DRAFT",
      narration: input.narration,
      referenceNumber: input.referenceNumber || null,
      totalDebit,
      totalCredit,
      postedAt: null,
      postedBy: null,
      reversedAt: null,
      reversedBy: null,
      reversalReason: null,
      reversalEntryId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lines: input.lines.map((l, idx) => {
        const acc =
          mockAccounts.find((a) => a.id === l.accountId) || mockAccounts[0]!;
        return {
          id: nextId * 100 + idx + 1,
          journalEntryId: nextId,
          accountId: l.accountId,
          debit: l.debit || 0,
          credit: l.credit || 0,
          description: l.description || null,
          account: {
            id: acc.id,
            accountCode: acc.accountCode,
            accountName: acc.accountName,
            accountType: acc.accountType,
          },
        };
      }),
    };

    mockJournalEntries.unshift(created);
    return { status: 201, body: { data: created } };
  }

  // Post journal entry
  const postMatch = pathname.match(/^\/finance\/journal-entries\/(\d+)\/post$/);
  if (postMatch && method === "POST") {
    const id = Number(postMatch[1]);
    const found = mockJournalEntries.find((e) => e.id === id);
    if (!found) return { status: 404, body: { message: "Voucher not found" } };
    found.status = "POSTED";
    found.postedAt = new Date().toISOString();
    found.postedBy = 1;
    return { body: { data: found } };
  }

  // Reverse journal entry
  const reverseMatch = pathname.match(
    /^\/finance\/journal-entries\/(\d+)\/reverse$/,
  );
  if (reverseMatch && method === "POST") {
    const id = Number(reverseMatch[1]);
    const input = body as { reason: string };
    const found = mockJournalEntries.find((e) => e.id === id);
    if (!found) return { status: 404, body: { message: "Voucher not found" } };
    found.status = "REVERSED";
    found.reversedAt = new Date().toISOString();
    found.reversedBy = 1;
    found.reversalReason = input.reason;
    return { body: { data: found } };
  }

  // General ledger report
  if (pathname === "/finance/reports/general-ledger" && method === "GET") {
    const accountId = Number(search.get("accountId") || 1);
    const acc =
      mockAccounts.find((a) => a.id === accountId) || mockAccounts[0]!;

    return {
      body: {
        data: {
          account: {
            id: acc.id,
            accountCode: acc.accountCode,
            accountName: acc.accountName,
            accountType: acc.accountType,
            currency: acc.currency,
            currentBalance: acc.currentBalance,
          },
          openingBalance: 20000,
          closingBalance: 50000,
          totalDebit: 45000,
          totalCredit: 15000,
          period: {
            startDate: search.get("startDate") || undefined,
            endDate: search.get("endDate") || undefined,
          },
          transactions: [
            {
              id: 1,
              entryNumber: "JV-202610-0002",
              entryDate: "2026-10-16T00:00:00.000Z",
              entryType: "MANUAL",
              narration: "Vendor invoice settlement",
              referenceNumber: "BILL-1049",
              lineId: 104,
              description: "Settled from bank cash",
              debit: 0,
              credit: 15000,
              runningBalance: 35000,
              status: "POSTED",
            },
          ],
        },
      },
    };
  }

  return undefined;
}

const FINANCE_PERMISSIONS = [
  "hr.workspace.access",
  "finance.journal.read",
  "finance.journal.write",
  "finance.journal.post",
  "finance.coa.read",
];

const MENU_ITEMS = [
  {
    code: "finance-journal-entries",
    label: "Journal Vouchers",
    path: "/finance/journal-entries",
  },
  {
    code: "finance-general-ledger",
    label: "General Ledger",
    path: "/finance/general-ledger",
  },
];

test.describe("Finance Journal Vouchers & General Ledger E2E", () => {
  test.beforeEach(async () => {
    // Reset mock data before each test
    mockJournalEntries = [
      {
        id: 1,
        organizationId: 1,
        entryNumber: "JV-202610-0001",
        entryDate: "2026-10-15T00:00:00.000Z",
        entryType: "MANUAL",
        status: "DRAFT",
        narration: "Office stationery purchase voucher",
        referenceNumber: "INV-8821",
        totalDebit: 4500,
        totalCredit: 4500,
        postedAt: null,
        postedBy: null,
        reversedAt: null,
        reversedBy: null,
        reversalReason: null,
        reversalEntryId: null,
        createdAt: "2026-10-15T10:00:00.000Z",
        updatedAt: "2026-10-15T10:00:00.000Z",
        lines: [
          {
            id: 101,
            journalEntryId: 1,
            accountId: 2,
            debit: 4500,
            credit: 0,
            description: "Stationery and printing supplies",
            account: {
              id: 2,
              accountCode: "5010",
              accountName: "Office Supplies Expense",
              accountType: "EXPENSE",
            },
          },
          {
            id: 102,
            journalEntryId: 1,
            accountId: 1,
            debit: 0,
            credit: 4500,
            description: "Paid via petty cash",
            account: {
              id: 1,
              accountCode: "1010",
              accountName: "Cash on Hand",
              accountType: "ASSET",
            },
          },
        ],
      },
      {
        id: 2,
        organizationId: 1,
        entryNumber: "JV-202610-0002",
        entryDate: "2026-10-16T00:00:00.000Z",
        entryType: "MANUAL",
        status: "POSTED",
        narration: "Vendor invoice settlement",
        referenceNumber: "BILL-1049",
        totalDebit: 15000,
        totalCredit: 15000,
        postedAt: "2026-10-16T11:00:00.000Z",
        postedBy: 1,
        reversedAt: null,
        reversedBy: null,
        reversalReason: null,
        reversalEntryId: null,
        createdAt: "2026-10-16T10:30:00.000Z",
        updatedAt: "2026-10-16T11:00:00.000Z",
        lines: [
          {
            id: 103,
            journalEntryId: 2,
            accountId: 3,
            debit: 15000,
            credit: 0,
            description: "Vendor settlement clearing",
            account: {
              id: 3,
              accountCode: "2010",
              accountName: "Accounts Payable",
              accountType: "LIABILITY",
            },
          },
          {
            id: 104,
            journalEntryId: 2,
            accountId: 1,
            debit: 0,
            credit: 15000,
            description: "Settled from bank cash",
            account: {
              id: 1,
              accountCode: "1010",
              accountName: "Cash on Hand",
              accountType: "ASSET",
            },
          },
        ],
      },
    ];
  });

  test("displays journal vouchers list and status badges", async ({
    page,
  }: {
    page: Page;
  }) => {
    await signInWithMockedApi(page, {
      permissions: FINANCE_PERMISSIONS,
      workspace: "hr",
      menu: MENU_ITEMS,
      handler,
    });

    await page.goto("/finance/journal-entries");

    // Check page title and description
    await expect(
      page.getByRole("heading", { name: /Journal (Entries|Vouchers)/i }),
    ).toBeVisible();
    await expect(
      page.getByText("Sequential double-entry vouchers"),
    ).toBeVisible();

    // Verify vouchers rendered in table
    await expect(page.getByText("JV-202610-0001")).toBeVisible();
    await expect(
      page.getByText("Office stationery purchase voucher"),
    ).toBeVisible();
    await expect(page.getByText("JV-202610-0002")).toBeVisible();
    await expect(page.getByText("Vendor invoice settlement")).toBeVisible();

    // Verify status badges
    await expect(page.getByText("Draft", { exact: true })).toBeVisible();
    await expect(page.getByText("Posted", { exact: true })).toBeVisible();
  });

  test("JV-001: Initial form renders required fields and two default ledger lines", async ({
    page,
  }: {
    page: Page;
  }) => {
    await signInWithMockedApi(page, {
      permissions: FINANCE_PERMISSIONS,
      workspace: "hr",
      menu: MENU_ITEMS,
      handler,
    });

    await page.goto("/finance/journal-entries");
    await page.getByRole("button", { name: "New Journal Voucher" }).click();

    // Check dialog title and container
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: "Create Journal Voucher" }),
    ).toBeVisible();

    // Required fields visible
    await expect(dialog.getByText("Posting Date")).toBeVisible();
    await expect(dialog.getByText(/Entry Type/)).toBeVisible();
    await expect(
      dialog.getByText(/Narration \/ Business Purpose/i),
    ).toBeVisible();

    // Exactly 2 initial lines (each line has debit and credit inputs)
    const numberInputs = dialog.locator('input[type="number"]');
    await expect(numberInputs).toHaveCount(4);

    // Debits and credits totals visible
    await expect(
      dialog.getByText("Total Debit", { exact: true }),
    ).toBeVisible();
    await expect(
      dialog.getByText("Total Credit", { exact: true }),
    ).toBeVisible();
    await expect(dialog.getByText("Difference", { exact: true })).toBeVisible();
  });

  test("JV-002: Balanced voucher (₹45/₹45, diff ₹0, readiness message, submits successfully)", async ({
    page,
  }: {
    page: Page;
  }) => {
    await signInWithMockedApi(page, {
      permissions: FINANCE_PERMISSIONS,
      workspace: "hr",
      menu: MENU_ITEMS,
      handler,
    });

    await page.goto("/finance/journal-entries");
    await page.getByRole("button", { name: "New Journal Voucher" }).click();

    // Enter narration
    await page
      .getByPlaceholder(/Accrual of monthly|Monthly depreciation entry/i)
      .fill("JV-002 Test Voucher");

    // Debit = 45 on line 1, Credit = 45 on line 2
    const numberInputs = page.locator('input[type="number"]');
    await numberInputs.nth(0).fill("45");
    await numberInputs.nth(3).fill("45");

    // Difference ₹0
    await expect(
      page.getByText("Voucher is Balanced (Debits equal Credits)"),
    ).toBeVisible();
    await expect(
      page.getByText("Balanced voucher is ready to be recorded."),
    ).toBeVisible();

    const submitBtn = page.getByRole("button", {
      name: "Create Journal Voucher",
    });
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    await expect(page.getByText("JV-002 Test Voucher")).toBeVisible({
      timeout: 5000,
    });
  });

  test("JV-003: Unbalanced voucher (₹45/₹50, diff ₹5, directional guidance, prevents submit)", async ({
    page,
  }: {
    page: Page;
  }) => {
    await signInWithMockedApi(page, {
      permissions: FINANCE_PERMISSIONS,
      workspace: "hr",
      menu: MENU_ITEMS,
      handler,
    });

    await page.goto("/finance/journal-entries");
    await page.getByRole("button", { name: "New Journal Voucher" }).click();

    await page
      .getByPlaceholder(/Accrual of monthly|Monthly depreciation entry/i)
      .fill("Unbalanced Test");

    const numberInputs = page.locator('input[type="number"]');
    await numberInputs.nth(0).fill("45");
    await numberInputs.nth(3).fill("50");

    // Diff = ₹5.00 and directional guidance
    await expect(
      page.getByText("Out of balance by ₹5.00", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Add ₹5.00 to Debit to balance")).toBeVisible();

    const submitBtn = page.getByRole("button", {
      name: "Create Journal Voucher",
    });
    await expect(submitBtn).toBeDisabled();

    // Verify neither amount silently changed
    await expect(numberInputs.nth(0)).toHaveValue("45");
    await expect(numberInputs.nth(3)).toHaveValue("50");
  });

  test("JV-004: Minimum ledger lines (cannot delete below 2 lines)", async ({
    page,
  }: {
    page: Page;
  }) => {
    await signInWithMockedApi(page, {
      permissions: FINANCE_PERMISSIONS,
      workspace: "hr",
      menu: MENU_ITEMS,
      handler,
    });

    await page.goto("/finance/journal-entries");
    await page.getByRole("button", { name: "New Journal Voucher" }).click();

    // No remove button when exactly 2 lines exist
    await expect(
      page.getByRole("button", { name: /Remove line/i }),
    ).toHaveCount(0);

    // Add 3rd line
    await page.getByRole("button", { name: "Add Journal Line" }).click();
    await expect(
      page.getByRole("button", { name: /Remove line/i }),
    ).toHaveCount(3);

    // Remove the 3rd line
    await page.getByRole("button", { name: "Remove line 3" }).click();
    // After removing, 2 lines remain, remove buttons disappear
    await expect(
      page.getByRole("button", { name: /Remove line/i }),
    ).toHaveCount(0);
  });

  test("JV-005: Zero-value voucher rejected (submit disabled)", async ({
    page,
  }: {
    page: Page;
  }) => {
    await signInWithMockedApi(page, {
      permissions: FINANCE_PERMISSIONS,
      workspace: "hr",
      menu: MENU_ITEMS,
      handler,
    });

    await page.goto("/finance/journal-entries");
    await page.getByRole("button", { name: "New Journal Voucher" }).click();

    await page
      .getByPlaceholder(/Accrual of monthly|Monthly depreciation entry/i)
      .fill("Zero voucher");

    // Both lines 0
    const submitBtn = page.getByRole("button", {
      name: "Create Journal Voucher",
    });
    await expect(submitBtn).toBeDisabled();
    await expect(
      page.getByText(
        "Enter debit and credit amounts for at least two accounts",
      ),
    ).toBeVisible();
  });

  test("JV-006: Debit/credit mutually exclusive per line", async ({
    page,
  }: {
    page: Page;
  }) => {
    await signInWithMockedApi(page, {
      permissions: FINANCE_PERMISSIONS,
      workspace: "hr",
      menu: MENU_ITEMS,
      handler,
    });

    await page.goto("/finance/journal-entries");
    await page.getByRole("button", { name: "New Journal Voucher" }).click();

    const numberInputs = page.locator('input[type="number"]');
    // Enter debit on line 1
    await numberInputs.nth(0).fill("100");
    await expect(numberInputs.nth(0)).toHaveValue("100");
    await expect(numberInputs.nth(1)).toHaveValue("");

    // Now enter credit on line 1
    await numberInputs.nth(1).fill("200");
    await expect(numberInputs.nth(1)).toHaveValue("200");
    // Debit on line 1 should now be cleared
    await expect(numberInputs.nth(0)).toHaveValue("");

    // Line 2 inputs should remain unaffected
    await expect(numberInputs.nth(2)).toHaveValue("");
    await expect(numberInputs.nth(3)).toHaveValue("");
  });

  test("JV-007: Required fields validation (missing narration disables or rejects submit)", async ({
    page,
  }: {
    page: Page;
  }) => {
    await signInWithMockedApi(page, {
      permissions: FINANCE_PERMISSIONS,
      workspace: "hr",
      menu: MENU_ITEMS,
      handler,
    });

    await page.goto("/finance/journal-entries");
    await page.getByRole("button", { name: "New Journal Voucher" }).click();

    // Fill balanced amounts but leave narration empty
    const numberInputs = page.locator('input[type="number"]');
    await numberInputs.nth(0).fill("100");
    await numberInputs.nth(3).fill("100");

    // Click submit
    const submitBtn = page.getByRole("button", {
      name: "Create Journal Voucher",
    });
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // Error message appears for narration
    await expect(page.getByText("Voucher narration is required")).toBeVisible();
  });

  test("validates double-entry balancing before submitting a new voucher", async ({
    page,
  }: {
    page: Page;
  }) => {
    await signInWithMockedApi(page, {
      permissions: FINANCE_PERMISSIONS,
      workspace: "hr",
      menu: MENU_ITEMS,
      handler,
    });

    await page.goto("/finance/journal-entries");

    // Open create dialog
    const newBtn = page.getByRole("button", { name: "New Journal Voucher" });
    await expect(newBtn).toBeVisible();
    await newBtn.click();

    // Check dialog title
    await expect(
      page.getByRole("heading", {
        name: /Create Journal Voucher|Record Double-Entry Journal Voucher/i,
      }),
    ).toBeVisible();

    // Fill narration
    await page
      .getByPlaceholder(/Accrual of monthly|Monthly depreciation entry/i)
      .fill("Hardware depreciation");

    // Check unbalanced state: submit button should be disabled
    const submitBtn = page.getByRole("button", {
      name: /Create Journal Voucher|Record Voucher/i,
    });
    await expect(submitBtn).toBeDisabled();

    // Balance lines: Debit 12,000 and Credit 12,000
    const numberInputs = page.locator('input[type="number"]');
    // First line debit
    await numberInputs.nth(0).fill("12000");
    // Second line credit (first line credit is index 1, second line debit is index 2, second line credit is index 3)
    await numberInputs.nth(3).fill("12000");

    // Wait for balanced indicator
    await expect(
      page.getByText("Voucher is Balanced (Debits equal Credits)"),
    ).toBeVisible();
    await expect(submitBtn).toBeEnabled();

    // Submit voucher
    await submitBtn.click();

    // Check success notification or new voucher in list
    await expect(page.getByText("Hardware depreciation")).toBeVisible({
      timeout: 5000,
    });
  });

  test("displays general ledger account statement and running balances", async ({
    page,
  }: {
    page: Page;
  }) => {
    await signInWithMockedApi(page, {
      permissions: FINANCE_PERMISSIONS,
      workspace: "hr",
      menu: MENU_ITEMS,
      handler,
    });

    await page.goto("/finance/general-ledger?accountId=1");

    // Verify page header
    await expect(
      page.getByRole("heading", { name: "General Ledger" }),
    ).toBeVisible();
    await expect(page.getByText("Account Statement")).toBeVisible();

    // Verify metrics cards
    await expect(
      page.getByText("Active Account", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Opening Balance")).toBeVisible();
    await expect(page.getByText("Closing Balance")).toBeVisible();

    // Verify transactions in table
    await expect(page.getByText("JV-202610-0002")).toBeVisible();
    await expect(page.getByText("Settled from bank cash")).toBeVisible();
  });

  test("loads accounts dropdown on general ledger without initial accountId and verifies no 400 error", async ({
    page,
  }: {
    page: Page;
  }) => {
    await signInWithMockedApi(page, {
      permissions: FINANCE_PERMISSIONS,
      workspace: "hr",
      menu: MENU_ITEMS,
      handler,
    });

    await page.goto("/finance/general-ledger");

    // Verify page header
    await expect(
      page.getByRole("heading", { name: "General Ledger" }),
    ).toBeVisible();

    // Wait for accounts dropdown to load accounts
    await expect(page.getByRole("combobox")).toContainText(
      "1010 — Cash on Hand",
    );

    // Verify error banner is NOT visible
    await expect(page.getByText("Failed to load Accounts")).not.toBeVisible();

    // Verify metrics cards for default account (1010 - Cash on Hand)
    await expect(
      page.getByText("Active Account", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("1010", { exact: true })).toBeVisible();
    await expect(page.getByText("Cash on Hand", { exact: true })).toBeVisible();
  });

  test("navigates between Accounting sub-tabs within the Finance Hub", async ({
    page,
  }: {
    page: Page;
  }) => {
    await signInWithMockedApi(page, {
      permissions: FINANCE_PERMISSIONS,
      workspace: "hr",
      menu: MENU_ITEMS,
      handler,
    });

    await page.goto("/finance/journal-entries");

    // Check that Finance Hub header is visible
    await expect(page.getByRole("heading", { name: "Finance" })).toBeVisible();

    // Contextual sub-nav has active Journal Entries link and General Ledger link
    const subNav = page.getByRole("navigation", {
      name: "accounting sub-navigation",
    });
    const glLink = subNav.getByRole("link", { name: "General Ledger" });
    await expect(glLink).toBeVisible();

    // Click General Ledger sub-tab link
    await glLink.click();
    await expect(page).toHaveURL(/.*\/finance\/general-ledger/);
    await expect(
      page.getByRole("heading", { name: "General Ledger" }),
    ).toBeVisible();
  });
});
