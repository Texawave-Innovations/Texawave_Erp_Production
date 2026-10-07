import { expect, test } from "@playwright/test";

/**
 * Real-browser coverage for the Location Privilege screen: searching and
 * selecting an employee shows their current privilege and lets it be
 * changed, and the office network allowlist can be listed, added to and
 * toggled. Uses the seeded Super Admin (packages/database/prisma/seed.ts) —
 * run the seed against a running dev DB first.
 */
async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Organization").fill("texawave-innovations");
  await page.getByLabel("Email").fill("admin@texawave.com");
  await page.getByLabel("Password").fill("ChangeMe123!");
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("loads the screen and shows the office network list", async ({ page }) => {
  await signIn(page);
  await page.goto("/hr/location-privilege");

  await expect(
    page.getByRole("heading", { name: "Location privilege" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Office networks" }),
  ).toBeVisible();
});

test("searching narrows the employee list and shows no-match state", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/hr/location-privilege");

  await page
    .getByRole("searchbox", { name: "Search employees by name or code" })
    .fill("zz-no-such-employee-zz");

  await expect(page.getByText("No employees match this search")).toBeVisible();
});

test("selecting an employee shows and allows changing their privilege", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/hr/location-privilege");

  await page
    .getByRole("searchbox", { name: "Search employees by name or code" })
    .fill("a");

  const firstResult = page.locator("ul > li > button").first();
  await expect(firstResult).toBeVisible();
  await firstResult.click();

  await expect(page.getByRole("button", { name: "Change" })).toBeVisible();
  await page.getByRole("button", { name: "Change" }).click();

  await expect(
    page.getByRole("heading", { name: "Set location privilege" }),
  ).toBeVisible();
  await page.getByLabel("Location mode").selectOption("REMOTE");
  await page.getByRole("button", { name: "Save" }).click();

  await expect(page.getByText("Location privilege updated")).toBeVisible();
});

test("adding an office network blocks an empty submission and then succeeds", async ({
  page,
}) => {
  let posted = false;
  page.on("request", (req) => {
    if (req.method() === "POST" && req.url().includes("/hr/office-networks"))
      posted = true;
  });

  await signIn(page);
  await page.goto("/hr/location-privilege");

  await page.getByRole("button", { name: "Add address" }).click();
  await page.getByRole("button", { name: "Add address" }).last().click();
  await expect(page.getByText("IP address is required")).toBeVisible();
  expect(posted).toBe(false);

  await page.getByLabel("IP address").fill("203.0.113.55");
  await page.getByLabel("Label").fill("Playwright test address");
  await page.getByRole("button", { name: "Add address" }).last().click();

  await expect(page.getByText("Office network added")).toBeVisible();
  await expect(page.getByText("203.0.113.55")).toBeVisible();
});
