const fs = require("fs");
const path = require("path");
const { chromium } = require(path.resolve("apps/api/node_modules/playwright"));

async function testAll9() {
  const mermaidJs = fs.readFileSync("scratch/mermaid.min.js", "utf8");

  const diagrams = [
    { id: "ER1", file: "Docs/diagrams/ER1_finance_overview.mermaid" },
    { id: "ER2", file: "Docs/diagrams/ER2_chart_of_accounts_gl.mermaid" },
    { id: "ER3", file: "Docs/diagrams/ER3_banking_reconciliation.mermaid" },
    { id: "ER4", file: "Docs/diagrams/ER4_customer_payments_received.mermaid" },
    { id: "ER5", file: "Docs/diagrams/ER5_payments_made.mermaid" },
    { id: "ER6", file: "Docs/diagrams/ER6_expenses_hr_integration.mermaid" },
    { id: "ER7", file: "Docs/diagrams/ER7_gst_input_tax_credit.mermaid" },
    { id: "ER8", file: "Docs/diagrams/ER8_financial_reporting_tables.mermaid" },
    { id: "ER9", file: "Docs/diagrams/ER9_scm_finance_integration.mermaid" },
  ];

  const browser = await chromium.launch({
    executablePath:
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
  });
  const page = await browser.newPage();

  for (const d of diagrams) {
    const code = fs.readFileSync(d.file, "utf8");
    const html = `<!DOCTYPE html>
<html>
<head>
  <script>${mermaidJs}</script>
</head>
<body>
  <div id="container" class="mermaid">
${code}
  </div>
  <script>
    mermaid.initialize({
      startOnLoad: true,
      theme: 'base',
      themeVariables: {
        primaryColor: '#E0F2FE',
        primaryTextColor: '#0F172A',
        primaryBorderColor: '#0284C7',
        lineColor: '#0A3271',
        secondaryColor: '#F8FAFC',
        tertiaryColor: '#FFFFFF',
        fontFamily: 'Nunito Sans, sans-serif'
      }
    });
  </script>
</body>
</html>`;

    await page.setContent(html, { waitUntil: "load" });
    try {
      await page.waitForSelector("#container svg", { timeout: 8000 });
      const svg = await page.$eval("#container svg", (el) => el.outerHTML);
      console.log(
        `[PASS] ${d.id} rendered successfully! SVG size: ${svg.length} chars.`,
      );
      // Save SVG file so we can embed directly or inspect
      fs.writeFileSync(`scratch/${d.id}.svg`, svg, "utf8");
    } catch (e) {
      console.error(`[FAIL] ${d.id} failed to render:`, e.message);
    }
  }

  await browser.close();
  console.log("All 9 tests finished!");
}

testAll9().catch(console.error);
