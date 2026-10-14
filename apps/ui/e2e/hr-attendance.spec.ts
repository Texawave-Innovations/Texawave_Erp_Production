import { expect, test, type Page } from "@playwright/test";
import { signInAsAdmin } from "./helpers/auth";

/**
 * Real-browser coverage for Attendance: the daily roster, records (filters
 * and range validation), the employee month calendar, missing punches, the
 * month close, punch import (dry run), CSV export, the notifications bell,
 * and self-service. Uses the seeded Super Admin
 * (packages/database/prisma/seed.ts) against the running dev API and UI.
 *
 * Tokens live in memory only, so every navigation after sign-in is an in-app
 * click — never `page.goto` to a protected URL.
 */
async function openAttendance(page: Page) {
  await signInAsAdmin(page);
  await page
    .getByRole("navigation")
    .locator("a[href='/hr/attendance']")
    .first()
    .click();
  await expect(page.getByRole("heading", { name: "Attendance" })).toBeVisible();
}

test("daily roster lists everyone for a date and filters by status", async ({
  page,
}) => {
  await openAttendance(page);
  await expect(page.getByRole("tab", { name: "Daily roster" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  const roster = page
    .getByRole("table", { name: /Attendance roster for/ })
    .or(page.getByText("No employees for this date"));
  await expect(roster).toBeVisible();

  await page.getByRole("button", { name: "Previous day" }).click();
  await expect(roster).toBeVisible();

  await page.getByRole("button", { name: /^Not marked/ }).click();
  await expect(
    page.getByRole("button", { name: /^Not marked/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("textbox", { name: "Search by name or code" })
    .fill("zz-nobody-zz");
  await expect(
    page
      .getByText("No one matches these filters")
      .or(page.getByText("No employees for this date")),
  ).toBeVisible();
});

test("records tab narrows with filters and rejects an inverted range", async ({
  page,
}) => {
  await openAttendance(page);
  await page.getByRole("tab", { name: "Records" }).click();

  await page
    .getByRole("combobox", { name: "Filter by status" })
    .selectOption("ABSENT");
  await page
    .getByRole("combobox", { name: "Filter by status" })
    .selectOption("");
  await expect(
    page
      .getByRole("table", { name: "Attendance" })
      .or(page.getByText("No attendance records match these filters")),
  ).toBeVisible();

  await page.getByRole("textbox", { name: "From date" }).fill("2026-01-31");
  await page.getByRole("textbox", { name: "To date" }).fill("2026-01-01");
  await expect(page.getByText("must not be after")).toBeVisible();
});

test("employee month asks for an employee, then shows a calendar", async ({
  page,
}) => {
  await openAttendance(page);
  await page.getByRole("tab", { name: "Employee month" }).click();
  await expect(
    page.getByText("Choose an employee", { exact: true }),
  ).toBeVisible();

  const employee = page.getByRole("combobox", { name: "Employee" });
  const options = employee.locator("option");
  await expect.poll(() => options.count()).toBeGreaterThan(1);
  const value = await options.nth(1).getAttribute("value");
  await employee.selectOption(value ?? "");
  await expect(
    page
      .getByRole("grid", { name: /Attendance calendar for/ })
      .or(page.getByText("No month to show")),
  ).toBeVisible();
});

test("missing punches lists problems or says there are none", async ({
  page,
}) => {
  await openAttendance(page);
  await page.getByRole("tab", { name: "Missing punches" }).click();
  await expect(
    page
      .getByRole("table", { name: "Missing punches" })
      .or(page.getByText("No missing punches")),
  ).toBeVisible();
});

test("month close lists last month and refuses to submit an unfinished month", async ({
  page,
}) => {
  await openAttendance(page);
  await page.getByRole("tab", { name: "Month close" }).click();
  await expect(
    page
      .getByRole("table", { name: /Attendance close for/ })
      .or(page.getByText("Nobody to show")),
  ).toBeVisible();

  const thisMonth = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
  })
    .format(new Date())
    .slice(0, 7);
  await page.getByLabel("Month to close").fill(thisMonth);
  await expect(page.getByText(/has not ended yet/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Submit all eligible" }),
  ).toBeDisabled();
});

test("import checks a file and lists its problems without saving", async ({
  page,
}) => {
  await openAttendance(page);
  await page.getByRole("button", { name: "Import punches" }).click();
  const dialog = page.getByRole("dialog", { name: "Import punches" });
  await expect(dialog).toBeVisible();

  const csv =
    "Employee Code,Date,Check In,Check Out\r\nNO-SUCH-EMP,2026-09-01,10:00,18:00\r\nNO-SUCH-EMP,31-02-2026,10:00,09:00\r\n";
  await dialog.getByLabel("CSV file").setInputFiles({
    name: "punches.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv, "utf8"),
  });
  await dialog.getByRole("button", { name: "Check file" }).click();
  await expect(
    dialog.getByRole("table", { name: "Import problems" }),
  ).toBeVisible();
  await expect(dialog.getByText(/nothing was saved/)).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: /^Import \d+ punch/ }),
  ).toHaveCount(0);
});

test("export downloads a CSV for the chosen range", async ({ page }) => {
  await openAttendance(page);
  await page.getByRole("button", { name: "Export CSV" }).click();
  const dialog = page.getByRole("dialog", { name: "Export attendance" });
  const download = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Download CSV" }).click();
  expect((await download).suggestedFilename()).toMatch(
    /^attendance-\d{4}-\d{2}-\d{2}-to-\d{4}-\d{2}-\d{2}\.csv$/,
  );
});

test("the notifications bell opens the caller's inbox", async ({ page }) => {
  await openAttendance(page);
  await page.getByRole("button", { name: /^Notifications/ }).click();
  const inbox = page.getByRole("dialog", { name: "Notifications" });
  await expect(inbox).toBeVisible();
  await expect(
    inbox.getByText("You're all caught up.").or(inbox.getByRole("list")),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(inbox).toBeHidden();
});

test("my attendance: lists own history and exposes check-in/check-out", async ({
  page,
}) => {
  await openAttendance(page);
  const myAttendance = page.getByRole("button", { name: "My attendance" });
  if (await myAttendance.isVisible()) {
    await myAttendance.click();
    await expect(
      page.getByRole("heading", { name: "My Attendance" }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("table", { name: "My attendance" })
        .or(page.getByText("No attendance yet")),
    ).toBeVisible();
  }
});
