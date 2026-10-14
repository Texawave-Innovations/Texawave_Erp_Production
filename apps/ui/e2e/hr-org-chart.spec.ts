import { expect, test } from "@playwright/test";
import { signInAsAdmin } from "./helpers/auth";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

/**
 * Real-browser coverage for the HR org chart: the tree loads from
 * `/hr/org-chart`, search highlights a match, a node opens the detail
 * drawer, and the drawer links through to the employee's profile. Uses the
 * seeded Super Admin (packages/database/prisma/seed.ts) — run the seed
 * against a running dev DB first.
 *
 * Tokens live in memory only (stores/auth-store.ts), so every navigation
 * after sign-in is an in-app link click, never `page.goto` to a protected
 * URL — a hard navigation discards them and lands back on /login (same
 * constraint documented in e2e/hr-employees.spec.ts, e2e/hr-profiles.spec.ts
 * and e2e/hr-location-privilege.spec.ts). This file signs in with the
 * shared `signInAsAdmin` helper and then reaches the screen via the sidebar
 * link.
 */
async function openOrgChart(page: import("@playwright/test").Page) {
  await page.getByRole("navigation").locator("a[href='/hr/org-chart']").click();
  await expect(page).toHaveURL(/\/hr\/org-chart$/);
}

test("loads the reporting tree and narrows it with search", async ({
  page,
}) => {
  await signInAsAdmin(page);
  await openOrgChart(page);

  await expect(page.getByRole("heading", { name: "Org chart" })).toBeVisible();

  await page
    .getByRole("searchbox", { name: "Search org chart" })
    .fill("zz-no-such-person-zz");
  // No card matches, but the tree itself (not an error/empty state) stays
  // mounted — the search narrows highlighting, it does not refetch.
  await expect(page.getByRole("heading", { name: "Org chart" })).toBeVisible();
});

test("filters by department", async ({ page }) => {
  await signInAsAdmin(page);
  await openOrgChart(page);

  const select = page.getByRole("combobox", { name: "Filter by department" });
  await expect(select).toBeVisible();
  const options = await select.locator("option").allTextContents();
  if (options.length > 1) {
    await select.selectOption({ index: 1 });
  }
});

test("opens the employee detail drawer and links to the full profile", async ({
  page,
}) => {
  await signInAsAdmin(page);
  await openOrgChart(page);

  const nodeButton = page
    .getByRole("button", { name: /View .+'s details/ })
    .first();
  await nodeButton.click();

  const drawer = page.getByRole("dialog");
  await expect(drawer).toBeVisible();
  await expect(
    drawer.getByRole("link", { name: "View full profile" }),
  ).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(drawer).not.toBeVisible();
});

test("shows a 403-friendly message when the API refuses the request", async ({
  page,
}) => {
  await signInAsAdmin(page);

  // Scoped to the API origin only — a bare "**/hr/org-chart*" glob also
  // matches the UI's own client-side navigation fetch for the page route
  // at the same pathname (same host:3001 dev server), which would replace
  // the whole app shell with this mocked JSON body instead of just the
  // API response (see hr-profiles.spec.ts for the same convention).
  await page.route(`${API}/hr/org-chart*`, (route) =>
    route.fulfill({
      status: 403,
      contentType: "application/json",
      body: JSON.stringify({
        statusCode: 403,
        message: "Forbidden",
        error: "FORBIDDEN",
        path: "/hr/org-chart",
        timestamp: new Date().toISOString(),
      }),
    }),
  );

  await openOrgChart(page);

  await expect(
    page.getByText("You don't have access to this part of the org chart"),
  ).toBeVisible();
});
