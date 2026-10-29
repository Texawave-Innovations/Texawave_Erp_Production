import { PrismaClient } from "../../generated/prisma/client.js";

const DEFAULT_ACCOUNTS = [
  {
    accountCode: "1010",
    accountName: "Cash on Hand",
    accountType: "ASSET",
    description: "Petty cash and cash in hand",
  },
  {
    accountCode: "1020",
    accountName: "Operating Bank Account",
    accountType: "ASSET",
    description: "Primary operating bank account",
  },
  {
    accountCode: "1200",
    accountName: "Accounts Receivable",
    accountType: "ASSET",
    description: "Amounts owed by customers for goods/services",
  },
  {
    accountCode: "1300",
    accountName: "GST Input Tax Credit",
    accountType: "ASSET",
    description: "Input GST credit recoverable against output tax liability",
  },
  {
    accountCode: "2010",
    accountName: "Accounts Payable",
    accountType: "LIABILITY",
    description: "Amounts owed to suppliers for bills/expenses",
  },
  {
    accountCode: "2020",
    accountName: "GST Output Tax Payable",
    accountType: "LIABILITY",
    description: "Output GST collected from sales",
  },
  {
    accountCode: "3010",
    accountName: "Owner / Retained Earnings",
    accountType: "EQUITY",
    description: "Cumulative retained net income",
  },
  {
    accountCode: "4010",
    accountName: "Sales Revenue",
    accountType: "REVENUE",
    description: "Revenue from sales invoices and customer contracts",
  },
  {
    accountCode: "5010",
    accountName: "Cost of Goods Sold",
    accountType: "EXPENSE",
    description: "Direct costs of delivering goods/services",
  },
  {
    accountCode: "5020",
    accountName: "General Operating Expenses",
    accountType: "EXPENSE",
    description: "Operational and administrative spending",
  },
  {
    accountCode: "5030",
    accountName: "Payroll Expense",
    accountType: "EXPENSE",
    description: "Salaries and employee compensation",
  },
];

const DEFAULT_MASTER_ITEMS = [
  { category: "expense_type", value: "Office Supplies" },
  { category: "expense_type", value: "Travel & Lodging" },
  { category: "expense_type", value: "Medical" },
  { category: "expense_type", value: "Food & Meals" },
  { category: "expense_type", value: "Accommodation" },
  { category: "expense_type", value: "Software Subscriptions" },
  { category: "expense_type", value: "Utilities" },
  { category: "expense_type", value: "Professional Fees" },
  { category: "expense_type", value: "Other" },
  { category: "payment_mode", value: "Cash" },
  { category: "payment_mode", value: "Bank Transfer" },
  { category: "payment_mode", value: "UPI" },
  { category: "payment_mode", value: "Cheque" },
  { category: "payment_mode", value: "Credit Card" },
];

export async function seedFinance(
  prisma: PrismaClient,
  organizationId: number,
) {
  // 1. Seed Chart of Accounts
  for (const acc of DEFAULT_ACCOUNTS) {
    await prisma.financeAccount.upsert({
      where: {
        organizationId_accountCode: {
          organizationId,
          accountCode: acc.accountCode,
        },
      },
      update: {},
      create: {
        organizationId,
        ...acc,
      },
    });
  }

  // 2. Seed Master List Items
  for (const item of DEFAULT_MASTER_ITEMS) {
    const existing = await prisma.financeMasterListItem.findFirst({
      where: {
        organizationId,
        category: item.category,
        value: item.value,
        deletedAt: null,
      },
    });
    if (!existing) {
      await prisma.financeMasterListItem.create({
        data: {
          organizationId,
          category: item.category,
          value: item.value,
        },
      });
    }
  }
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const org = await prisma.organization.findFirst({ select: { id: true } });
    if (!org) {
      throw new Error("No organization found. Please run baseline seed first.");
    }
    await seedFinance(prisma, org.id);
    console.log(`Finance seed complete for organization ID ${org.id}.`);
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1]?.includes("finance.seed")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
