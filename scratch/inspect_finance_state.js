async function inspectFinanceState() {
  const { PrismaClient } =
    await import("../packages/database/generated/prisma/client.js");
  const prisma = new PrismaClient();

  const bankAccounts = await prisma.financeBankAccount.findMany();
  console.log("=== Bank Accounts ===");
  bankAccounts.forEach((b) => {
    console.log(
      `ID: ${b.id} | ${b.accountName} (${b.bankName}) | Num: ${b.accountNumber} | Bal: ${b.currentBalance}`,
    );
  });

  const recentBankTxns = await prisma.financeBankTransaction.findMany({
    take: 10,
    orderBy: { id: "desc" },
  });
  console.log("\n=== Recent Bank Transactions ===");
  recentBankTxns.forEach((t) => {
    console.log(
      `ID: ${t.id} | BankAccId: ${t.bankAccountId} | Type: ${t.transactionType} | Amt: ${t.amount} | BalAfter: ${t.balanceAfter} | Desc: ${t.description}`,
    );
  });

  const recentExpenses = await prisma.financeExpense.findMany({
    take: 10,
    orderBy: { id: "desc" },
    include: { expenseType: true },
  });
  console.log("\n=== Recent Finance Expenses ===");
  recentExpenses.forEach((e) => {
    console.log(
      `ID: ${e.id} | Num: ${e.expenseNumber} | Cat: ${e.expenseType?.value} | Amt: ${e.amount} | Status: ${e.status} | ClaimId: ${e.hrExpenseClaimId}`,
    );
  });

  const recentReceipts = await prisma.financePaymentReceived.findMany({
    take: 10,
    orderBy: { id: "desc" },
  });
  console.log("\n=== Recent Payments Received ===");
  recentReceipts.forEach((r) => {
    console.log(
      `ID: ${r.id} | Num: ${r.paymentNumber} | Cust: ${r.customerName} | Amt: ${r.amount} | BankAccId: ${r.bankAccountId} | Status: ${r.status}`,
    );
  });

  const claims = await prisma.hrExpenseClaim.findMany({
    take: 10,
    orderBy: { id: "desc" },
  });
  console.log("\n=== Recent HR Expense Claims ===");
  claims.forEach((c) => {
    console.log(
      `ID: ${c.id} | ClaimNum: ${c.claimNumber} | Category: ${c.category} | Amt: ${c.amount} | Status: ${c.status} | Converted: ${c.isConvertedToExpense}`,
    );
  });

  const masterList = await prisma.financeMasterListItem.findMany({
    where: { category: "expense_type" },
  });
  console.log("\n=== Finance Master List: expense_type ===");
  masterList.forEach((m) => console.log(`ID: ${m.id} | Value: ${m.value}`));

  await prisma.$disconnect();
}
inspectFinanceState().catch((e) => {
  console.error("Error:", e);
});
