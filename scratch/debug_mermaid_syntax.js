const fs = require("fs");

const d1 = fs.readFileSync(
  "Docs/diagrams/ER1_finance_overview.mermaid",
  "utf8",
);
const lines = d1.split("\n");

console.log("Total lines in ER1:", lines.length);

// Let's test lines progressively to find the exact line causing syntax error
const { chromium } = require(
  require("path").resolve("apps/api/node_modules/playwright"),
);

async function testSyntax() {
  const mermaidJs = fs.readFileSync("scratch/mermaid.min.js", "utf8");
  const browser = await chromium.launch({
    executablePath:
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
  });
  const page = await browser.newPage();

  // Test parse with mermaid.parse
  await page.setContent(`<script>${mermaidJs}</script>`);

  const errors = [];
  for (let i = 1; i <= lines.length; i++) {
    const subset = lines.slice(0, i).join("\n");
    try {
      await page.evaluate((code) => mermaid.parse(code), subset);
    } catch (e) {
      errors.push({ lineNum: i, lineText: lines[i - 1], error: e.message });
      break;
    }
  }

  if (errors.length > 0) {
    console.log("First syntax error at:", errors[0]);
  } else {
    console.log("No parse error found line by line!");
  }

  await browser.close();
}

testSyntax().catch(console.error);
