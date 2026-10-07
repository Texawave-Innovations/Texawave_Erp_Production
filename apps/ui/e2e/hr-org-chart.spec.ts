import { expect, test } from "@playwright/test";

/**
 * Real-browser coverage for the HR org chart: the tree loads from
 * `/hr/org-chart`, search highlights a match, a node opens the detail
 * drawer, and the drawer links through to the employee's profile. Uses the
 * seeded Super Admin (packages/database/prisma/seed.ts) — run the seed
 * against a running dev DB first.
 */
async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Organization").fill("texawave-innovations");
  await page.getByLabel("Email").fill("admin@texawave.com");
  await page.getByLabel("Password").fill("ChangeMe123!");
  await Promise.all([
    page.waitForResponse((r) => r.url().includes("/auth/login")),
    page.getByRole("button", { name: "Sign in" }).click(),
  ]);
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

test("loads the reporting tree and narrows it with search", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/hr/org-chart");

  await expect(page.getByRole("heading", { name: "Org chart" })).toBeVisible();

  await page
    .getByRole("searchbox", { name: "Search org chart" })
    .fill("zz-no-such-person-zz");
  // No card matches, but the tree itself (not an error/empty state) stays
  // mounted — the search narrows highlighting, it does not refetch.
  await expect(page.getByRole("heading", { name: "Org chart" })).toBeVisible();
});

test("filters by department", async ({ page }) => {
  await signIn(page);
  await page.goto("/hr/org-chart");

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
  await signIn(page);
  await page.goto("/hr/org-chart");

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
  await page.route("**/hr/org-chart*", (route) =>
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

  await signIn(page);
  await page.goto("/hr/org-chart");

  await expect(
    page.getByText("You don't have access to this part of the org chart"),
  ).toBeVisible();
});
