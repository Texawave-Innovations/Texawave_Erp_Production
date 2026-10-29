const fs = require("fs");

const sql = fs.readFileSync(
  "packages/database/prisma/migrations/20261022174500_add_finance_core_module/migration.sql",
  "utf8",
);

// Match foreign keys
const fkRegex =
  /ALTER TABLE\s+"([^"]+)"\."([^"]+)"\s+ADD CONSTRAINT\s+"([^"]+)"\s+FOREIGN KEY\s+\(([^)]+)\)\s+REFERENCES\s+"([^"]+)"\."([^"]+)"\(([^)]+)\)\s+ON DELETE\s+([A-Za-z\s]+)\s+ON UPDATE\s+([A-Za-z\s]+);/g;
let match;
console.log("=== FOREIGN KEYS in Migration 20261022174500 ===");
let fkCount = 0;
while ((match = fkRegex.exec(sql)) !== null) {
  fkCount++;
  console.log(
    `${match[1]}.${match[2]} (${match[4]}) -> ${match[5]}.${match[6]} (${match[7]}) [DELETE: ${match[8].trim()}, UPDATE: ${match[9].trim()}]`,
  );
}
console.log(`Total Foreign Keys: ${fkCount}`);

// Match Unique Constraints & Indexes
const uniqueRegex =
  /CREATE UNIQUE INDEX\s+"([^"]+)"\s+ON\s+"([^"]+)"\."([^"]+)"\(([^)]+)\);/g;
let uMatch;
console.log("\n=== UNIQUE INDEXES in Migration 20261022174500 ===");
let uCount = 0;
while ((uMatch = uniqueRegex.exec(sql)) !== null) {
  uCount++;
  console.log(`${uMatch[2]}.${uMatch[3]} UNIQUE (${uMatch[4]})`);
}
console.log(`Total Unique Indexes: ${uCount}`);

const idxRegex =
  /CREATE INDEX\s+"([^"]+)"\s+ON\s+"([^"]+)"\."([^"]+)"\(([^)]+)\);/g;
let iMatch;
console.log(
  "\n=== COMPOSITE / SECONDARY INDEXES in Migration 20261022174500 ===",
);
let iCount = 0;
while ((iMatch = idxRegex.exec(sql)) !== null) {
  iCount++;
  console.log(`${iMatch[2]}.${iMatch[3]} INDEX (${iMatch[4]})`);
}
console.log(`Total Secondary Indexes: ${iCount}`);
