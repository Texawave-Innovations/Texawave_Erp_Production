import { chromium } from "@playwright/test";

async function runHeadedPreview() {
  console.log("Launching headed Chromium browser...");
  const browser = await chromium.launch({
    headless: false,
    slowMo: 900, // Slows down actions by 900ms so they are clearly visible
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();

  console.log("Navigating to http://localhost:3001/login ...");
  await page.goto("http://localhost:3001/login");
  await page.waitForLoadState("networkidle");

  console.log("Verifying login form elements...");
  await page.waitForSelector("#email");

  console.log("Filling Email...");
  await page.fill("#email", "admin@texawave.com");

  console.log("Filling Password...");
  await page.fill("#password", "ChangeMe123!");

  console.log("Toggling password visibility to show password...");
  const toggleBtn = page.getByRole("button", { name: "Show password" });
  if (await toggleBtn.isVisible()) {
    await toggleBtn.click();
  }

  // Wait 1.5 seconds so user can clearly see password revealed
  await page.waitForTimeout(1500);

  console.log("Toggling password visibility to hide password...");
  const hideBtn = page.getByRole("button", { name: "Hide password" });
  if (await hideBtn.isVisible()) {
    await hideBtn.click();
  }

  await page.waitForTimeout(1000);

  console.log("Submitting login form...");
  await page.locator("button[type='submit']").click();

  console.log("Waiting for navigation to dashboard...");
  await page.waitForURL((url) => !url.pathname.includes("/login"), {
    timeout: 15000,
  });
  await page.waitForLoadState("networkidle");

  console.log("Successfully logged in! Current URL:", page.url());
  console.log("Keeping browser window open for preview (10 seconds)...");
  await page.waitForTimeout(10000);

  console.log("Closing browser preview.");
  await browser.close();
}

runHeadedPreview().catch((err) => {
  console.error("Headed preview error:", err);
  process.exit(1);
});
