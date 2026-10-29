const fs = require("fs");
const path = require("path");

function searchDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      searchDir(fullPath);
    } else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) {
      const content = fs.readFileSync(fullPath, "utf8");
      if (
        content.includes("Chart of Accounts") ||
        content.includes("General Ledger") ||
        content.includes("Journal Entries")
      ) {
        const lines = content.split("\n");
        lines.forEach((l, i) => {
          if (
            l.includes("<Link") ||
            l.includes("router.push") ||
            l.includes("cursor-pointer") ||
            l.includes("onClick")
          ) {
            console.log(`${fullPath}:${i + 1}: ${l.trim()}`);
          }
        });
      }
    }
  }
}

searchDir("apps/ui/src/features/finance");
