const fs = require("fs");

const sql = fs.readFileSync(
  "packages/database/prisma/migrations/20261022174500_add_finance_core_module/migration.sql",
  "utf8",
);

const regex = /ALTER TABLE[^\n]+ADD CONSTRAINT[^\n]+/g;
let match;
const constraints = [];
while ((match = regex.exec(sql)) !== null) {
  constraints.push(match[0]);
}

console.log(
  `Found ${constraints.length} ADD CONSTRAINT statements in core migration.`,
);
constraints.forEach((c, i) => console.log(`${i + 1}: ${c}`));
