import { expect, test } from "@playwright/test";

/**
 * Real-browser coverage for the HR employee screens: the directory loads from
 * the API, search narrows the list, a missing record shows the not-found
 * state, and the create form blocks an invalid submission before any request.
 * Uses the seeded Super Admin (packages/database/prisma/seed.ts) — run the
 * seed against a running dev DB first.
 */
async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Organization").fill("texawave-innovations");
  await page.getByLabel("Email").fill("admin@texawave.com");
  await page.getByLabel("Password").fill("ChangeMe123!");
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("lists employees and narrows them with search", async ({ page }) => {
  await signIn(page);
  await page.goto("/hr/employees");

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

test("shows a not-found state for an employee that does not exist", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/hr/employees/999999999");

  await expect(page.getByText("Employee not found")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Back to employees" }),
  ).toBeVisible();
});

test("blocks an empty create submission before calling the API", async ({
  page,
}) => {
  let posted = false;
  page.on("request", (req) => {
    if (req.method() === "POST" && req.url().includes("/hr/employees"))
      posted = true;
  });

  await signIn(page);
  await page.goto("/hr/employees/new");
  await page.getByRole("button", { name: "Create employee" }).click();

  await expect(page.getByText("Full name is required")).toBeVisible();
  await expect(page.getByText("Date of joining is required")).toBeVisible();
  expect(posted).toBe(false);
});
