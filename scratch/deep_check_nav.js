const fs = require("fs");
const path = require("path");

function checkFile(p) {
  const content = fs.readFileSync(p, "utf8");
  const lines = content.split("\n");
  lines.forEach((line, i) => {
    if (
      line.includes("Chart of Accounts") ||
      line.includes("Journal Entries") ||
      line.includes("General Ledger") ||
      line.includes("Financial Reports")
    ) {
      console.log(`${p}:${i + 1}: ${line.trim()}`);
    }
  });
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else if (e.name.endsWith(".tsx") || e.name.endsWith(".ts")) checkFile(full);
  }
}

walk("apps/ui/src/app/(dashboard)/finance");
walk("apps/ui/src/features/finance");
