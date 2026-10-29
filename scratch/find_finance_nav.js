const fs = require("fs");

const file = "apps/ui/src/components/layout/HorizontalNavbar.tsx";
const content = fs.readFileSync(file, "utf8");
const lines = content.split("\n");

lines.forEach((line, idx) => {
  if (line.includes("/finance")) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
