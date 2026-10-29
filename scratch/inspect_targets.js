const fs = require("fs");

const schemaPath = "packages/database/prisma/schema.prisma";
const content = fs.readFileSync(schemaPath, "utf8");

const targetModels = [
  "Supplier",
  "ScmSupplierBill",
  "ScmSupplierPayment",
  "ScmSalesOrder",
  "ExpenseClaim",
  "Employee",
  "Account",
];

targetModels.forEach((tm) => {
  const regex = new RegExp(`model\\s+${tm}\\s+\\{([\\s\\S]*?)\\n\\}`, "g");
  const m = regex.exec(content);
  if (m) {
    console.log(`\n=================== MODEL: ${tm} ===================`);
    const lines = m[1]
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("//"));
    lines.forEach((l) => console.log("  " + l));
  }
});
