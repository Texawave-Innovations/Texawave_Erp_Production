const fs = require("fs");
const path = require("path");
const { chromium } = require(path.resolve("apps/api/node_modules/playwright"));

async function testScale() {
  let svg = fs.readFileSync("scratch/ER2.svg", "utf8");
  // Clean style on svg
  svg = svg.replace(
    /style="[^"]*"/,
    'style="width: 100%; height: auto; display: block;"',
  );

  const html = `<!DOCTYPE html>
<html>
<head>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    body { font-family: sans-serif; background: #fff; margin: 0; padding: 20px; }
    .diagram-card {
      background: #FFFFFF;
      border: 1px solid #CBD5E1;
      border-radius: 6px;
      padding: 15px;
      max-width: 100%;
    }
  </style>
</head>
<body>
  <h2>ER 2: Chart of Accounts & General Ledger</h2>
  <div class="diagram-card">
    ${svg}
  </div>
</body>
</html>`;

  fs.writeFileSync("scratch/test_scale.html", html, "utf8");

  const browser = await chromium.launch({
    executablePath:
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "load" });
  await page.pdf({
    path: "scratch/test_scale.pdf",
    format: "A4",
    landscape: true,
    printBackground: true,
  });
  await browser.close();
  console.log("Scale test PDF generated at scratch/test_scale.pdf");
}

testScale().catch(console.error);
