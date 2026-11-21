import { expect, test } from "@playwright/test";
import { signInAsAdmin } from "./helpers/auth";

/**
 * Team Timesheets (menu code portal-team-timesheets): submitted days of the
 * people the signed-in user reviews. The seeded Super Admin holds every
 * permission, so it sees both lists. Reading only: a submitted day cannot be
 * deleted afterwards, so the full submit -> approve flow is covered by the API
 * e2e (apps/api/test/timesheets-review.e2e-spec.ts), not here.
 */
test.describe("Team Timesheets", () => {
  test.beforeEach(async ({ page }) => {
    await signInAsAdmin(page);
  });

  test("opens from the portal sidebar and shows what is waiting", async ({
    page,
  }) => {
    await page.goto("/portal");
    await page
      .getByRole("navigation", { name: "My Portal Navigation" })
      .getByRole("link", { name: "Team Timesheets" })
      .click();
    await expect(page).toHaveURL(/\/portal\/team-timesheets/);
    await expect(
      page.getByRole("heading", { name: "Team Timesheets" }),
    ).toBeVisible();
    // Super Admin can both decide and read, so both lists are offered.
    await expect(
      page.getByRole("tab", { name: "Awaiting my decision" }),
    ).toBeVisible();
    await expect(
      page.getByRole("tab", { name: "All submitted" }),
    ).toBeVisible();
  });

  test("the all-submitted list can be filtered by status", async ({ page }) => {
    await page.goto("/portal/team-timesheets");
    await page.getByRole("tab", { name: "All submitted" }).click();
    // the ui-kit Select is a combobox (a hidden native select sits beside it)
    const filter = page.getByRole("combobox", { name: "Filter by status" });
    await expect(filter).toBeVisible();
    await filter.click();
    await page.getByRole("option", { name: "Approved" }).click();
    await expect(filter).toContainText("Approved");
  });

  test("shows the review counts on top", async ({ page }) => {
    await page.goto("/portal/team-timesheets");
    const summary = page.getByRole("region", { name: "Review summary" });
    await expect(summary).toBeVisible();
    await expect(summary.getByText("Waiting for me")).toBeVisible();
    await expect(summary.getByText("Submitted", { exact: true })).toBeVisible();
    await expect(summary.getByText("Needs a look")).toBeVisible();
    await expect(summary.getByText("Approved this month")).toBeVisible();
  });

  test("the report tab covers a date range and offers the CSV downloads", async ({
    page,
  }) => {
    await page.goto("/portal/team-timesheets");
    await page.getByRole("tab", { name: "Report" }).click();
    const report = page.getByRole("region", { name: "Timesheet report" });
    await expect(report).toBeVisible();
    await expect(report.getByLabel("Report from")).toBeVisible();
    await expect(report.getByLabel("Report to")).toBeVisible();
    // Super Admin holds the export permission, so both downloads are offered.
    await expect(
      report.getByRole("button", { name: "CSV by employee" }),
    ).toBeVisible();
    await expect(
      report.getByRole("button", { name: "CSV by day" }),
    ).toBeVisible();
    // An impossible range is explained instead of sent.
    await report.getByLabel("Report from").fill("2099-01-02");
    await report.getByLabel("Report to").fill("2099-01-01");
    await expect(
      page.getByText("Choose a start date that is not after the end date."),
    ).toBeVisible();
  });

  test("the CSV by employee downloads a file", async ({ page }) => {
    await page.goto("/portal/team-timesheets");
    await page.getByRole("tab", { name: "Report" }).click();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "CSV by employee" }).click();
    expect((await download).suggestedFilename()).toMatch(
      /^timesheets-by-employee-\d{4}-\d{2}-\d{2}-to-\d{4}-\d{2}-\d{2}\.csv$/,
    );
  });

  test("the Week tab shows Monday to Sunday and moves between weeks", async ({
    page,
  }) => {
    await page.goto("/portal/team-timesheets");
    await page.getByRole("tab", { name: "Week" }).click();
    const grid = page.getByRole("region", { name: "Weekly timesheet grid" });
    await expect(grid).toBeVisible();

    // this week is shown first; "This week" is disabled until we leave it
    const thisWeek = grid.getByRole("button", { name: "This week" });
    await expect(thisWeek).toBeDisabled();
    const heading = grid.getByRole("heading", { level: 2 });
    const current = await heading.innerText();

    // either people with work (a table: Monday..Sunday, a total column and a
    // team-total row) or the empty state — the data in the database decides
    const table = grid.getByRole("table");
    const empty = grid.getByText("No work recorded this week");
    await expect(table.or(empty)).toBeVisible();
    if (await table.isVisible()) {
      for (const day of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]) {
        await expect(
          table.getByRole("columnheader", { name: new RegExp(`^${day}`) }),
        ).toBeVisible();
      }
      await expect(
        table.getByRole("columnheader", { name: "Week" }),
      ).toBeVisible();
      await expect(table.getByText("Team total")).toBeVisible();
    }

    await grid.getByRole("button", { name: "Previous week" }).click();
    await expect(heading).not.toHaveText(current);
    await expect(thisWeek).toBeEnabled();
    await grid.getByRole("button", { name: "Next week" }).click();
    await expect(heading).toHaveText(current);
    await expect(thisWeek).toBeDisabled();
  });

  test("the Week grid jumps to the week of a chosen date", async ({ page }) => {
    await page.goto("/portal/team-timesheets");
    await page.getByRole("tab", { name: "Week" }).click();
    const grid = page.getByRole("region", { name: "Weekly timesheet grid" });
    // 18 Nov 2026 is a Wednesday: the week is Monday 16 to Sunday 22 Nov
    await grid.getByLabel("Jump to the week of").fill("2026-11-18");
    await expect(grid.getByRole("heading", { level: 2 })).toHaveText(
      /16 Nov.*22 Nov 2026/,
    );
  });

  test("HR workspace opens the same screen", async ({ page }) => {
    await page.goto("/hr/timesheets");
    await expect(
      page.getByRole("heading", { name: "Team Timesheets" }),
    ).toBeVisible();
  });
});
