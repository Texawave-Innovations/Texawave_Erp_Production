const fs = require("fs");
const path = require("path");
const ts = require("typescript");

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

function getDecoratorName(dec) {
  const expr = dec.expression;
  if (ts.isCallExpression(expr)) {
    return expr.expression.getText();
  }
  return expr.getText();
}

function getDecoratorArg(dec) {
  const expr = dec.expression;
  if (ts.isCallExpression(expr) && expr.arguments.length > 0) {
    return expr.arguments[0].getText();
  }
  return "";
}

controllerFiles.forEach((file) => {
  const code = fs.readFileSync(file, "utf8");
  const sourceFile = ts.createSourceFile(
    file,
    code,
    ts.ScriptTarget.Latest,
    true,
  );

  let controllerPrefix = "";

  function visit(node) {
    if (ts.isClassDeclaration(node)) {
      const decorators = ts.getDecorators(node) || [];
      for (const dec of decorators) {
        if (getDecoratorName(dec) === "Controller") {
          const arg = getDecoratorArg(dec);
          controllerPrefix = arg.replace(/^['"]|['"]$/g, "");
        }
      }
    }

    if (ts.isMethodDeclaration(node)) {
      const decorators = ts.getDecorators(node) || [];
      let httpMethod = null;
      let subPath = "";
      let permission = "None";
      let summary = "";
      let httpCode = "";

      for (const dec of decorators) {
        const name = getDecoratorName(dec);
        if (["Get", "Post", "Patch", "Put", "Delete"].includes(name)) {
          httpMethod = name.toUpperCase();
          const arg = getDecoratorArg(dec);
          subPath = arg.replace(/^['"]|['"]$/g, "");
        } else if (name === "RequirePermission") {
          permission = getDecoratorArg(dec).replace(/^['"]|['"]$/g, "");
        } else if (name === "ApiOperation") {
          const text = dec.getText();
          const sumMatch = text.match(/summary:\s*["']([^"']+)["']/);
          if (sumMatch) summary = sumMatch[1];
        } else if (name === "HttpCode") {
          httpCode = getDecoratorArg(dec).replace(/^HttpStatus\./, "");
        }
      }

      if (httpMethod) {
        let fullPath = "/" + controllerPrefix;
        if (subPath) {
          if (!subPath.startsWith("/")) fullPath += "/" + subPath;
          else fullPath += subPath;
        }
        fullPath = fullPath.replace(/\/+/g, "/");

        // Extract parameters
        const params = [];
        node.parameters.forEach((p) => {
          const pName = p.name.getText();
          const pType = p.type ? p.type.getText() : "any";
          const pDecs = (ts.getDecorators(p) || []).map((d) =>
            getDecoratorName(d),
          );
          params.push({
            name: pName,
            type: pType,
            decorators: pDecs,
            text: p.getText(),
          });
        });

        // Determine default status code
        let statusCode = "200 OK";
        if (httpCode) {
          if (httpCode.includes("NO_CONTENT") || httpCode === "204")
            statusCode = "204 No Content";
          else if (httpCode.includes("CREATED") || httpCode === "201")
            statusCode = "201 Created";
          else statusCode = httpCode;
        } else if (httpMethod === "POST") {
          statusCode = "201 Created";
        }

        allEndpoints.push({
          sourceFile: file.replace(/\\/g, "/"),
          controllerPrefix,
          methodName: node.name.getText(),
          httpMethod,
          endpoint: fullPath,
          permission,
          summary,
          statusCode,
          params,
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
});

fs.writeFileSync(
  "scratch/all_parsed_endpoints.json",
  JSON.stringify(allEndpoints, null, 2),
);
console.log("Successfully parsed endpoints. Total count:", allEndpoints.length);
allEndpoints.forEach((e, idx) => {
  console.log(
    `${(idx + 1).toString().padStart(2, " ")}. [${e.httpMethod.padEnd(6, " ")}] ${e.endpoint.padEnd(55, " ")} | Perm: ${e.permission.padEnd(38, " ")} | Summary: ${e.summary || e.methodName}`,
  );
});
