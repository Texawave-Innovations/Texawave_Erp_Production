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
  // Offered both in the toolbar and in the empty state.
  await expect(
    page.getByRole("button", { name: "Clear filters" }).first(),
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

test("shows the directory stats and filters the onboarding review queue", async ({
  page,
}) => {
  await signInAsAdmin(page);
  await page.getByRole("navigation").locator("a[href='/hr/employees']").click();

  for (const name of [
    "Total employees",
    "Active",
    "Awaiting review",
    "Onboarding in progress",
  ]) {
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
  }

  const toggle = page.getByRole("button", { name: "Awaiting review" });
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  // The review filter shows up as an active chip and can be cleared.
  await expect(
    page.getByText("Review submitted details").first(),
  ).toBeVisible();
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
});

test("exports the directory as CSV", async ({ page }) => {
  await signInAsAdmin(page);
  await page.getByRole("navigation").locator("a[href='/hr/employees']").click();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(
    /^employees-\d{4}-\d{2}-\d{2}\.csv$/,
  );
});

test("checks an import file and lists its problems without saving anything", async ({
  page,
}) => {
  let committed = false;
  page.on("request", (req) => {
    if (
      req.method() === "POST" &&
      req.url().includes("/hr/employees/import") &&
      !req.url().includes("dryRun=true")
    )
      committed = true;
  });

  await signInAsAdmin(page);
  await page.getByRole("navigation").locator("a[href='/hr/employees']").click();
  await page.getByRole("button", { name: "Import CSV" }).click();
  await expect(
    page.getByRole("dialog", { name: "Import employees" }),
  ).toBeVisible();

  const csv = [
    "Full Name,Team,Designation,Employment Type,Date of Joining",
    "E2E Import Person,No Such Team ZZ,No Such Designation ZZ,No Such Type ZZ,not-a-date",
  ].join("\n");
  await page.getByLabel("CSV file").setInputFiles({
    name: "bad-import.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv, "utf8"),
  });
  await page.getByRole("button", { name: "Check file" }).click();

  await expect(
    page.getByRole("table", { name: "Import problems" }),
  ).toBeVisible();
  await expect(
    page.getByText('Team "No Such Team ZZ" does not exist or is inactive'),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^Import \d+ employee/ }),
  ).toHaveCount(0);
  expect(committed).toBe(false);
});
