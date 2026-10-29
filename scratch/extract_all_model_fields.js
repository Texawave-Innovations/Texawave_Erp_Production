const fs = require("fs");

const schema = fs.readFileSync(
  "packages/database/prisma/schema.prisma",
  "utf8",
);

const financeModels = [
  "FinanceExpense",
  "FinanceAccount",
  "FinanceJournalEntry",
  "FinanceJournalLine",
  "FinanceBankAccount",
  "FinanceBankTransaction",
  "FinancePaymentReceived",
  "FinancePaymentReceivedAllocation",
  "FinancePaymentMade",
  "FinanceGstEntry",
  "FinanceMasterListItem",
];

let modelDetails = {};

financeModels.forEach((mName) => {
  const regex = new RegExp(`model\\s+${mName}\\s+\\{([^}]+)\\}`, "s");
  const match = schema.match(regex);
  if (!match) return;

  const content = match[1];
  const lines = content.split("\n");
  const fields = [];
  const modelAttrs = [];

  lines.forEach((rawLine) => {
    const l = rawLine.trim();
    if (!l || l.startsWith("//")) return;
    if (l.startsWith("@@")) {
      modelAttrs.push(l);
      return;
    }

    // Match field definition: name type attributes...
    const parts = l.split(/\s+/);
    const fName = parts[0];
    const fType = parts[1];
    const rest = parts.slice(2).join(" ");

    fields.push({
      name: fName,
      type: fType,
      rest: rest,
      isOptional: fType.endsWith("?"),
      isList: fType.endsWith("[]"),
      isRelation: ![
        "Int",
        "String",
        "Decimal",
        "DateTime",
        "Boolean",
        "Json",
        "BigInt",
        "Float",
      ].includes(fType.replace(/[?\[\]]/g, "")),
    });
  });

  modelDetails[mName] = { fields, modelAttrs };
});

fs.writeFileSync(
  "scratch/all_model_fields.json",
  JSON.stringify(modelDetails, null, 2),
);
console.log(
  "Extracted fields for",
  Object.keys(modelDetails).length,
  "models.",
);
let totalFields = 0;
for (const [m, d] of Object.entries(modelDetails)) {
  const scalarFields = d.fields.filter((f) => !f.isRelation);
  totalFields += scalarFields.length;
  console.log(
    `- ${m}: ${scalarFields.length} scalar fields, ${d.fields.length - scalarFields.length} relations`,
  );
}
console.log("Total scalar fields:", totalFields);
