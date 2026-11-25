import { expect, test } from "@playwright/test";
import { signInAsAdmin } from "./helpers/auth";

/**
 * The month "Attendance" tab on My Timesheet (employee portal) and the
 * employee drill-down in the HR timesheet report. The seeded Super Admin has an
 * employee profile and every permission, which is all these screens need. They
 * read HR attendance and approved work permissions; nothing here writes data.
 * Run `pnpm --filter database seed` first.
 */
test.describe("Timesheet attendance month", () => {
  test.beforeEach(async ({ page }) => {
    await signInAsAdmin(page);
  });

  test("My Timesheet has Log Work and Attendance tabs; Attendance shows the month", async ({
    page,
  }) => {
    await page.goto("/portal/timesheet");
    await expect(
      page.getByRole("heading", { name: "My Timesheet" }),
    ).toBeVisible();

    // Log Work is the default: today's day view is still there.
    await expect(page.getByLabel("Choose a date")).toBeVisible();

    await page.getByRole("tab", { name: "Attendance", exact: true }).click();
    await expect(
      page.getByRole("combobox", { name: "Month", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("combobox", { name: "Year", exact: true }),
    ).toBeVisible();
    // The day controls belong to Log Work only.
    await expect(page.getByLabel("Choose a date")).toHaveCount(0);

    // The summary cards of the old screen, plus Permission.
    for (const label of [
      "Present",
      "Absent",
      "Leave",
      "Holiday",
      "Permission",
      "Hrs Logged",
    ]) {
      await expect(
        page.getByLabel("Month summary").getByText(label, { exact: true }),
      ).toBeVisible();
    }

    // One row per calendar day with the columns of the old screen.
    for (const column of [
      "Date",
      "Day",
      "Status",
      "Check In",
      "Check Out",
      "Hours",
      "Target",
      "Permission",
      "Logged",
    ]) {
      await expect(
        page.getByRole("columnheader", { name: column, exact: true }),
      ).toBeVisible();
    }
    const rows = page
      .getByRole("table", { name: /attendance$/ })
      .locator("tbody tr");
    expect(await rows.count()).toBeGreaterThanOrEqual(28);
    expect(await rows.count()).toBeLessThanOrEqual(31);
  });

  test("moving to another month reloads the table", async ({ page }) => {
    await page.goto("/portal/timesheet");
    await page.getByRole("tab", { name: "Attendance", exact: true }).click();
    await page.getByRole("combobox", { name: "Month", exact: true }).click();
    await page.getByRole("option", { name: "February" }).click();
    await page.getByRole("combobox", { name: "Year", exact: true }).click();
    await page.getByRole("option", { name: "2026" }).click();
    await expect(
      page.getByRole("heading", { name: /February 2026 — Attendance/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("table", { name: /attendance$/ }).locator("tbody tr"),
    ).toHaveCount(28);
    await expect(page.getByRole("row", { name: /01 Feb/ })).toBeVisible();
  });

  test("the HR report filters by team and opens one employee's month", async ({
    page,
  }) => {
    await page.goto("/hr/timesheets");
    await page.getByRole("tab", { name: "Report", exact: true }).click();

    await expect(
      page.getByRole("combobox", { name: "Filter by team" }),
    ).toBeVisible();
    await expect(
      page.getByRole("combobox", { name: "Open an employee" }),
    ).toBeVisible();

    // The report is per employee with recorded work, so it can be empty on a
    // fresh seed; when it has people, the totals follow the team filter and an
    // employee opens into the same month view the employee sees.
    const open = page.getByRole("button", { name: /^Open / }).first();
    if ((await open.count()) === 0) {
      await expect(page.getByText("No timesheets in this range")).toBeVisible();
      return;
    }
    await expect(page.getByTestId("report-totals")).toBeVisible();
    await open.click();

    const drill = page.getByTestId("employee-drilldown");
    await expect(drill).toBeVisible();
    await expect(
      drill.getByRole("button", { name: "Back to report" }),
    ).toBeVisible();
    await expect(
      drill.getByRole("combobox", { name: "Switch employee" }),
    ).toBeVisible();
    await expect(drill.getByLabel("Month summary")).toBeVisible();
    await expect(
      drill.getByRole("columnheader", { name: "Permission", exact: true }),
    ).toBeVisible();

    await drill.getByRole("button", { name: "Back to report" }).click();
    await expect(page.getByTestId("employee-drilldown")).toHaveCount(0);
    await expect(page.getByTestId("report-totals")).toBeVisible();
  });
});
