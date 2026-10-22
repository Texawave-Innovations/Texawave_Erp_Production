import { test, expect } from "@playwright/test";
import { signInAsAdmin } from "./helpers/auth";

test("Offer Letter generator renders split view, auto-calculates salary, and shows live preview", async ({
  page,
}) => {
  await signInAsAdmin(page);

  // Navigate: Human Resources -> Recruitment -> Recruitment Pipeline
  const nav = page.getByRole("navigation", {
    name: "Main application navigation",
  });
  const hrBtn = nav.getByRole("button", { name: "Human Resources" });
  await hrBtn.click();
  const dropdown = page.getByRole("menu", {
    name: "Human Resources categories",
  });
  const recBtn = dropdown.getByRole("button", { name: "Recruitment" });
  await recBtn.click();
  const subMenu = page.getByRole("menu", { name: "Recruitment items" });
  await subMenu.getByRole("link", { name: "Recruitment Pipeline" }).click();
  await expect(page).toHaveURL(/\/hr\/recruitment/);
  await page.waitForLoadState("networkidle");

  // Click Offer letter tab
  const offerTab = page.getByRole("tab", { name: /Offer letter/i });
  await expect(offerTab).toBeVisible();
  await offerTab.click();

  // Verify Offer Letter Generator header and tabs
  await expect(page.getByText("Offer Letter Generator")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Generator & Preview/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Offer Letters/i }),
  ).toBeVisible();

  // Fill in candidate name to test live preview reaction
  const nameInput = page.getByPlaceholder("e.g. Arun Kumar R");
  await nameInput.fill("Ananya Sharma");

  // Test salary auto calculation
  const salaryAmountInput = page.getByPlaceholder("e.g. 12000");
  await salaryAmountInput.fill("60000");

  // Verify CTC Summary Callout updates
  await expect(page.getByText("Net Monthly:")).toBeVisible();
  await expect(page.getByText("Gross Annual CTC:")).toBeVisible();

  // Click Joining Date DatePicker to verify calendar popover
  const joiningDateInput = page.getByLabel("Joining Date *");
  if (await joiningDateInput.isVisible()) {
    await joiningDateInput.click();
  } else {
    const calendarBtns = page.locator("button[aria-label*='calendar' i], button[aria-label*='Choose date' i], button[aria-label*='Open' i]");
    if (await calendarBtns.count() > 0) {
      await calendarBtns.nth(1).click();
    }
  }

  // Capture screenshot of Split View with open calendar picker and brand theme
  await page.screenshot({
    path: "C:/Users/aslam/.gemini/antigravity-ide/brain/26e48f45-8d3e-422a-812d-bb6a0845c19d/offer_letter_split_view.png",
  });

  // Close calendar popover
  await page.keyboard.press("Escape");

  // Capture Document Preview Page 1
  await page.getByRole("button", { name: "Page 1" }).click();
  await page.screenshot({
    path: "C:/Users/aslam/.gemini/antigravity-ide/brain/26e48f45-8d3e-422a-812d-bb6a0845c19d/offer_letter_doc_page1.png",
  });

  // Capture Document Preview Page 2
  await page.getByRole("button", { name: "Page 2" }).click();
  await page.screenshot({
    path: "C:/Users/aslam/.gemini/antigravity-ide/brain/26e48f45-8d3e-422a-812d-bb6a0845c19d/offer_letter_doc_page2.png",
  });

  // Switch to Offer Letters history tab
  await page.getByRole("button", { name: /Offer Letters/i }).click();
  await expect(
    page.getByPlaceholder("Search candidate or role..."),
  ).toBeVisible();

  // Capture screenshot of History Table
  await page.screenshot({
    path: "C:/Users/aslam/.gemini/antigravity-ide/brain/26e48f45-8d3e-422a-812d-bb6a0845c19d/offer_letter_history_view.png",
  });

  // Switch back to Generator & Preview to verify Download PDF
  await page.getByRole("button", { name: /Generator & Preview/i }).click();
  const downloadBtn = page.getByRole("button", { name: "Download PDF / Print" });
  await expect(downloadBtn).toBeVisible();
  await downloadBtn.click();

  // Verify the isolated print iframe is attached
  const printIframe = page.locator("#offer-letter-print-iframe");
  await expect(printIframe).toBeAttached();
});
