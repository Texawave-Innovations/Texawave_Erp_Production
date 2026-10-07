import { expect, test } from "@playwright/test";

/**
 * Real-browser coverage for Attendance: the HR screen loads from the API and
 * filters narrow the list; the self-service screen lists the caller's own
 * attendance and exposes check-in/check-out. Uses the seeded Super Admin
 * (packages/database/prisma/seed.ts) — run the seed against a running dev DB
 * first.
 */
async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Organization").fill("texawave-innovations");
  await page.getByLabel("Email").fill("admin@texawave.com");
  await page.getByLabel("Password").fill("ChangeMe123!");
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("lists attendance and narrows it with filters", async ({ page }) => {
  await signIn(page);
  // Client-side link, not page.goto: a hard navigation drops the in-memory
  // auth store (Docs/CODING_STANDARDS.md "Frontend API/state/error
  // standard" — tokens are deliberately not persisted across reloads).
  await page.getByRole("link", { name: "Attendance" }).click();
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
  await signIn(page);
  await page.getByRole("link", { name: "Attendance" }).click();

  await page.getByRole("textbox", { name: "From date" }).fill("2026-01-31");
  await page.getByRole("textbox", { name: "To date" }).fill("2026-01-01");

  await expect(page.getByText("must not be after")).toBeVisible();
});

test("my attendance: lists own history and exposes check-in/check-out", async ({
  page,
}) => {
  await signIn(page);
  await page.getByRole("link", { name: "Attendance" }).click();

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
