const fs = require("fs");

const schemaPath = "packages/database/prisma/schema.prisma";
const content = fs.readFileSync(schemaPath, "utf8");

const modelRegex = /model\s+(\w+)\s+\{([\s\S]*?)\n\}/g;
let match;

console.log("=== SCM Models in schema.prisma ===");
while ((match = modelRegex.exec(content)) !== null) {
  const mName = match[1];
  const body = match[2];
  const schemaMatch = body.match(/@@schema\("([^"]+)"\)/);
  const mapMatch = body.match(/@@map\("([^"]+)"\)/);
  if (schemaMatch && schemaMatch[1] === "scm") {
    console.log(
      `SCM Model: ${mName.padEnd(30)} -> Table: ${mapMatch ? mapMatch[1] : mName}`,
    );
  }
}
