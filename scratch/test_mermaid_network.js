const path = require("path");
const { chromium } = require(path.resolve("apps/api/node_modules/playwright"));

async function test() {
  const browser = await chromium.launch({
    executablePath:
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
  });
  const page = await browser.newPage();
  try {
    const resp = await page.goto(
      "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js",
      { timeout: 3000 },
    );
    console.log("CDN Response status:", resp ? resp.status() : "null");
  } catch (e) {
    console.log("Network fetch failed as expected in sandbox:", e.message);
  } finally {
    await browser.close();
  }
}

test();
