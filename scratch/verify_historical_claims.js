async function verifyHistorical() {
  const { PrismaClient } =
    await import("../packages/database/generated/prisma/client.js");
  const prisma = new PrismaClient();

  const claimExpenses = await prisma.financeExpense.findMany({
    where: { hrExpenseClaimId: { not: null } },
    include: { expenseType: true },
    orderBy: { id: "asc" },
  });

  console.log("=== Historical Converted Claim Expenses in Finance ===");
  for (const exp of claimExpenses) {
    const claim = await prisma.expenseClaim.findUnique({
      where: { id: exp.hrExpenseClaimId },
    });
    console.log(
      "Claim #" +
        claim.id +
        " [" +
        claim.expenseType +
        "] (₹" +
        claim.amount +
        ") -> Finance Expense " +
        exp.expenseNumber +
        " [" +
        (exp.expenseType ? exp.expenseType.value : "None") +
        "] (Status: " +
        exp.status +
        ")",
    );
  }

  await prisma.$disconnect();
}
verifyHistorical().catch(console.error);
