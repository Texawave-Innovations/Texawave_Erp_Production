const fs = require("fs");
const path = require("path");
const { chromium } = require(path.resolve("apps/api/node_modules/playwright"));

async function checkAll() {
  const mermaidJs = fs.readFileSync("scratch/mermaid.min.js", "utf8");
  const browser = await chromium.launch({
    executablePath:
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
  });
  const page = await browser.newPage();
  await page.setContent(`<script>${mermaidJs}</script>`);

  const files = [
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

  for (const f of files) {
    const code = fs.readFileSync(f, "utf8");
    try {
      await page.evaluate((c) => mermaid.parse(c), code);
      console.log(`[VALID] ${f}`);
    } catch (e) {
      console.log(`[INVALID] ${f}: ${e.message.split("\n")[0]}`);
      // Find line
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
}

checkAll().catch(console.error);
