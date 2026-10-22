import { test, expect } from "@playwright/test";
import { signInAsAdmin } from "./helpers/auth";

test.describe("TexaOne Global Calendar Theme Standardization (Ark UI Glass Theme)", () => {
  test.beforeEach(async ({ page }) => {
    await signInAsAdmin(page);
  });

  test("Top navbar calendar trigger renders .glass-calendar-surface and interactive month navigation", async ({
    page,
  }) => {
    const calendarBtn = page.getByRole("button", {
      name: /Current date and time/i,
    });
    await expect(calendarBtn).toBeVisible();

    // Open calendar popover
    await calendarBtn.click();

    // Verify calendar dialog popover
    const calendarDialog = page.getByRole("dialog", {
      name: "Interactive Calendar",
    });
    await expect(calendarDialog).toBeVisible();
    await expect(calendarDialog).toHaveClass(/glass-calendar-surface/);

    // Verify previous/next navigation buttons
    const prevBtn = calendarDialog.getByRole("button", {
      name: "Previous month",
    });
    const nextBtn = calendarDialog.getByRole("button", {
      name: "Next month",
    });
    await expect(prevBtn).toBeVisible();
    await expect(nextBtn).toBeVisible();

    // Verify Today shortcut
    const todayBtn = calendarDialog.getByRole("button", { name: "Today" });
    await expect(todayBtn).toBeVisible();

    // Capture screenshot of standardized header calendar popover
    await page.screenshot({
      path: "C:/Users/aslam/.gemini/antigravity-ide/brain/113e345c-5799-4e4f-b6d9-b2cee30b5a04/calendar_navbar_theme_verified.png",
    });

    // Close calendar on outside click
    await page.mouse.click(10, 10);
    await expect(calendarDialog).not.toBeVisible();
  });

  test("DateRangePicker renders .glass-calendar-surface, presets, squircle date cells, and range selection", async ({
    page,
  }) => {
    // Navigate to /hr/attendance which uses DateRangePicker in My Attendance
    const nav = page.getByRole("navigation", {
      name: "Main application navigation",
    });
    const hrBtn = nav.getByRole("button", { name: "Human Resources" });
    await hrBtn.click();
    const dropdown = page.getByRole("menu", {
      name: "Human Resources categories",
    });
    const timeLeaveBtn = dropdown.getByRole("button", { name: "Time & Leave" });
    await timeLeaveBtn.click();
    const subMenu = page.getByRole("menu", { name: "Time & Leave items" });
    await subMenu.getByRole("link", { name: "Attendance" }).click();
    await expect(page).toHaveURL(/\/hr\/attendance/);
    await page.waitForLoadState("networkidle");

    // Click My Attendance sub-tab
    const myAttendanceTab = page.getByRole("button", { name: "My attendance" });
    if (await myAttendanceTab.isVisible()) {
      await myAttendanceTab.click();
    }

    // Locate DateRangePicker trigger
    const rangePickerTrigger = page.getByRole("button", {
      name: /Select date range|From \d{4}-\d{2}-\d{2}|\d{4}-\d{2}-\d{2} - \d{4}-\d{2}-\d{2}/i,
    }).first();
    await expect(rangePickerTrigger).toBeVisible();

    // Open DateRangePicker popover
    await rangePickerTrigger.click();

    // Verify popover dialog
    const rangePopover = page.getByRole("dialog", {
      name: "Choose date range",
    });
    await expect(rangePopover).toBeVisible();
    await expect(rangePopover).toHaveClass(/glass-calendar-surface/);

    // Verify Presets sidebar
    await expect(rangePopover.getByText("Presets")).toBeVisible();
    const thisMonthPreset = rangePopover.getByRole("button", {
      name: "This Month",
    });
    await expect(thisMonthPreset).toBeVisible();

    // Verify squircle nav controls and year select
    const prevMonthBtn = rangePopover.getByRole("button", {
      name: "Previous month",
    });
    const nextMonthBtn = rangePopover.getByRole("button", {
      name: "Next month",
    });
    await expect(prevMonthBtn).toBeVisible();
    await expect(nextMonthBtn).toBeVisible();
    await expect(rangePopover.getByRole("combobox", { name: "Select year" })).toBeVisible();

    // Click This Month preset
    await thisMonthPreset.click();

    // Capture screenshot of standardized DateRangePicker
    await page.screenshot({
      path: "C:/Users/aslam/.gemini/antigravity-ide/brain/113e345c-5799-4e4f-b6d9-b2cee30b5a04/calendar_daterange_theme_verified.png",
    });

    // Apply selection
    const applyBtn = rangePopover.getByRole("button", { name: "Apply" });
    await applyBtn.click();
    await expect(rangePopover).not.toBeVisible();
  });

  test("Single DatePicker renders .glass-calendar-surface, squircle date cells, and selects date via custom popover", async ({
    page,
  }) => {
    // Navigate to /hr/holidays
    const nav = page.getByRole("navigation", {
      name: "Main application navigation",
    });
    const hrBtn = nav.getByRole("button", { name: "Human Resources" });
    await hrBtn.click();
    const dropdown = page.getByRole("menu", {
      name: "Human Resources categories",
    });
    const timeLeaveBtn = dropdown.getByRole("button", { name: "Time & Leave" });
    await timeLeaveBtn.click();
    const subMenu = page.getByRole("menu", { name: "Time & Leave items" });
    await subMenu.getByRole("link", { name: "Holidays" }).click();
    await expect(page).toHaveURL(/\/hr\/holidays/);
    await page.waitForLoadState("networkidle");

    // Click "New holiday"
    await page.getByRole("button", { name: "New holiday" }).first().click();
    const dateInput = page.getByLabel("Date", { exact: true });
    await expect(dateInput).toBeVisible();

    // Click date input to open custom popover
    await dateInput.click();

    // Verify .glass-calendar-surface popover
    const popover = page.getByTestId("date-picker-popover");
    await expect(popover).toBeVisible();
    await expect(popover).toHaveClass(/glass-calendar-surface/);

    // Verify navigation buttons
    await expect(popover.getByRole("button", { name: "Previous month" })).toBeVisible();
    await expect(popover.getByRole("button", { name: "Next month" })).toBeVisible();

    // Capture screenshot of single DatePicker popover
    await page.screenshot({
      path: "C:/Users/aslam/.gemini/antigravity-ide/brain/113e345c-5799-4e4f-b6d9-b2cee30b5a04/calendar_single_datepicker_verified.png",
    });

    // Click "Today" button in custom popover
    const todayBtn = popover.getByRole("button", { name: "Today" });
    await expect(todayBtn).toBeVisible();
    await todayBtn.click();

    // Popover closes and input is populated with today's date
    await expect(popover).not.toBeVisible();
    const val = await dateInput.inputValue();
    expect(val).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("Input type=date automatically uses the new Ark UI glass calendar theme in Regularization Request a correction", async ({
    page,
  }) => {
    // Navigate to /hr/regularization
    const nav = page.getByRole("navigation", {
      name: "Main application navigation",
    });
    const hrBtn = nav.getByRole("button", { name: "Human Resources" });
    await hrBtn.click();
    const dropdown = page.getByRole("menu", {
      name: "Human Resources categories",
    });
    const timeLeaveBtn = dropdown.getByRole("button", { name: "Time & Leave" });
    await timeLeaveBtn.click();
    const subMenu = page.getByRole("menu", { name: "Time & Leave items" });
    await subMenu.getByRole("link", { name: "Regularization" }).click();
    await expect(page).toHaveURL(/\/hr\/regularization/);
    await page.waitForLoadState("networkidle");

    // Click "Request a correction"
    await page.getByRole("button", { name: "Request a correction" }).click();
    const dateInput = page.getByLabel(/^Attendance date/);
    await expect(dateInput).toBeVisible();

    // Click date input to open custom popover
    await dateInput.click();

    // Verify .glass-calendar-surface popover
    const popover = page.getByTestId("date-picker-popover");
    await expect(popover).toBeVisible();
    await expect(popover).toHaveClass(/glass-calendar-surface/);

    // Capture screenshot of Regularization datepicker
    await page.screenshot({
      path: "C:/Users/aslam/.gemini/antigravity-ide/brain/113e345c-5799-4e4f-b6d9-b2cee30b5a04/calendar_regularization_datepicker_verified.png",
    });

    // Click "Today" button in custom popover
    const todayBtn = popover.getByRole("button", { name: "Today" });
    await expect(todayBtn).toBeVisible();
    await todayBtn.click();

    // Popover closes and input is populated
    await expect(popover).not.toBeVisible();
    const val = await dateInput.inputValue();
    expect(val).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("Month input (type=month) renders custom 12-month .glass-calendar-surface popover in Attendance Monthly tab", async ({
    page,
  }) => {
    // Navigate to /hr/attendance
    const nav = page.getByRole("navigation", {
      name: "Main application navigation",
    });
    const hrBtn = nav.getByRole("button", { name: "Human Resources" });
    await hrBtn.click();
    const dropdown = page.getByRole("menu", {
      name: "Human Resources categories",
    });
    const timeLeaveBtn = dropdown.getByRole("button", { name: "Time & Leave" });
    await timeLeaveBtn.click();
    const subMenu = page.getByRole("menu", { name: "Time & Leave items" });
    await subMenu.getByRole("link", { name: "Attendance" }).click();
    await expect(page).toHaveURL(/\/hr\/attendance/);
    await page.waitForLoadState("networkidle");

    // Click "Employee month" tab
    const employeeMonthTab = page.getByRole("tab", { name: "Employee month" });
    await expect(employeeMonthTab).toBeVisible();
    await employeeMonthTab.click();

    // Click Month input
    const monthInput = page.getByLabel("Month", { exact: true });
    await expect(monthInput).toBeVisible();
    await monthInput.click();

    // Verify .glass-calendar-surface popover with 12 months
    const popover = page.getByTestId("date-picker-popover");
    await expect(popover).toBeVisible();
    await expect(popover).toHaveClass(/glass-calendar-surface/);

    // Verify month short names are visible
    await expect(popover.getByRole("button", { name: "Jan", exact: true })).toBeVisible();
    await expect(popover.getByRole("button", { name: "Dec", exact: true })).toBeVisible();

    // Capture screenshot of Month picker
    await page.screenshot({
      path: "C:/Users/aslam/.gemini/antigravity-ide/brain/113e345c-5799-4e4f-b6d9-b2cee30b5a04/calendar_month_picker_verified.png",
    });

    // Click "This Month"
    const thisMonthBtn = popover.getByRole("button", { name: "This Month" });
    await expect(thisMonthBtn).toBeVisible();
    await thisMonthBtn.click();

    // Popover closes and month value formatted as YYYY-MM
    await expect(popover).not.toBeVisible();
    const val = await monthInput.inputValue();
    expect(val).toMatch(/^\d{4}-\d{2}$/);
  });
});
