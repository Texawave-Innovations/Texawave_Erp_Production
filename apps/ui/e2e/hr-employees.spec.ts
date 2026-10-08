import { expect, test } from "@playwright/test";
import { signInAsAdmin } from "./helpers/auth";

/**
 * Real-browser coverage for the HR employee screens: the directory loads from
 * the API, search narrows the list, and the "New employee" entry point
 * blocks an invalid submission before any request. Uses the seeded Super
 * Admin (packages/database/prisma/seed.ts) — run the seed against a running
 * dev DB first.
 *
 * Tokens live in memory only (stores/auth-store.ts), so every navigation
 * after sign-in is an in-app link/button click, never `page.goto` to a
 * protected URL — a hard navigation discards them and lands back on
 * /login, which is why this file uses the shared `signInAsAdmin` helper and
 * then clicks through the UI instead of re-navigating with `page.goto`.
 */

test("lists employees and narrows them with search", async ({ page }) => {
  await signInAsAdmin(page);
  await page.getByRole("navigation").locator("a[href='/hr/employees']").click();
  await expect(page).toHaveURL(/\/hr\/employees$/);

  await expect(page.getByRole("heading", { name: "Employees" })).toBeVisible();
  await expect(page.getByRole("table", { name: "Employees" })).toBeVisible();

  await page
    .getByRole("searchbox", { name: "Search employees" })
    .fill("zz-no-such-employee-zz");
  await expect(
    page.getByText("No employees match these filters"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Clear filters" }),
  ).toBeVisible();
});

test.fixme("shows a not-found state for an employee that does not exist", async ({
  page,
}) => {
  // No in-app link ever points at a nonexistent id, and a hard
  // `page.goto` to a protected URL discards the in-memory-only auth
  // tokens (stores/auth-store.ts) — the page lands back on /login
  // instead of the employee record, regardless of when the goto happens.
  // Not reachable end-to-end until the documented "move the refresh
  // token server-side" follow-up in that file lands.
  await signInAsAdmin(page);
  await page.goto("/hr/employees/999999999");

  await expect(page.getByText("Employee not found")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Back to employees" }),
  ).toBeVisible();
});

test("blocks an empty new-hire submission before calling the API", async ({
  page,
}) => {
  let posted = false;
  page.on("request", (req) => {
    if (req.method() === "POST" && req.url().includes("/employees"))
      posted = true;
  });

  await signInAsAdmin(page);
  await page.getByRole("navigation").locator("a[href='/hr/employees']").click();
  // "New employee" (EmployeesView) routes to the "New hire" form
  // (NewHireView), which creates the employee and their login together —
  // the self-onboarding module's flow superseded the plain employee-only
  // create form for this entry point.
  await page.getByRole("button", { name: "New employee" }).click();
  await expect(page).toHaveURL(/\/hr\/employees\/new$/);

  await page.getByRole("button", { name: "Create new hire" }).click();

  await expect(page.getByText("First name is required")).toBeVisible();
  await expect(page.getByText("Last name is required")).toBeVisible();
  expect(posted).toBe(false);
});
