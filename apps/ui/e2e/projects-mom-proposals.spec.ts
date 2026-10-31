import { expect, test, type Page } from "@playwright/test";
import { signInAsAdmin } from "./helpers/auth";

/**
 * Projects module parity pages (MoM, Proposals, Resources/Analytics, My Work).
 * Needs apps/api + apps/ui running against a seeded dev database with at
 * least one project (see playwright.config.ts). Every page must render
 * without an uncaught runtime error.
 */

function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  return errors;
}

test.describe("Projects parity pages", () => {
  test.beforeEach(async ({ page }) => {
    await signInAsAdmin(page);
  });

  const pages: { path: string; heading: RegExp }[] = [
    { path: "/projects/mom", heading: /Minutes of Meeting/ },
    { path: "/projects/mom/templates", heading: /Meeting Minutes Templates/ },
    { path: "/projects/proposals", heading: /Proposal Documents/ },
    { path: "/projects/proposals/templates", heading: /Proposal Templates/ },
    { path: "/projects/proposals/create", heading: /Create Client Proposal/ },
    { path: "/projects/resources", heading: /Resource Tracking/ },
    { path: "/projects/analytics", heading: /Workload Analytics/ },
    { path: "/projects/my-work", heading: /Work/ },
  ];

  for (const { path, heading } of pages) {
    test(`renders ${path}`, async ({ page }) => {
      const errors = trackErrors(page);
      await page.goto(path);
      await expect(
        page.getByRole("heading", { name: heading }).first(),
      ).toBeVisible({
        timeout: 20_000,
      });
      expect(errors).toEqual([]);
    });
  }

  test("creates a draft MoM, then previews it", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/projects/mom/create");
    const title = `PW Review ${Date.now()}`;
    await page.getByLabel("Meeting title").fill(title);
    const project = page.getByLabel("Linked Project");
    await expect(project.locator("option").nth(1)).toBeAttached({
      timeout: 20_000,
    });
    const firstValue = await project
      .locator("option")
      .nth(1)
      .getAttribute("value");
    await project.selectOption(firstValue ?? "");
    await page.getByRole("button", { name: "Save Draft" }).click();
    await expect(page).toHaveURL(/\/projects\/mom\/\d+\/edit/, {
      timeout: 20_000,
    });
    await page.getByRole("button", { name: /Preview & PDF/ }).click();
    await expect(
      page.getByRole("dialog").getByText(title).first(),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("creates a proposal and opens its editor", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/projects/proposals/create");
    const title = `PW Proposal ${Date.now()}`;
    await page.getByLabel("Proposal Title").fill(title);
    await page.getByLabel("Client Name").fill("Playwright Client");
    await page.getByRole("button", { name: "Create & Open Editor" }).click();
    await expect(page).toHaveURL(/\/projects\/proposals\/\d+$/, {
      timeout: 20_000,
    });
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await expect(page.getByText("Workflow & Audit History")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("finalizing an incomplete MoM shows the missing items", async ({
    page,
  }) => {
    await page.goto("/projects/mom/create");
    await page.getByLabel("Meeting title").fill(`PW Incomplete ${Date.now()}`);
    // No project selected -> client-side validation lists the problem.
    await page.getByRole("button", { name: "Finalize MoM" }).click();
    await expect(
      page.getByText("Select the project this meeting belongs to."),
    ).toBeVisible();
  });

  test("views a proposal template without runtime crash or key errors", async ({
    page,
  }) => {
    const errors = trackErrors(page);
    await page.goto("/projects/proposals/templates");
    await expect(
      page.getByRole("heading", { name: /Proposal Templates/ }).first(),
    ).toBeVisible({ timeout: 20_000 });

    await page.goto("/projects/proposals/templates/1/builder");
    await expect(page.getByText("Executive Summary").first()).toBeVisible({
      timeout: 20_000,
    });
    expect(errors).toEqual([]);
  });
});
