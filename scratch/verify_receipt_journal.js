async function verifyReceiptJournal() {
  const { PrismaClient } =
    await import("../packages/database/generated/prisma/client.js");
  const prisma = new PrismaClient();

  const receipt = await prisma.financePaymentReceived.findFirst({
    where: { paymentNumber: "REC-202610-0014" },
    include: {
      bankAccount: true,
      journalEntry: {
        include: {
          lines: {
            include: { account: true },
          },
        },
      },
    },
  });

  console.log("=== Receipt REC-202610-0014 Verification ===");
  console.log("Payment Number:", receipt.paymentNumber);
  console.log("Customer:", receipt.customerName);
  console.log("Amount: ₹" + receipt.amount);
  console.log("Status:", receipt.status);
  console.log(
    "Bank Account:",
    receipt.bankAccount
      ? receipt.bankAccount.accountName +
          " (" +
          receipt.bankAccount.accountNumber +
          ")"
      : "None",
  );
  console.log(
    "Journal Entry Number:",
    receipt.journalEntry ? receipt.journalEntry.entryNumber : "None",
  );
  console.log(
    "Total Debit: ₹" +
      (receipt.journalEntry ? receipt.journalEntry.totalDebit : 0) +
      " | Total Credit: ₹" +
      (receipt.journalEntry ? receipt.journalEntry.totalCredit : 0),
  );
  console.log("Journal Lines:");
  if (receipt.journalEntry && receipt.journalEntry.lines) {
    receipt.journalEntry.lines.forEach((l) => {
      console.log(
        "  Line " +
          l.lineOrder +
          ": " +
          l.account?.accountCode +
          " " +
          l.account?.accountName +
          " (" +
          l.account?.accountType +
          ") | Debit: ₹" +
          l.debit +
          " | Credit: ₹" +
          l.credit +
          " | " +
          l.description,
      );
    });
  }

  await prisma.$disconnect();
}
verifyReceiptJournal().catch(console.error);
