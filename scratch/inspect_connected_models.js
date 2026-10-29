const fs = require("fs");

const schemaPath = "packages/database/prisma/schema.prisma";
const content = fs.readFileSync(schemaPath, "utf8");

const modelRegex = /model\s+(\w+)\s+\{([\s\S]*?)\n\}/g;
let match;
const models = {};

while ((match = modelRegex.exec(content)) !== null) {
  const modelName = match[1];
  const body = match[2];
  const schemaMatch = body.match(/@@schema\("([^"]+)"\)/);
  const schemaName = schemaMatch ? schemaMatch[1] : "public";
  const mapMatch = body.match(/@@map\("([^"]+)"\)/);
  const tableName = mapMatch ? mapMatch[1] : modelName;

  const lines = body
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("//"));
  const fields = [];
  const modelAttrs = [];

  for (const line of lines) {
    if (line.startsWith("@@")) {
      modelAttrs.push(line);
    } else {
      const parts = line.split(/\s+/);
      const fieldName = parts[0];
      let fieldType = parts[1];
      const rest = parts.slice(2).join(" ");
      const isOptional = fieldType.endsWith("?");
      const isList = fieldType.endsWith("[]");
      fieldType = fieldType.replace("?", "").replace("[]", "");

      fields.push({
        name: fieldName,
        type: fieldType,
        isOptional,
        isList,
        rest,
      });
    }
  }

  models[modelName] = { modelName, schemaName, tableName, fields, modelAttrs };
}

// Print FinanceMasterListItem details
console.log("=== FinanceMasterListItem fields ===");
models.FinanceMasterListItem.fields.forEach((f) => {
  console.log(
    `  ${f.name.padEnd(25)} ${f.type.padEnd(15)} ${f.isOptional ? "?" : " "} ${f.isList ? "[]" : "  "} ${f.rest}`,
  );
});
console.log("Attrs:", models.FinanceMasterListItem.modelAttrs);

// Check related models
const connectedModelNames = [
  "Organization",
  "Account",
  "ExpenseClaim",
  "Employee",
  "ScmSupplier",
  "ScmSupplierBill",
  "ScmSupplierPayment",
  "ScmSalesOrder",
];

console.log("\n=== Connected Models ===");
connectedModelNames.forEach((m) => {
  if (models[m]) {
    console.log(
      `Model: ${m.padEnd(22)} Schema: ${models[m].schemaName.padEnd(12)} Table: ${models[m].tableName.padEnd(25)} Fields: ${models[m].fields.length}`,
    );
  } else {
    console.log(`Model: ${m} NOT FOUND`);
  }
});

// Check if any other model references Finance models
console.log("\n=== Reverse relations into Finance models ===");
for (const [mName, mInfo] of Object.entries(models)) {
  if (mInfo.schemaName !== "finance") {
    const refs = mInfo.fields.filter((f) =>
      Object.keys(models).some(
        (fm) => models[fm].schemaName === "finance" && f.type === fm,
      ),
    );
    if (refs.length > 0) {
      console.log(
        `${mName} (${mInfo.schemaName}.${mInfo.tableName}) references:`,
        refs.map((r) => `${r.name}: ${r.type}`),
      );
    }
  }
}
