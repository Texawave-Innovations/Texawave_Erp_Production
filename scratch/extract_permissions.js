const fs = require("fs");

const catalog = fs.readFileSync(
  "packages/database/prisma/permissions/catalog.ts",
  "utf8",
);

const lines = catalog.split("\n");
const financePermissions = [];

lines.forEach((l) => {
  if (
    l.includes("finance") ||
    l.includes("Finance") ||
    l.includes("expense") ||
    l.includes("payment") ||
    l.includes("journal") ||
    l.includes("account")
  ) {
    financePermissions.push(l.trim());
  }
});

console.log("Finance permissions lines in catalog.ts:");
console.log(financePermissions.join("\n"));
