const fs = require("fs");
const path = require("path");

const controllerFiles = [
  "apps/api/src/modules/finance/banking/bank-accounts.controller.ts",
  "apps/api/src/modules/finance/banking/bank-transactions.controller.ts",
  "apps/api/src/modules/finance/coa/accounts.controller.ts",
  "apps/api/src/modules/finance/expenses/expenses.controller.ts",
  "apps/api/src/modules/finance/gst/gst.controller.ts",
  "apps/api/src/modules/finance/integration/sales-purchases-integration.controller.ts",
  "apps/api/src/modules/finance/journal/journal-entries.controller.ts",
  "apps/api/src/modules/finance/payments-made/payments-made.controller.ts",
  "apps/api/src/modules/finance/payments-received/payments-received.controller.ts",
  "apps/api/src/modules/finance/reports/reports.controller.ts",
  "apps/api/src/modules/finance-settings/master-list-items.controller.ts",
];

let allEndpoints = [];

controllerFiles.forEach((file) => {
  const content = fs.readFileSync(file, "utf8");

  // Find controller base path
  const ctrlMatch = content.match(/@Controller\(['"]([^'"]*)['"]\)/);
  const basePath = ctrlMatch ? ctrlMatch[1] : "";

  // Find methods
  const lines = content.split("\n");
  let currentDecorators = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("@")) {
      currentDecorators.push(line);
    } else if (
      line.match(/^(async\s+)?(\w+)\s*\(/) &&
      currentDecorators.length > 0
    ) {
      const methodDef = line;
      const decStr = currentDecorators.join(" ");

      const httpMatch = decStr.match(
        /@(Get|Post|Patch|Put|Delete)\((?:['"]([^'"]*)['"])?\)/i,
      );
      if (httpMatch) {
        const method = httpMatch[1].toUpperCase();
        let subPath = httpMatch[2] || "";
        if (subPath && !subPath.startsWith("/")) subPath = "/" + subPath;
        const fullPath =
          "/" + (basePath + (subPath ? subPath : "")).replace(/^\/+/, "");

        const permMatch = decStr.match(
          /@RequirePermission\(['"]([^'"]+)['"]\)/,
        );
        const permission = permMatch ? permMatch[1] : "None";

        const httpCodeMatch = decStr.match(/@HttpCode\(([^)]+)\)/);
        const httpCode = httpCodeMatch
          ? httpCodeMatch[1]
          : method === "POST"
            ? "201 Created"
            : "200 OK";

        // Check params, body, query
        // Read until the end of parameters
        let paramStr = line;
        let j = i;
        while (!paramStr.includes("{") && j < lines.length - 1) {
          j++;
          paramStr += " " + lines[j].trim();
        }

        allEndpoints.push({
          file: file.replace(/\\/g, "/"),
          controller: basePath,
          handler: methodDef.split("(")[0].replace("async", "").trim(),
          method,
          path: fullPath,
          permission,
          httpCode,
          paramStr: paramStr.substring(0, paramStr.indexOf("{")).trim(),
        });
      }
      currentDecorators = [];
    } else if (
      line === "" ||
      line.startsWith("//") ||
      line.startsWith("/*") ||
      line.startsWith("*")
    ) {
      // comment or empty line, keep or ignore
    } else {
      currentDecorators = [];
    }
  }
});

fs.writeFileSync(
  "scratch/extracted_endpoints.json",
  JSON.stringify(allEndpoints, null, 2),
);
console.log("Extracted endpoints count:", allEndpoints.length);
allEndpoints.forEach((e, idx) => {
  console.log(
    `${idx + 1}. [${e.method}] ${e.path} (${e.permission}) -> ${e.handler}`,
  );
});
