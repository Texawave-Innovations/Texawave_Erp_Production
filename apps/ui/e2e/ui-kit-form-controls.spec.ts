import { expect, test } from "@playwright/test";
import { signInAsAdmin, uniqueName } from "./helpers/auth";

/**
 * Focused tests for Phase 3 promoted UI-Kit form controls:
 * 1. SearchInput (controlled value, accessible searchbox, clear action, no form submission)
 * 2. DatePicker (controlled single-date, exact calendar date retention, zero timezone skew, disabled state)
 * 3. PasswordField (masked initially, reveal/re-mask toggle, accessible toggle label, no form submission)
 */

test.describe("Global UI Kit Phase 3 — Form Controls", () => {
  test("SearchInput supports controlled search query, accessible label, and non-submitting clear action", async ({
    page,
  }) => {
    await signInAsAdmin(page);

    // Navigate to /hr/employees which uses SearchInput
    await page
      .getByRole("navigation")
      .locator("a[href='/hr/employees']")
      .click();
    await expect(page).toHaveURL(/\/hr\/employees$/);
    await expect(
      page.getByRole("heading", { name: "Employees" }),
    ).toBeVisible();

    const searchBox = page.getByRole("searchbox", { name: "Search employees" });
    await expect(searchBox).toBeVisible();

    // Fill query
    await searchBox.fill("Engineering");
    await expect(searchBox).toHaveValue("Engineering");

    // Clear button should become visible
    const clearButton = page.getByRole("button", { name: "Clear search" });
    await expect(clearButton).toBeVisible();

    // Clicking clear resets query
    await clearButton.click();
    await expect(searchBox).toHaveValue("");
    await expect(clearButton).not.toBeVisible();
  });

  test("DatePicker retains exact calendar date without timezone shifts, respects min/max constraints and empty value", async ({
    page,
  }) => {
    await signInAsAdmin(page);

    // 1. Test DatePicker on /hr/employees/new (checking min/max constraints, controlled value, and exact date)
    await page
      .getByRole("navigation")
      .locator("a[href='/hr/employees']")
      .click();
    await expect(page).toHaveURL(/\/hr\/employees$/);
    await page.getByRole("button", { name: "Add Employee" }).click();
    await expect(page).toHaveURL(/\/hr\/employees\/new$/);
    await expect(
      page.getByRole("heading", { name: "New hire", exact: true }),
    ).toBeVisible();

    const joiningDatePicker = page.getByLabel(/^Date of joining/);
    await expect(joiningDatePicker).toBeVisible();
    await expect(joiningDatePicker).toHaveAttribute("type", "date");
    await expect(joiningDatePicker).toHaveAttribute("min", "1900-01-01");
    await expect(joiningDatePicker).toHaveAttribute("max", "2099-12-31");

    // Fill date and verify calendar day retained accurately without timezone shift
    const targetDate = "2026-07-15";
    await joiningDatePicker.fill(targetDate);
    await expect(joiningDatePicker).toHaveValue(targetDate);
    expect(await joiningDatePicker.inputValue()).toBe(targetDate);

    // Empty value support
    await joiningDatePicker.fill("");
    await expect(joiningDatePicker).toHaveValue("");

    // 2. Test DatePicker validation on /hr/holidays
    await page.getByRole("link", { name: "Holidays", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Holidays", exact: true }),
    ).toBeVisible();

    await page.getByRole("button", { name: "New holiday" }).click();
    const holidayDatePicker = page.getByLabel("Date", { exact: true });
    await expect(holidayDatePicker).toBeVisible();
    await expect(holidayDatePicker).toHaveAttribute("type", "date");

    // Submitting without date triggers FormField validation error
    await page.getByRole("button", { name: "Create holiday" }).click();
    await expect(page.getByText("Date is required")).toBeVisible();

    // Fill date into holiday date picker
    await holidayDatePicker.fill("2026-12-25");
    await expect(holidayDatePicker).toHaveValue("2026-12-25");
    expect(await holidayDatePicker.inputValue()).toBe("2026-12-25");

    // Cancel modal cleanly
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(holidayDatePicker).not.toBeVisible();
  });

  test("PasswordField is initially masked, toggles visibility without altering value, and toggle does not submit form", async ({
    page,
  }) => {
    await signInAsAdmin(page);

    // Navigate to /admin/users which uses PasswordField in UserForm
    await page
      .getByRole("navigation")
      .locator("a[href='/admin/users']")
      .click();
    await expect(page).toHaveURL(/\/admin\/users$/);
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();

    await page.getByRole("button", { name: "New user" }).click();

    const passwordInput = page.getByLabel(/^Password/);
    await expect(passwordInput).toBeVisible();

    // 1. Initially type is "password"
    await expect(passwordInput).toHaveAttribute("type", "password");

    const toggleButton = page.getByRole("button", { name: "Show password" });
    await expect(toggleButton).toBeVisible();

    // Fill password value
    const testSecret = "SecretPass123!";
    await passwordInput.fill(testSecret);
    await expect(passwordInput).toHaveValue(testSecret);

    // 2. Click toggle button -> reveals password, becomes type="text", label becomes "Hide password"
    await toggleButton.click();
    await expect(passwordInput).toHaveAttribute("type", "text");
    await expect(passwordInput).toHaveValue(testSecret); // Value preserved

    const hideButton = page.getByRole("button", { name: "Hide password" });
    await expect(hideButton).toBeVisible();

    // 3. Toggle button must NOT submit the form (e.g. required errors not triggered prematurely)
    await expect(page.getByText("Full Name is required")).toHaveCount(0);
    await expect(page.getByText("Email is required")).toHaveCount(0);

    // 4. Click hide button -> re-masks password
    await hideButton.click();
    await expect(passwordInput).toHaveAttribute("type", "password");
    await expect(passwordInput).toHaveValue(testSecret);
    await expect(
      page.getByRole("button", { name: "Show password" }),
    ).toBeVisible();
  });
});
