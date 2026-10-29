const fs = require("fs");

const schema = fs.readFileSync(
  "packages/database/prisma/schema.prisma",
  "utf8",
);

const financeModels = [
  "FinanceMasterListItem",
  "FinanceAccount",
  "FinanceJournalEntry",
  "FinanceJournalLine",
  "FinanceBankAccount",
  "FinanceBankTransaction",
  "FinanceExpense",
  "FinancePaymentReceived",
  "FinancePaymentReceivedAllocation",
  "FinancePaymentMade",
  "FinanceGstEntry",
];

let result = {};

financeModels.forEach((modelName) => {
  const regex = new RegExp(`model\\s+${modelName}\\s+\\{([^}]+)\\}`, "s");
  const match = schema.match(regex);
  if (match) {
    const lines = match[1]
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("//"));
    const fields = [];
    const attributes = [];
    lines.forEach((l) => {
      if (l.startsWith("@@")) {
        attributes.push(l);
      } else {
        fields.push(l);
      }
    });
    result[modelName] = { fields, attributes };
  } else {
    result[modelName] = "NOT FOUND";
  }
});

fs.writeFileSync(
  "scratch/finance_models_extracted.json",
  JSON.stringify(result, null, 2),
);
console.log(
  "Finance models extracted successfully. Model count:",
  Object.keys(result).length,
);
