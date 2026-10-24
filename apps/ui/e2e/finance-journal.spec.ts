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

  // Accounts endpoint
  if (pathname === "/finance/accounts" && method === "GET") {
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
        totalDebits: 45000,
        totalCredits: 15000,
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
    };
  }

  return undefined;
}

const FINANCE_PERMISSIONS = [
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
      page.getByRole("heading", { name: "Journal Vouchers" }),
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
        name: "Record Double-Entry Journal Voucher",
      }),
    ).toBeVisible();

    // Fill narration
    await page
      .getByPlaceholder("e.g. Monthly depreciation entry...")
      .fill("Hardware depreciation");

    // Check unbalanced state: submit button should be disabled
    const submitBtn = page.getByRole("button", {
      name: "Record Voucher (Draft)",
    });
    await expect(submitBtn).toBeDisabled();

    // Balance lines: Debit 12,000 and Credit 12,000
    const numberInputs = page.locator('input[type="number"]');
    // First line debit
    await numberInputs.nth(0).fill("12000");
    // Second line credit (first line credit is index 1, second line debit is index 2, second line credit is index 3)
    await numberInputs.nth(3).fill("12000");

    // Wait for balanced indicator
    await expect(page.getByText("Balanced")).toBeVisible();
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
    await expect(page.getByText("Active Account")).toBeVisible();
    await expect(page.getByText("Opening Balance")).toBeVisible();
    await expect(page.getByText("Closing Balance")).toBeVisible();

    // Verify transactions in table
    await expect(page.getByText("JV-202610-0002")).toBeVisible();
    await expect(page.getByText("Settled from bank cash")).toBeVisible();
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
