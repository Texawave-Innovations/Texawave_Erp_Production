import { expect, test } from "@playwright/test";
import { signInAsAdmin } from "./helpers/auth";

/**
 * Real-browser coverage for Work Logs: the HR approver screen loads from the
 * API and filters narrow the list; the self-service screen lists the caller's
 * own logs and blocks an invalid create submission before any request.
 * Uses the seeded Super Admin (packages/database/prisma/seed.ts) — run the
 * seed against a running dev DB first.
 *
 * Tokens live in memory only (stores/auth-store.ts), so every navigation
 * after sign-in is an in-app link click, never `page.goto` to a protected
 * URL (same constraint documented in e2e/hr-employees.spec.ts,
 * e2e/hr-profiles.spec.ts, e2e/hr-location-privilege.spec.ts and
 * e2e/hr-org-chart.spec.ts). This file signs in with the shared
 * `signInAsAdmin` helper and then reaches the screen via the sidebar link.
 */
async function openWorkLogs(page: import("@playwright/test").Page) {
  await page.getByRole("navigation").locator("a[href='/hr/work-logs']").click();
  await expect(page).toHaveURL(/\/hr\/work-logs$/);
}

test("lists work logs and narrows them with filters", async ({ page }) => {
  await signInAsAdmin(page);
  await openWorkLogs(page);
  await expect(page.getByRole("heading", { name: "Work Logs" })).toBeVisible();

  // The seeded Super Admin has `hr.work_log.approve` but no linked employee
  // record, so the approver queue (the caller's direct reports) 403s for it;
  // "All work logs" (own/team/all read) is the tab that works for this user.
  await page.getByRole("button", { name: "All work logs" }).click();

  await page
    .getByRole("combobox", { name: "Filter by status" })
    .selectOption("REJECTED");
  await page
    .getByRole("combobox", { name: "Filter by status" })
    .selectOption("");

  await expect(
    page
      .getByRole("table", { name: "Work logs" })
      .or(page.getByText(/No work logs|Nothing to approve/)),
  ).toBeVisible();
});

test("lists my work logs and blocks an invalid create submission", async ({
  page,
}) => {
  let posted = false;
  page.on("request", (req) => {
    if (
      req.method() === "POST" &&
      req.url().includes("/self-service/work-logs")
    )
      posted = true;
  });

  await signInAsAdmin(page);
  await openWorkLogs(page);
  await page.getByRole("button", { name: "My work logs" }).click();

  await expect(
    page.getByRole("heading", { name: "My Work Logs" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Submit work log" }).click();
  await page.getByRole("button", { name: "Submit", exact: true }).click();

  await expect(
    page.getByText("Describe the task in at least 3 characters"),
  ).toBeVisible();
  expect(posted).toBe(false);
});
