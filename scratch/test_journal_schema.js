const path = require("path");
const { z } = require(path.resolve(__dirname, "../apps/ui/node_modules/zod"));

const FINANCE_JOURNAL_ENTRY_TYPES = [
  "MANUAL",
  "EXPENSE",
  "PAYMENT_RECEIVED",
  "PAYMENT_MADE",
  "BANK_TRANSFER",
  "OPENING_BALANCE",
  "REVERSAL",
];

const createJournalLineSchema = z.object({
  accountId: z.number().int().positive("Please select an account"),
  debit: z.number().min(0, "Debit cannot be negative").default(0),
  credit: z.number().min(0, "Credit cannot be negative").default(0),
  description: z
    .string()
    .trim()
    .max(255, "Line memo must be 255 characters or fewer")
    .nullable()
    .optional(),
});

const createJournalEntrySchema = z
  .object({
    entryNumber: z
      .string()
      .trim()
      .max(50, "Entry number must be 50 characters or fewer")
      .optional(),
    entryDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
    entryType: z.enum(FINANCE_JOURNAL_ENTRY_TYPES).default("MANUAL"),
    narration: z
      .string()
      .trim()
      .min(1, "Voucher narration is required")
      .max(500, "Narration must be 500 characters or fewer"),
    referenceNumber: z
      .string()
      .trim()
      .max(100, "Reference must be 100 characters or fewer")
      .nullable()
      .optional(),
    lines: z
      .array(createJournalLineSchema)
      .min(2, "A journal voucher must have at least 2 lines for double-entry"),
  })
  .refine(
    (data) => {
      let totalDebit = 0;
      let totalCredit = 0;
      for (const line of data.lines) {
        totalDebit += Number(line.debit || 0);
        totalCredit += Number(line.credit || 0);
      }
      totalDebit = Math.round(totalDebit * 100) / 100;
      totalCredit = Math.round(totalCredit * 100) / 100;
      return totalDebit > 0 && Math.abs(totalDebit - totalCredit) < 0.005;
    },
    {
      message:
        "Total Debits must equal Total Credits, and must be greater than zero",
      path: ["lines"],
    },
  );

// Test 1: Balanced entry
const validEntry = {
  entryDate: "2026-10-27",
  entryType: "MANUAL",
  narration: "Office rent payment",
  referenceNumber: "INV-001",
  lines: [
    { accountId: 1, debit: 5000, credit: 0, description: "Rent expense" },
    { accountId: 2, debit: 0, credit: 5000, description: "Bank cash" },
  ],
};
const res1 = createJournalEntrySchema.safeParse(validEntry);
console.log(
  "Test 1 (Balanced entry):",
  res1.success ? "PASS" : "FAIL",
  res1.error ? res1.error.issues : "",
);

// Test 2: Unbalanced entry
const unbalancedEntry = {
  entryDate: "2026-10-27",
  entryType: "MANUAL",
  narration: "Office rent payment",
  referenceNumber: "INV-001",
  lines: [
    { accountId: 1, debit: 5000, credit: 0, description: "Rent expense" },
    { accountId: 2, debit: 0, credit: 4000, description: "Bank cash" },
  ],
};
const res2 = createJournalEntrySchema.safeParse(unbalancedEntry);
console.log(
  "Test 2 (Unbalanced rejected):",
  !res2.success ? "PASS" : "FAIL",
  res2.error ? res2.error.issues[0].message : "",
);

// Test 3: Single line entry rejected
const singleLineEntry = {
  entryDate: "2026-10-27",
  entryType: "MANUAL",
  narration: "Office rent payment",
  lines: [
    { accountId: 1, debit: 5000, credit: 0, description: "Rent expense" },
  ],
};
const res3 = createJournalEntrySchema.safeParse(singleLineEntry);
console.log(
  "Test 3 (Single line rejected):",
  !res3.success ? "PASS" : "FAIL",
  res3.error ? res3.error.issues[0].message : "",
);

// Test 4: Zero amounts entry rejected
const zeroAmounts = {
  entryDate: "2026-10-27",
  entryType: "MANUAL",
  narration: "Office rent payment",
  lines: [
    { accountId: 1, debit: 0, credit: 0, description: "Rent expense" },
    { accountId: 2, debit: 0, credit: 0, description: "Bank cash" },
  ],
};
const res4 = createJournalEntrySchema.safeParse(zeroAmounts);
console.log(
  "Test 4 (Zero amounts rejected):",
  !res4.success ? "PASS" : "FAIL",
  res4.error ? res4.error.issues[0].message : "",
);
