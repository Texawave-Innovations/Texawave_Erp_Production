const fs = require("fs");
const schema = JSON.parse(
  fs.readFileSync("scratch/finance_detailed_schema.json", "utf8"),
);

console.log("Finance Models Breakdown:");
let totalScalars = 0;
let totalRelations = 0;

schema.financeModels.forEach((m) => {
  const scalarFields = m.fields.filter((f) => !f.isRelation);
  const relFields = m.fields.filter((f) => f.isRelation);
  totalScalars += scalarFields.length;
  totalRelations += relFields.length;
  console.log(
    `${m.modelName.padEnd(32)} -> ${m.schemaName}.${m.tableName.padEnd(30)} | Scalars: ${String(scalarFields.length).padStart(2)} | Relations: ${String(relFields.length).padStart(2)} | Total: ${String(m.fields.length).padStart(2)}`,
  );
});

console.log(
  `\nTotals across 11 Finance Models: ${totalScalars} scalar columns, ${totalRelations} relations, ${totalScalars + totalRelations} total field definitions.`,
);
