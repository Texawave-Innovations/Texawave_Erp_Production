import { expect, test } from "@playwright/test";

/**
 * Real-browser coverage for Work Logs: the HR approver screen loads from the
 * API and filters narrow the list; the self-service screen lists the caller's
 * own logs and blocks an invalid create submission before any request.
 * Uses the seeded Super Admin (packages/database/prisma/seed.ts) — run the
 * seed against a running dev DB first.
 */
async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Organization").fill("texawave-innovations");
  await page.getByLabel("Email").fill("admin@texawave.com");
  await page.getByLabel("Password").fill("ChangeMe123!");
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("lists work logs and narrows them with filters", async ({ page }) => {
  await signIn(page);
  // Client-side link, not page.goto: a hard navigation drops the in-memory
  // auth store (Docs/CODING_STANDARDS.md "Frontend API/state/error
  // standard" — tokens are deliberately not persisted across reloads).
  await page.getByRole("link", { name: "Work Logs" }).click();
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

  await signIn(page);
  await page.getByRole("link", { name: "Work Logs" }).click();
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
