const fs = require("fs");
const path = require("path");
const { chromium } = require(path.resolve("apps/api/node_modules/playwright"));

async function renderReportDiagrams() {
  const md = fs.readFileSync(
    "Docs/Finance_Database_Verification_Report.md",
    "utf8",
  );
  const mermaidMatches = [...md.matchAll(/```mermaid\s*([\s\S]*?)```/g)];
  console.log(
    `Found ${mermaidMatches.length} mermaid blocks in Verification Report.`,
  );

  const mermaidJs = fs.readFileSync("scratch/mermaid.min.js", "utf8");
  const browser = await chromium.launch({
    executablePath:
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
  });
  const page = await browser.newPage();

  for (let i = 0; i < mermaidMatches.length; i++) {
    const code = mermaidMatches[i][1];
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
        `[PASS] Report Diagram ${i + 1} rendered successfully! SVG size: ${svg.length} chars.`,
      );
      fs.writeFileSync(`scratch/report_diag_${i + 1}.svg`, svg, "utf8");
    } catch (e) {
      console.error(`[FAIL] Report Diagram ${i + 1} failed:`, e.message);
    }
  }

  await browser.close();
}

renderReportDiagrams().catch(console.error);
