const fs = require("fs");

const file = "apps/ui/src/components/layout/HorizontalNavbar.tsx";
const content = fs.readFileSync(file, "utf8");
const lines = content.split("\n");

lines.forEach((line, idx) => {
  if (
    line.includes("activeModule.categories") ||
    line.includes("currentModule?.categories") ||
    line.includes("categories.map") ||
    line.includes("FINANCE_CATEGORIES")
  ) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
