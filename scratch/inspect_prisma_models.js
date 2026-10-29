const fs = require("fs");

const schemaPath = "packages/database/prisma/schema.prisma";
const content = fs.readFileSync(schemaPath, "utf8");

// Parse datasource and schemas
const datasourceMatch = content.match(/datasource\s+(\w+)\s+\{([\s\S]*?)\}/);
console.log("--- Datasource ---");
if (datasourceMatch) {
  console.log(datasourceMatch[0]);
}

// Extract models
const modelRegex = /model\s+(\w+)\s+\{([\s\S]*?)\n\}/g;
let match;
const allModels = {};

while ((match = modelRegex.exec(content)) !== null) {
  const modelName = match[1];
  const body = match[2];

  // check schema
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
      if (parts.length >= 2) {
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
  }

  allModels[modelName] = {
    modelName,
    schemaName,
    tableName,
    fields,
    modelAttrs,
  };
}

console.log("\n--- Finance Schema Models ---");
const financeModels = Object.values(allModels).filter(
  (m) => m.schemaName === "finance",
);
financeModels.forEach((m) => {
  console.log(
    `Model: ${m.modelName.padEnd(35)} -> Table: ${m.tableName.padEnd(30)} Fields: ${m.fields.length} (Attrs: ${m.modelAttrs.length})`,
  );
});

// Check enums
const enumRegex = /enum\s+(\w+)\s+\{([\s\S]*?)\n\}/g;
let enumMatch;
const allEnums = {};
while ((enumMatch = enumRegex.exec(content)) !== null) {
  const enumName = enumMatch[1];
  const enumBody = enumMatch[2];
  const schemaMatch = enumBody.match(/@@schema\("([^"]+)"\)/);
  const schemaName = schemaMatch ? schemaMatch[1] : "public";
  const values = enumBody
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("//") && !l.startsWith("@@"));
  allEnums[enumName] = { enumName, schemaName, values };
}

console.log("\n--- Finance Schema Enums ---");
const financeEnums = Object.values(allEnums).filter(
  (e) => e.schemaName === "finance",
);
financeEnums.forEach((e) => {
  console.log(
    `Enum: ${e.enumName.padEnd(35)} Values: [${e.values.join(", ")}]`,
  );
});

// Save complete extracted JSON
fs.writeFileSync(
  "scratch/finance_detailed_schema.json",
  JSON.stringify(
    {
      financeModels,
      financeEnums,
      allModelsCount: Object.keys(allModels).length,
    },
    null,
    2,
  ),
);

console.log(
  `\nTotal models in schema.prisma: ${Object.keys(allModels).length}`,
);
console.log(`Total Finance models: ${financeModels.length}`);
console.log(`Total Finance enums: ${financeEnums.length}`);
