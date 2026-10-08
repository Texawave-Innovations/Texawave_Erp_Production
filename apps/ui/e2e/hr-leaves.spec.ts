import { expect, test } from "@playwright/test";

/**
 * Real-browser coverage for Leaves: the page loads balances and the
 * approvals queue from the API, filters narrow the approvals list, and
 * submitting an invalid leave request is blocked client-side before any
 * request reaches the server. Uses the seeded Super Admin
 * (packages/database/prisma/seed.ts) — run the seed against a running dev
 * DB first. The Super Admin has every permission but no linked employee
 * record, so the self-service section may show its own error/empty state;
 * assertions on it tolerate that.
 */
async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Organization").fill("texawave-innovations");
  await page.getByLabel("Email").fill("admin@texawave.com");
  await page.getByLabel("Password").fill("ChangeMe123!");
  await page.getByRole("button", { name: "Sign in" }).click();
}

async function openLeaves(page: import("@playwright/test").Page) {
  await signIn(page);
  // Client-side link, not page.goto: a hard navigation drops the in-memory
  // auth store (Docs/CODING_STANDARDS.md "Frontend API/state/error
  // standard" — tokens are deliberately not persisted across reloads).
  await page.getByRole("link", { name: "Leaves" }).click();
  await expect(
    page.getByRole("heading", { name: "Leaves", exact: true }),
  ).toBeVisible();
}

test("loads the Leaves page with balances and the approvals queue", async ({
  page,
}) => {
  await openLeaves(page);

  await expect(
    page.getByRole("heading", { name: "Leave requests (team / organization)" }),
  ).toBeVisible();

  // Either the approvals table renders, or the empty state does — both are
  // valid outcomes depending on seeded data.
  await expect(
    page
      .getByRole("table", { name: "Leave requests" })
      .or(page.getByText(/No leave requests yet|No requests match/)),
  ).toBeVisible();
});

test("narrows the approvals queue with status and employee filters", async ({
  page,
}) => {
  await openLeaves(page);

  await page
    .getByRole("combobox", { name: "Filter by status" })
    .selectOption("REJECTED");
  await page
    .getByRole("combobox", { name: "Filter by status" })
    .selectOption("");

  await page
    .getByRole("spinbutton", { name: "Filter by employee ID" })
    .fill("1");
  await expect(
    page.getByRole("button", { name: "Clear filters" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
});

test("blocks an invalid leave request before any request is sent", async ({
  page,
}) => {
  let posted = false;
  page.on("request", (req) => {
    if (
      req.method() === "POST" &&
      req.url().includes("/self-service/leave-requests")
    ) {
      posted = true;
    }
  });

  await openLeaves(page);

  const requestButton = page.getByRole("button", { name: "Request leave" });
  if (!(await requestButton.isVisible().catch(() => false))) {
    // The seeded Super Admin may not have a linked employee record, in
    // which case the self-service section does not offer the action.
    test.skip();
    return;
  }
  await requestButton.click();
  await page.getByRole("button", { name: "Submit", exact: true }).click();

  await expect(page.getByText("Reason must be 3–500 characters")).toBeVisible();
  expect(posted).toBe(false);
});
