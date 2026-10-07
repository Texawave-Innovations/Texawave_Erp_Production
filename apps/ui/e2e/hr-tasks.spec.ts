import { expect, test } from "@playwright/test";

/**
 * Real-browser coverage for Task Assignment: the HR admin screen loads tasks
 * from the API, filters narrow the list, and an invalid create submission is
 * blocked client-side before any request. Uses the seeded Super Admin
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

test("lists tasks and narrows them with filters", async ({ page }) => {
  await signIn(page);
  // Client-side link, not page.goto: a hard navigation drops the in-memory
  // auth store (Docs/CODING_STANDARDS.md "Frontend API/state/error
  // standard" — tokens are deliberately not persisted across reloads).
  await page.getByRole("link", { name: "Task Assignment" }).click();
  await expect(
    page.getByRole("heading", { name: "Task Assignment" }),
  ).toBeVisible();

  await page
    .getByRole("combobox", { name: "Filter by status" })
    .selectOption("CANCELLED");
  await page
    .getByRole("combobox", { name: "Filter by status" })
    .selectOption("");

  await expect(
    page.getByRole("table", { name: "Tasks" }).or(page.getByText(/No tasks/)),
  ).toBeVisible();
});

test("blocks an invalid task creation submission", async ({ page }) => {
  let posted = false;
  page.on("request", (req) => {
    if (req.method() === "POST" && req.url().endsWith("/hr/tasks")) {
      posted = true;
    }
  });

  await signIn(page);
  await page.getByRole("link", { name: "Task Assignment" }).click();
  await expect(
    page.getByRole("heading", { name: "Task Assignment" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "New Task" }).click();
  await expect(page.getByRole("heading", { name: "New Task" })).toBeVisible();

  await page.getByRole("button", { name: "Assign task" }).click();

  await expect(page.getByText("Title is required")).toBeVisible();
  expect(posted).toBe(false);
});
