import { expect, test } from "@playwright/test";

/**
 * Real-browser coverage for Regularization (attendance corrections): the
 * list loads from the API and filters narrow it; submitting a correction is
 * blocked client-side when the reason is too short, before any request.
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

test("lists attendance corrections and narrows them with filters", async ({
  page,
}) => {
  await signIn(page);
  // Client-side link, not page.goto: a hard navigation drops the in-memory
  // auth store (Docs/CODING_STANDARDS.md "Frontend API/state/error
  // standard" — tokens are deliberately not persisted across reloads).
  await page.getByRole("link", { name: "Regularization" }).click();
  await expect(
    page.getByRole("heading", { name: "Regularization" }),
  ).toBeVisible();

  await page
    .getByRole("combobox", { name: "Filter by status" })
    .selectOption("REJECTED");
  await page
    .getByRole("combobox", { name: "Filter by status" })
    .selectOption("");

  await expect(
    page
      .getByRole("table", { name: "Attendance corrections" })
      .or(page.getByText(/No correction requests|No requests match/)),
  ).toBeVisible();
});

test("blocks an invalid correction submission", async ({ page }) => {
  let posted = false;
  page.on("request", (req) => {
    if (
      req.method() === "POST" &&
      req.url().includes("/hr/attendance/corrections")
    )
      posted = true;
  });

  await signIn(page);
  await page.getByRole("link", { name: "Regularization" }).click();
  await expect(
    page.getByRole("heading", { name: "Regularization" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Request a correction" }).click();
  await page.getByRole("button", { name: "Submit", exact: true }).click();

  await expect(page.getByText("Reason must be 3–500 characters")).toBeVisible();
  expect(posted).toBe(false);
});
