const path = require("path");
const { chromium } = require(path.resolve("apps/api/node_modules/playwright"));

async function testPdf() {
  const browser = await chromium.launch({
    executablePath:
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
  });
  const page = await browser.newPage();
  await page.setContent(
    "<html><body><h1>TexaWave ERP Test PDF</h1></body></html>",
  );
  await page.pdf({ path: "scratch/test_output.pdf", format: "A4" });
  await browser.close();
  console.log("PDF generated successfully!");
}

testPdf().catch(console.error);
