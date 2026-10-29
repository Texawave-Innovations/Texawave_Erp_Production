async function inspectClaims() {
  const { PrismaClient } =
    await import("../packages/database/generated/prisma/client.js");
  const prisma = new PrismaClient();

  const claims = await prisma.expenseClaim.findMany({
    take: 10,
    orderBy: { id: "desc" },
    include: { employee: true },
  });
  console.log("=== Recent Expense Claims ===");
  claims.forEach((c) => {
    console.log(
      `ID: ${c.id} | ClaimNum: ${c.claimNumber} | Emp: ${c.employee?.firstName} ${c.employee?.lastName} | Cat: ${c.category} | Amt: ${c.amount} | Status: ${c.status} | Converted: ${c.isConvertedToExpense}`,
    );
  });

  const masterList = await prisma.financeMasterListItem.findMany({
    where: { category: "expense_type" },
  });
  console.log("\n=== Finance Master List: expense_type ===");
  masterList.forEach((m) => console.log(`ID: ${m.id} | Value: ${m.value}`));

  await prisma.$disconnect();
}
inspectClaims().catch(console.error);
