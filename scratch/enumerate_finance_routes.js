const fs = require("fs");
const path = require("path");

const targetControllers = [
  "apps/api/src/modules/employee-self-service/expense-claims/my-expense-claims.controller.ts",
  "apps/api/src/modules/hr/expense-claims/expense-claims.controller.ts",
  "apps/api/src/modules/finance-settings/master-list-items.controller.ts",
  "apps/api/src/modules/finance/expenses/expenses.controller.ts",
  "apps/api/src/modules/finance/payments-received/payments-received.controller.ts",
  "apps/api/src/modules/finance/payments-made/payments-made.controller.ts",
  "apps/api/src/modules/finance/banking/bank-accounts.controller.ts",
  "apps/api/src/modules/finance/banking/bank-transactions.controller.ts",
  "apps/api/src/modules/finance/coa/accounts.controller.ts",
  "apps/api/src/modules/finance/journal/journal-entries.controller.ts",
  "apps/api/src/modules/finance/reports/reports.controller.ts",
  "apps/api/src/modules/finance/gst/gst.controller.ts",
  "apps/api/src/modules/finance/integration/sales-purchases-integration.controller.ts",
];

const results = [];

targetControllers.forEach((file) => {
  const content = fs.readFileSync(file, "utf-8");
  const baseMatch = content.match(/@Controller\(['"]([^'"]*)['"]\)/);
  const basePath = baseMatch ? baseMatch[1] : "";

  const lines = content.split("\n");
  let currentVerb = null;
  let currentSubPath = "";
  let currentPerms = [];
  let currentSummary = "";
  let inMethod = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Check HTTP Verb decorator
    const verbMatch = line.match(
      /^@(Get|Post|Patch|Put|Delete)\((?:['"]([^'"]*)['"])?\)/,
    );
    if (verbMatch) {
      currentVerb = verbMatch[1].toUpperCase();
      currentSubPath = verbMatch[2] !== undefined ? verbMatch[2] : "";
      currentPerms = [];
      currentSummary = "";
      inMethod = true;
      continue;
    }

    if (inMethod) {
      // Check permissions decorator
      const permMatch = line.match(
        /@Require(?:Scoped)?Permissions?\(([^)]+)\)|@Permissions?\(([^)]+)\)/,
      );
      if (permMatch) {
        const raw = permMatch[1] || permMatch[2];
        const perms = raw
          .replace(/['" \n\r]/g, "")
          .split(",")
          .filter(Boolean);
        currentPerms.push(...perms);
      }

      // Check summary
      const sumMatch = line.match(/summary:\s*['"]([^'"]+)['"]/);
      if (sumMatch) {
        currentSummary = sumMatch[1].trim();
      }

      // Check method signature (must not start with @, and must look like identifier(...))
      if (
        !line.startsWith("@") &&
        !line.startsWith("//") &&
        !line.startsWith("/*")
      ) {
        const methodMatch = line.match(
          /^(?:public\s+|private\s+)?(?:async\s+)?([a-zA-Z0-9_]+)\s*\(([\s\S]*)/,
        );
        if (methodMatch && !["constructor"].includes(methodMatch[1])) {
          const methodName = methodMatch[1];
          let paramsSig = methodMatch[2];
          // accumulate params if multi-line
          let j = i;
          while (!paramsSig.includes("{") && j < lines.length - 1) {
            j++;
            paramsSig += " " + lines[j].trim();
          }

          const fullPath =
            "/" +
            [basePath, currentSubPath]
              .filter(Boolean)
              .join("/")
              .replace(/\/+/g, "/");

          // Extract DTO
          const dtoMatch =
            paramsSig.match(
              /@Body\([^)]*\)\s*(?:[a-zA-Z0-9_]+)\s*:\s*([a-zA-Z0-9_]+)/,
            ) ||
            paramsSig.match(/@Paginate\(([a-zA-Z0-9_]+)\)/) ||
            paramsSig.match(
              /@Query\([^)]*\)\s*(?:[a-zA-Z0-9_]+)\s*:\s*([a-zA-Z0-9_]+)/,
            );
          const dto = dtoMatch ? dtoMatch[1] : "";

          let permsStr = currentPerms.join(", ");
          if (!permsStr) {
            if (file.includes("self-service")) {
              permsStr = "employee_self_service.expense_claim.read/create";
            } else {
              permsStr = "Authenticated User";
            }
          }

          results.push({
            controller: path.basename(file),
            verb: currentVerb,
            path: fullPath,
            methodName,
            summary: currentSummary,
            dto,
            permissions: permsStr,
          });

          // Reset
          currentVerb = null;
          inMethod = false;
        }
      }
    }
  }
});

console.log("Total Parsed Routes:", results.length);
fs.writeFileSync(
  "scratch/finance_detailed_routes.json",
  JSON.stringify(results, null, 2),
);
console.log("Saved to scratch/finance_detailed_routes.json");
results.forEach((r, idx) => {
  console.log(
    `${idx + 1}. [${r.verb}] ${r.path} -> ${r.methodName} | ${r.permissions} | ${r.summary || r.dto || ""}`,
  );
});
