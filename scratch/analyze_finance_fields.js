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
      if (parts.length >= 2) {
        const fieldName = parts[0];
        let rawType = parts[1];
        const rest = parts.slice(2).join(" ");
        const isOptional = rawType.endsWith("?");
        const isList = rawType.endsWith("[]");
        const cleanType = rawType.replace("?", "").replace("[]", "");
        fields.push({
          name: fieldName,
          rawType,
          cleanType,
          isOptional,
          isList,
          rest,
        });
      }
    }
  }

  models[modelName] = {
    modelName,
    schemaName,
    tableName,
    fields,
    modelAttrs,
  };
}

const financeModels = Object.values(models).filter(
  (m) => m.schemaName === "finance",
);
console.log("Finance Models Detailed Field Analysis:");

const analysis = financeModels.map((m) => {
  const scalarFields = [];
  const relationFields = [];

  m.fields.forEach((f) => {
    // Check if cleanType is another model in schema
    if (models[f.cleanType]) {
      relationFields.push(f);
    } else {
      scalarFields.push(f);
    }
  });

  const fks = relationFields.filter(
    (r) => r.rest.includes("@relation") && r.rest.includes("fields:"),
  );

  return {
    modelName: m.modelName,
    tableName: m.tableName,
    scalarCount: scalarFields.length,
    relationCount: relationFields.length,
    fksCount: fks.length,
    fks: fks.map((fk) => {
      const match = fk.rest.match(/@relation\((.*?)\)/);
      return {
        field: fk.name,
        targetModel: fk.cleanType,
        rule: match ? match[1] : "",
      };
    }),
    modelAttrs: m.modelAttrs,
  };
});

fs.writeFileSync(
  "scratch/finance_model_analysis.json",
  JSON.stringify(analysis, null, 2),
);
console.log("Saved analysis to scratch/finance_model_analysis.json");
analysis.forEach((a) => {
  console.log(
    `${a.modelName} (${a.tableName}) -> Scalars: ${a.scalarCount}, Relations: ${a.relationCount}, Direct FKs: ${a.fksCount}, ModelAttrs: ${a.modelAttrs.length}`,
  );
});
