import { expect, test } from "@playwright/test";
import { signInAsAdmin } from "./helpers/auth";

/**
 * My Timesheet (employee portal, menu code portal-timesheet): the signed-in
 * employee's own work by day. Read-only screen — working a task happens in My
 * Work. The seeded Super Admin has an employee profile and every permission,
 * which is all this screen needs. Run `pnpm --filter database seed` first.
 */
test.describe("My Timesheet", () => {
  test.beforeEach(async ({ page }) => {
    await signInAsAdmin(page);
  });

  test("shows today's timesheet: an empty day is not an absence", async ({
    page,
  }) => {
    await page.goto("/portal/timesheet");

    await expect(
      page.getByRole("heading", { name: "My Timesheet" }),
    ).toBeVisible();
    await expect(page.getByLabel("Choose a date")).toBeVisible();

    // Nothing was started today: the day is empty, and the screen says so
    // without claiming an absence (attendance comes from HR only). Every day
    // carries an HR status chip (Present, Weekly off, Not marked, ...).
    await expect(page.getByText("No work recorded for this day")).toBeVisible();
    await expect(
      page.getByTitle("Attendance status from HR for this day"),
    ).toBeVisible();
    await expect(page.getByText("Total time")).toBeVisible();
  });

  test("moves between days and back to today", async ({ page }) => {
    await page.goto("/portal/timesheet");
    const dateInput = page.getByLabel("Choose a date");
    const today = await dateInput.inputValue();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    await page.getByRole("button", { name: "Previous day" }).click();
    await expect(dateInput).not.toHaveValue(today);
    // Today is enabled again only once we have left it.
    await expect(page.getByRole("button", { name: "Today" })).toBeEnabled();

    await page.getByRole("button", { name: "Today" }).click();
    await expect(dateInput).toHaveValue(today);
    await expect(page.getByRole("button", { name: "Today" })).toBeDisabled();
  });

  test("can jump to a chosen date", async ({ page }) => {
    await page.goto("/portal/timesheet");
    await page.getByLabel("Choose a date").fill("2026-11-16");
    await expect(
      page.getByRole("heading", { name: /16 November 2026/ }),
    ).toBeVisible();
    await expect(page.getByText("No work recorded for this day")).toBeVisible();
  });

  test("offers Submit week and asks before anything is sent", async ({
    page,
  }) => {
    await page.goto("/portal/timesheet");
    // An empty day has nothing to submit, so only the week button is offered.
    await expect(page.getByRole("button", { name: "Submit day" })).toHaveCount(
      0,
    );
    await page.getByRole("button", { name: "Submit week" }).click();
    await expect(
      page.getByText("Submit this week for approval?"),
    ).toBeVisible();
    // Cancelling sends nothing (a submitted day can never be deleted).
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByText("Submit this week for approval?")).toHaveCount(
      0,
    );
  });

  test("links to My Work, where work is started and stopped", async ({
    page,
  }) => {
    await page.goto("/portal/timesheet");
    await page.getByRole("link", { name: "My Work" }).first().click();
    await expect(page).toHaveURL(/\/portal\/work/);
  });

  // Custom activities: work that is not an assigned task. Each run uses its own
  // (past) date so a leftover from an interrupted run can never collide, and the
  // test removes what it created.
  test.describe("custom activities", () => {
    const daysBack = 1 + (Date.now() % 300);
    const day = new Date(Date.now() - daysBack * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const title = `E2E discussion ${Date.now()}`;

    test("validates the form before sending anything", async ({ page }) => {
      await page.goto("/portal/timesheet");
      await page.getByRole("button", { name: "Add custom activity" }).click();
      await page.getByRole("button", { name: "Add activity" }).click();
      await expect(
        page.getByText("Choose an activity category."),
      ).toBeVisible();
    });

    test("adds, edits and deletes an activity; the duration comes from the times", async ({
      page,
    }) => {
      await page.goto("/portal/timesheet");
      await page.getByLabel("Choose a date").fill(day);
      await expect(
        page.getByText("No work recorded for this day"),
      ).toBeVisible();

      // add: 14:00-15:00 IST is one hour; a past date is a late entry
      await page.getByRole("button", { name: "Add custom activity" }).click();
      await page.getByLabel("Category").selectOption("INTERNAL_MEETING");
      await page.getByLabel("Activity title").fill(title);
      await page.getByLabel("Start time (IST)").fill("14:00");
      await page.getByLabel("End time (IST)").fill("15:00");
      await expect(page.getByText("Duration: 1 h")).toBeVisible();
      await page
        .getByLabel("Reason for the late entry")
        .fill("Forgot to log it on the day");
      await page.getByRole("button", { name: "Add activity" }).click();

      const row = page.getByRole("listitem").filter({ hasText: title });
      await expect(row).toBeVisible();
      await expect(row.getByText("Internal meeting")).toBeVisible();
      await expect(row.getByText("1h", { exact: true })).toBeVisible();
      await expect(row.getByText(/02:00 pm.*03:00 pm/i)).toBeVisible();
      await expect(row.getByText(/Late entry/)).toBeVisible();

      // edit: stretch it to 16:30 -> 2h 30m
      await page.getByRole("button", { name: `Edit ${title}` }).click();
      await page.getByLabel("End time (IST)").fill("16:30");
      await expect(page.getByText("Duration: 2 h 30 min")).toBeVisible();
      await page.getByRole("button", { name: "Save changes" }).click();
      await expect(
        page
          .getByRole("listitem")
          .filter({ hasText: title })
          .getByText("2h 30m"),
      ).toBeVisible();

      // an overlapping second activity is refused with a clear message
      await page.getByRole("button", { name: "Add custom activity" }).click();
      await page.getByLabel("Category").selectOption("RESEARCH");
      await page.getByLabel("Activity title").fill("Overlapping research");
      await page.getByLabel("Start time (IST)").fill("15:00");
      await page.getByLabel("End time (IST)").fill("16:00");
      await page
        .getByLabel("Reason for the late entry")
        .fill("Forgot to log it");
      await page.getByRole("button", { name: "Add activity" }).click();
      // (not getByRole("alert"): Next's route announcer is also an alert)
      await expect(page.getByText(/This overlaps your activity/)).toBeVisible();
      await page.getByRole("button", { name: "Cancel" }).click();

      // delete
      await page.getByRole("button", { name: `Delete ${title}` }).click();
      await page.getByRole("button", { name: "Delete", exact: true }).click();
      await expect(
        page.getByRole("listitem").filter({ hasText: title }),
      ).toHaveCount(0);
      await expect(
        page.getByText("No work recorded for this day"),
      ).toBeVisible();
    });
  });
});
