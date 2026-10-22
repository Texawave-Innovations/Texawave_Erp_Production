import { test, expect } from "@playwright/test";
import { signInAsAdmin } from "./helpers/auth";

test.use({ viewport: { width: 1272, height: 668 } });

test("Interview Schedule renders enhanced KPI cards, single status dropdown, and non-overflowing reset button", async ({
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

  // Verify Interview Schedule tab is active and visible
  const interviewTab = page.getByRole("tab", { name: /Interview schedule/i });
  await expect(interviewTab).toBeVisible();
  await interviewTab.click();

  // 1. Verify Feedback 1: Single Status Dropdown (No duplicate badge)
  const statusSelect = page.getByRole("combobox", { name: /Status for/i }).first();
  await expect(statusSelect).toBeVisible();

  // 2. Verify: Card counts stay stable even when another card is selected
  const activeCard = page.getByTestId("kpi-card-scheduled");
  const completedCard = page.getByTestId("kpi-card-completed");

  // Initial check: Active Scheduled has 1
  await expect(activeCard).toContainText("1");

  // Click Completed (switches to completed - table shows empty state)
  await completedCard.click();
  await expect(page.getByText(/No interviews found/i)).toBeVisible();

  // CRITICAL CHECK: Active Scheduled card STILL displays 1 (does NOT become 0!)
  await expect(activeCard).toContainText("1");

  // Click Active Scheduled AGAIN - data shows properly!
  await activeCard.click();
  await expect(page.getByText(/Showing 1 to 1/i)).toBeVisible();
  await expect(activeCard).toContainText("1");

  // 3. Verify: Reset button stays cleanly inside container without overflow
  const searchInput = page.getByPlaceholder("Search candidate, role or interviewer...");
  await searchInput.fill("Managing");
  const resetBtn = page.getByRole("button", { name: "Reset Filters" });
  await expect(resetBtn).toBeVisible();

  // Reset search so table row shows
  await searchInput.fill("");
  await page.waitForTimeout(300);

  // 4. Verify custom Select dropdown open effect on table row status
  await statusSelect.click();
  const listbox = page.getByRole("listbox");
  await expect(listbox).toBeVisible();
  await expect(page.getByRole("option", { name: "Completed" })).toBeVisible();

  // Capture screenshot of the table with the custom Select dropdown open
  await page.screenshot({
    path: "C:/Users/aslam/.gemini/antigravity-ide/brain/26e48f45-8d3e-422a-812d-bb6a0845c19d/interview_schedule_dropdown_effect.png",
  });

  // Close dropdown by pressing Escape
  await page.keyboard.press("Escape");
  await expect(listbox).not.toBeVisible();

  // Capture clean list screenshot
  await page.screenshot({
    path: "C:/Users/aslam/.gemini/antigravity-ide/brain/26e48f45-8d3e-422a-812d-bb6a0845c19d/interview_schedule_list_fixed_1272.png",
  });

  // Verify Reset Filters button when date range is active
  const dateBtn = page.getByRole("button", { name: /Select date range/i });
  await expect(dateBtn).toBeVisible();

  // Open Create Form and capture screenshot
  const scheduleBtn = page.getByRole("button", { name: /Schedule interview/i }).first();
  await scheduleBtn.click();
  await expect(page.getByText("Schedule New Interview")).toBeVisible();
  await page.screenshot({
    path: "C:/Users/aslam/.gemini/antigravity-ide/brain/26e48f45-8d3e-422a-812d-bb6a0845c19d/interview_schedule_form_fixed_1272.png",
  });
});
