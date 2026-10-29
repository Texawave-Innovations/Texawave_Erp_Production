const fs = require("fs");

const m1Path =
  "packages/database/prisma/migrations/20261022170500_add_finance_master_list_items/migration.sql";
const m2Path =
  "packages/database/prisma/migrations/20261022174500_add_finance_core_module/migration.sql";
const m3Path =
  "packages/database/prisma/migrations/20261026160000_add_expense_gst_and_itc_fields/migration.sql";

const m1 = fs.readFileSync(m1Path, "utf8");
const m2 = fs.readFileSync(m2Path, "utf8");
const m3 = fs.readFileSync(m3Path, "utf8");

function extractFKs(sql, name) {
  const fks = [];
  const regex =
    /ALTER TABLE "finance"\."([^"]+)" ADD CONSTRAINT "([^"]+)" FOREIGN KEY \(([^)]+)\) REFERENCES "([^"]+)"\."([^"]+)"\(([^)]+)\) ON DELETE ([^ ]+) ON UPDATE ([^;]+);/g;
  let match;
  while ((match = regex.exec(sql)) !== null) {
    fks.push({
      migration: name,
      table: match[1],
      constraint: match[2],
      column: match[3].replace(/"/g, ""),
      refSchema: match[4],
      refTable: match[5],
      refColumn: match[6].replace(/"/g, ""),
      onDelete: match[7],
      onUpdate: match[8].trim(),
    });
  }
  return fks;
}

const fks1 = extractFKs(m1, "20261022170500");
const fks2 = extractFKs(m2, "20261022174500");
const fks3 = extractFKs(m3, "20261026160000");

const allFKs = [...fks1, ...fks2, ...fks3];
console.log(`Total Migration FKs: ${allFKs.length}`);
console.log(`- Migration 1 (master list items): ${fks1.length}`);
console.log(`- Migration 2 (finance core module): ${fks2.length}`);
console.log(`- Migration 3 (expense gst & itc): ${fks3.length}`);

fs.writeFileSync(
  "scratch/all_migration_fks.json",
  JSON.stringify(allFKs, null, 2),
);
allFKs.forEach((fk) => {
  console.log(
    `${fk.table}.${fk.column} -> ${fk.refSchema}.${fk.refTable}(${fk.refColumn}) [ON DELETE ${fk.onDelete}, ON UPDATE ${fk.onUpdate}]`,
  );
});
