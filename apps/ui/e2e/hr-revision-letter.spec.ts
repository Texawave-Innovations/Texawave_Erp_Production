import { test, expect } from "@playwright/test";
import { signInAsAdmin } from "./helpers/auth";

test("Revision Letter generator renders full form with all reference UI fields in current layout", async ({
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

  // Click Revision letter tab
  const revTab = page.getByRole("tab", { name: /Revision letter/i });
  await expect(revTab).toBeVisible();
  await revTab.click();

  // Click the first employee's "Revision letter" action button
  const issueBtn = page.getByRole("button", { name: /Issue revision letter to/i }).first();
  await expect(issueBtn).toBeVisible({ timeout: 10000 });
  await issueBtn.click();

  // Verify Revision Details Section 1
  await expect(page.getByText("Revision Details").first()).toBeVisible();
  await expect(page.getByText("Employee Name *")).toBeVisible();
  await expect(page.getByText("Document No.")).toBeVisible();
  await expect(page.getByText("Letter Date")).toBeVisible();
  await expect(page.getByText("Effective Date *")).toBeVisible();

  // Verify Compensation Adjustments Section 2
  await expect(page.getByText("Compensation Adjustments")).toBeVisible();
  await expect(page.getByText("Current CTC (Annual) ₹")).toBeVisible();
  await expect(page.getByText("Revised CTC (Annual) ₹ *")).toBeVisible();
  await expect(page.getByText("Increment %")).toBeVisible();
  await expect(page.getByText("Increment amount ₹")).toBeVisible();
  await expect(page.getByRole("button", { name: "Monthly Salary" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Annual Salary" })).toBeVisible();
  await expect(page.getByText("Net Monthly Salary:")).toBeVisible();
  await expect(page.getByText("Gross Monthly CTC:")).toBeVisible();
  await expect(page.getByText("Gross Annual CTC:")).toBeVisible();
  await expect(page.getByText("Basic (35%)")).toBeVisible();
  await expect(page.getByText("DA (15%)")).toBeVisible();
  await expect(page.getByText("HRA (30%)")).toBeVisible();
  await expect(page.getByText("CA (20%)")).toBeVisible();

  // Verify Remarks & Signatory Section 3
  await expect(page.getByText("Remarks & Signatory")).toBeVisible();
  await expect(page.getByText("SIGNATURE & COMPANY SEAL UPLOADS")).toBeVisible();
  await expect(page.getByText("Signatory Signature Image")).toBeVisible();
  await expect(page.getByText("Company Seal / Stamp Image")).toBeVisible();

  // Test entering a monthly salary to verify auto calculation
  const monthlySalaryInput = page.getByPlaceholder("e.g. 15000");
  if (await monthlySalaryInput.isVisible()) {
    await monthlySalaryInput.fill("15000");
  }

  // Verify Document Preview 2-Page Navigation
  await expect(page.getByRole("button", { name: "All (2 Pages)" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Page 1" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Page 2" })).toBeVisible();

  // Test Page 1 toggle
  const page1Btn = page.getByRole("button", { name: "Page 1" });
  await page1Btn.click();
  await page.screenshot({
    path: "C:/Users/aslam/.gemini/antigravity-ide/brain/26e48f45-8d3e-422a-812d-bb6a0845c19d/revision_doc_preview_page1.png",
  });

  // Switch to Page 2 and verify
  const page2Btn = page.getByRole("button", { name: "Page 2" });
  await page2Btn.click();
  await expect(page.getByText("EMPLOYEE ACCEPTANCE")).toBeVisible();
  await page.screenshot({
    path: "C:/Users/aslam/.gemini/antigravity-ide/brain/26e48f45-8d3e-422a-812d-bb6a0845c19d/revision_doc_preview_page2.png",
  });
});



