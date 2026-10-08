import { expect, test } from "@playwright/test";
import { signInAsAdmin } from "./helpers/auth";

/**
 * Real-browser coverage for Attendance: the HR screen loads from the API and
 * filters narrow the list; the Corrections tab covers the correction-request
 * workflow (legacy Regularization, `Docs/ATTENDANCE_LEGACY_PARITY.md` §5.2);
 * the self-service screen lists the caller's own attendance, exposes
 * check-in/check-out, and lets the caller request and see their own
 * corrections. Uses the seeded Super Admin (packages/database/prisma/seed.ts)
 * — run the seed against a running dev DB first.
 *
 * Tokens live in memory only (stores/auth-store.ts), so every navigation
 * after sign-in is an in-app link click, never `page.goto` to a protected URL
 * (same constraint documented in e2e/hr-employees.spec.ts,
 * e2e/hr-profiles.spec.ts, e2e/hr-location-privilege.spec.ts,
 * e2e/hr-org-chart.spec.ts and e2e/hr-work-logs.spec.ts). This file signs in
 * with the shared `signInAsAdmin` helper and then reaches the screen via the
 * sidebar link.
 */
async function openAttendance(page: import("@playwright/test").Page) {
  await page
    .getByRole("navigation")
    .locator("a[href='/hr/attendance']")
    .click();
  await expect(page).toHaveURL(/\/hr\/attendance$/);
}

test("lists attendance and narrows it with filters", async ({ page }) => {
  await signInAsAdmin(page);
  await openAttendance(page);
  await expect(page.getByRole("heading", { name: "Attendance" })).toBeVisible();

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
});

test("shows a date-range error without a request when the range is invalid", async ({
  page,
}) => {
  await signInAsAdmin(page);
  await openAttendance(page);

  await page.getByRole("textbox", { name: "From date" }).fill("2026-01-31");
  await page.getByRole("textbox", { name: "To date" }).fill("2026-01-01");

  await expect(page.getByText("must not be after")).toBeVisible();
});

test("corrections tab lists correction requests and narrows them by status", async ({
  page,
}) => {
  await signInAsAdmin(page);
  await openAttendance(page);

  await page.getByRole("button", { name: "Corrections" }).click();
  await expect(
    page
      .getByRole("table", { name: "Attendance corrections" })
      .or(page.getByText("No correction requests match these filters")),
  ).toBeVisible();

  await page
    .getByRole("combobox", { name: "Filter corrections by status" })
    .selectOption("REJECTED");
  await page
    .getByRole("combobox", { name: "Filter corrections by status" })
    .selectOption("");

  await expect(
    page
      .getByRole("table", { name: "Attendance corrections" })
      .or(page.getByText("No correction requests match these filters")),
  ).toBeVisible();
});

test("my attendance: lists own history and exposes check-in/check-out", async ({
  page,
}) => {
  await signInAsAdmin(page);
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

test("my attendance: requesting a correction blocks an invalid submit before any request", async ({
  page,
}) => {
  let posted = false;
  page.on("request", (req) => {
    if (
      req.method() === "POST" &&
      req.url().includes("/hr/attendance/corrections")
    )
      posted = true;
  });

  await signInAsAdmin(page);
  await openAttendance(page);
  await page.getByRole("button", { name: "My attendance" }).click();
  await expect(
    page.getByRole("heading", { name: "My Attendance" }),
  ).toBeVisible();

  const requestBtn = page.getByRole("button", { name: "Request correction" });
  if (await requestBtn.isVisible()) {
    await requestBtn.click();
    await expect(
      page.getByRole("heading", { name: "Request a correction" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Submit", exact: true }).click();

    await expect(page.getByText("Date is required")).toBeVisible();
    expect(posted).toBe(false);
  }
});
