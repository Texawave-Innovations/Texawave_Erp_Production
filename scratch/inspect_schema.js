const fs = require("fs");

const schema = fs.readFileSync(
  "packages/database/prisma/schema.prisma",
  "utf8",
);

// Match models
const lines = schema.split("\n");
let currentModel = null;
let currentEnum = null;
let models = {};
let enums = {};

for (let line of lines) {
  const modelMatch = line.match(/^model\s+(\w+)\s+\{/);
  if (modelMatch) {
    currentModel = modelMatch[1];
    models[currentModel] = { fields: [], table: currentModel, attributes: [] };
    continue;
  }
  const enumMatch = line.match(/^enum\s+(\w+)\s+\{/);
  if (enumMatch) {
    currentEnum = enumMatch[1];
    enums[currentEnum] = [];
    continue;
  }
  if (line.trim() === "}") {
    currentModel = null;
    currentEnum = null;
    continue;
  }
  if (currentModel) {
    const mapMatch = line.match(/@@map\("([^"]+)"\)/);
    if (mapMatch) {
      models[currentModel].table = mapMatch[1];
    }
    if (line.trim().startsWith("@@")) {
      models[currentModel].attributes.push(line.trim());
    } else if (line.trim().length > 0 && !line.trim().startsWith("//")) {
      models[currentModel].fields.push(line.trim());
    }
  }
  if (currentEnum) {
    if (line.trim().length > 0 && !line.trim().startsWith("//")) {
      enums[currentEnum].push(line.trim());
    }
  }
}

console.log("--- ALL FINANCE RELATED MODELS ---");
for (const [mName, mData] of Object.entries(models)) {
  if (mName.startsWith("Finance") || mData.table.startsWith("finance_")) {
    console.log(
      `Model: ${mName} -> Table: ${mData.table} (Fields: ${mData.fields.length}, Attrs: ${mData.attributes.length})`,
    );
  }
}

console.log("\n--- ALL FINANCE RELATED ENUMS ---");
for (const [eName, eValues] of Object.entries(enums)) {
  if (
    eName.startsWith("Finance") ||
    [
      "PaymentMode",
      "TransactionType",
      "ExpenseStatus",
      "ExpensePaymentStatus",
    ].includes(eName)
  ) {
    console.log(`Enum: ${eName} -> [${eValues.join(", ")}]`);
  }
}
