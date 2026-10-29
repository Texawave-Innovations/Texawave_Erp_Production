const fs = require("fs");
const path = require("path");
const { chromium } = require(path.resolve("apps/api/node_modules/playwright"));

const files = [
  "Docs/diagrams/ER1_finance_overview.mermaid",
  "Docs/diagrams/ER4_customer_payments_received.mermaid",
  "Docs/diagrams/ER6_expenses_hr_integration.mermaid",
  "Docs/diagrams/ER7_gst_input_tax_credit.mermaid",
  "Docs/diagrams/ER8_financial_reporting_tables.mermaid",
  "Docs/diagrams/ER9_scm_finance_integration.mermaid",
];

files.forEach((f) => {
  let content = fs.readFileSync(f, "utf8");
  // Replace ..o| with ||..o|
  content = content.replace(/(\w+)\s+\.\.o\|\s+(\w+)/g, "$1 ||..o| $2");
  // Replace ..o{ with ||..o{
  content = content.replace(/(\w+)\s+\.\.o\{\s+(\w+)/g, "$1 ||..o{ $2");
  // Replace ..|{ with ||..|{
  content = content.replace(/(\w+)\s+\.\.\|\{\s+(\w+)/g, "$1 ||..|{ $2");
  // Replace ..|| with ||..||
  content = content.replace(/(\w+)\s+\.\.\|\|\s+(\w+)/g, "$1 ||..|| $2");
  fs.writeFileSync(f, content, "utf8");
});

console.log("Updated syntax in files. Now verifying...");

async function verify() {
  const mermaidJs = fs.readFileSync("scratch/mermaid.min.js", "utf8");
  const browser = await chromium.launch({
    executablePath:
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
  });
  const page = await browser.newPage();
  await page.setContent(`<script>${mermaidJs}</script>`);

  const allFiles = [
    "Docs/diagrams/ER1_finance_overview.mermaid",
    "Docs/diagrams/ER2_chart_of_accounts_gl.mermaid",
    "Docs/diagrams/ER3_banking_reconciliation.mermaid",
    "Docs/diagrams/ER4_customer_payments_received.mermaid",
    "Docs/diagrams/ER5_payments_made.mermaid",
    "Docs/diagrams/ER6_expenses_hr_integration.mermaid",
    "Docs/diagrams/ER7_gst_input_tax_credit.mermaid",
    "Docs/diagrams/ER8_financial_reporting_tables.mermaid",
    "Docs/diagrams/ER9_scm_finance_integration.mermaid",
  ];

  let allValid = true;
  for (const f of allFiles) {
    const code = fs.readFileSync(f, "utf8");
    try {
      await page.evaluate((c) => mermaid.parse(c), code);
      console.log(`[PASS] ${f}`);
    } catch (e) {
      allValid = false;
      console.log(`[FAIL] ${f}: ${e.message.split("\n")[0]}`);
      const lines = code.split("\n");
      for (let i = 1; i <= lines.length; i++) {
        try {
          await page.evaluate(
            (c) => mermaid.parse(c),
            lines.slice(0, i).join("\n"),
          );
        } catch (err) {
          console.log(`  -> Error at line ${i}: "${lines[i - 1].trim()}"`);
          break;
        }
      }
    }
  }

  await browser.close();
  if (allValid) {
    console.log(
      "\n>>> SUCCESS: ALL 9 MERMAID DIAGRAMS ARE 100% VALID SYNTAX! <<<",
    );
  }
}

verify().catch(console.error);
