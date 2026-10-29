const fs = require("fs");
const path = require("path");
const { chromium } = require(path.resolve("apps/api/node_modules/playwright"));

async function testRender() {
  const mermaidJs = fs.readFileSync("scratch/mermaid.min.js", "utf8");
  const d2 = fs.readFileSync(
    "Docs/diagrams/ER2_chart_of_accounts_gl.mermaid",
    "utf8",
  );

  const html = `<!DOCTYPE html>
<html>
<head>
  <script>${mermaidJs}</script>
  <style>
    body { font-family: sans-serif; background: #fff; margin: 20px; }
  </style>
</head>
<body>
  <h1>Test Mermaid Render</h1>
  <div class="mermaid">
${d2}
  </div>
  <script>
    mermaid.initialize({ startOnLoad: true, theme: 'default' });
  </script>
</body>
</html>`;

  fs.writeFileSync("scratch/test_mermaid_page.html", html, "utf8");

  const browser = await chromium.launch({
    executablePath:
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "load" });
  await page.waitForTimeout(2000); // Give mermaid time to render

  const svg = await page
    .$eval(".mermaid svg", (el) => (el ? el.outerHTML : null))
    .catch((e) => e.message);
  console.log(
    "SVG found:",
    svg ? svg.slice(0, 100) + "... length: " + svg.length : "NONE",
  );

  await page.screenshot({ path: "scratch/test_mermaid.png" });
  await browser.close();
  console.log("Test complete!");
}

testRender().catch((err) => console.error("Error:", err));
