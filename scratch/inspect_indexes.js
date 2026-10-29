const fs = require("fs");

const m1 = fs.readFileSync(
  "packages/database/prisma/migrations/20261022170500_add_finance_master_list_items/migration.sql",
  "utf8",
);
const m2 = fs.readFileSync(
  "packages/database/prisma/migrations/20261022174500_add_finance_core_module/migration.sql",
  "utf8",
);
const m3 = fs.readFileSync(
  "packages/database/prisma/migrations/20261026160000_add_expense_gst_and_itc_fields/migration.sql",
  "utf8",
);

function extractIndexes(sql, name) {
  const indexes = [];
  const regex =
    /CREATE (UNIQUE )?INDEX "([^"]+)" ON "finance"\."([^"]+)"\(([^)]+)\);/g;
  let match;
  while ((match = regex.exec(sql)) !== null) {
    indexes.push({
      migration: name,
      isUnique: !!match[1],
      name: match[2],
      table: match[3],
      columns: match[4].replace(/"/g, ""),
    });
  }
  return indexes;
}

const idx1 = extractIndexes(m1, "20261022170500");
const idx2 = extractIndexes(m2, "20261022174500");
const idx3 = extractIndexes(m3, "20261026160000");

const allIndexes = [...idx1, ...idx2, ...idx3];
console.log(`Total Indexes across migrations: ${allIndexes.length}`);
console.log(`Unique indexes: ${allIndexes.filter((i) => i.isUnique).length}`);
console.log(
  `Non-unique indexes: ${allIndexes.filter((i) => !i.isUnique).length}`,
);

allIndexes.forEach((idx, i) => {
  console.log(
    `${i + 1}: [${idx.isUnique ? "UNIQUE" : "INDEX"}] ${idx.table} (${idx.columns}) -> ${idx.name} [${idx.migration}]`,
  );
});
