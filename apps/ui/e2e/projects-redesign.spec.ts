import { expect, test, type Page } from "@playwright/test";
import { signInAsAdmin } from "./helpers/auth";

/**
 * Projects module redesign: every page shares the ui-kit PageHeader banner,
 * the project list has a Table/Board toggle driven by the URL, the project
 * detail page is split into tabs, and the Expenses table sorts. Needs
 * apps/api + apps/ui running against a seeded dev database with at least one
 * project (see playwright.config.ts). Each page must render without an
 * uncaught runtime error.
 */

function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  return errors;
}

test.describe("Projects redesign", () => {
  test.beforeEach(async ({ page }) => {
    await signInAsAdmin(page);
  });

  const pages: { path: string; heading: RegExp }[] = [
    { path: "/projects/dashboard", heading: /Projects & Task Management/ },
    { path: "/projects/list", heading: /^All Projects$/ },
    { path: "/projects/new", heading: /New Project Setup/ },
    { path: "/projects/expenses", heading: /Project Expenses/ },
    { path: "/projects/budget-utilization", heading: /Budget & Financial/ },
    { path: "/projects/analytics", heading: /Workload Analytics/ },
    { path: "/projects/resources", heading: /Resource Tracking/ },
    { path: "/projects/mom", heading: /Minutes of Meeting/ },
    { path: "/projects/proposals", heading: /Proposal Documents/ },
  ];

  for (const { path, heading } of pages) {
    test(`${path} uses the shared PageHeader banner`, async ({ page }) => {
      const errors = trackErrors(page);
      await page.goto(path);
      const h1 = page.getByRole("heading", { level: 1, name: heading });
      await expect(h1).toBeVisible({ timeout: 20_000 });
      // The ui-kit banner variant's gradient: the same on every page.
      await expect(page.locator("header", { has: h1 }).first()).toHaveClass(
        /from-\[#38bdf8\]/,
      );
      expect(errors).toEqual([]);
    });
  }

  test("new project has a single customer control with search inside the dropdown", async ({
    page,
  }) => {
    const errors = trackErrors(page);
    await page.goto("/projects/new");
    await expect(
      page.getByRole("heading", { level: 1, name: /New Project Setup/ }),
    ).toBeVisible({ timeout: 20_000 });
    // No separate search bar above the dropdown.
    await expect(page.getByLabel("Search customers")).toHaveCount(0);
    await page.getByRole("combobox", { name: "Customer / Company" }).click();
    const search = page.getByPlaceholder("Search customers by name or code");
    await expect(search).toBeVisible();
    // Typing queries the customer list (server-side) and lists the match.
    await search.fill("FCS");
    await expect(
      page.getByRole("option", { name: /FCS/ }).first(),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("new project shows a live summary and a sticky action bar", async ({
    page,
  }) => {
    const errors = trackErrors(page);
    await page.goto("/projects/new");
    await expect(
      page.getByRole("heading", { level: 1, name: /New Project Setup/ }),
    ).toBeVisible({ timeout: 20_000 });

    const summary = page.getByRole("complementary", {
      name: "Project summary",
    });
    // The code is a preview: the sequence is shown as # placeholders.
    await expect(summary).toContainText(/\/#+/);
    await expect(summary).toContainText("1 required field still missing");

    await page.getByLabel("Project Name").fill("Playwright Summary Project");
    await expect(summary).toContainText("All required fields are filled");

    // An end date before the start date is flagged inline.
    await page.getByLabel("Planned End Date").fill("2020-01-01");
    await expect(
      page.getByText("Planned end date cannot be earlier than the start date."),
    ).toBeVisible();

    // The action bar stays reachable at the top of a long form.
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(
      page.getByRole("button", { name: "Create Project" }),
    ).toBeInViewport();
    expect(errors).toEqual([]);
  });

  test("edit project shows the saved code in the summary, not a preview", async ({
    page,
  }) => {
    const errors = trackErrors(page);
    await page.goto("/projects/list");
    await page
      .getByRole("table")
      .getByRole("link")
      .first()
      .click({ timeout: 20_000 });
    await expect(page).toHaveURL(/\/projects\/\d+$/);
    await page.getByRole("link", { name: "Edit", exact: true }).click();
    await expect(page).toHaveURL(/\/projects\/edit\/\d+$/);

    const summary = page.getByRole("complementary", {
      name: "Project summary",
    });
    await expect(summary).toBeVisible({ timeout: 20_000 });
    await expect(summary).toContainText(
      "Assigned when the project was created.",
    );
    await expect(summary).not.toContainText("#");
    await expect(
      page.getByRole("button", { name: "Update Project" }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("project list toggles between table and board via the URL", async ({
    page,
  }) => {
    const errors = trackErrors(page);
    await page.goto("/projects/list");
    await expect(
      page.getByRole("heading", { level: 1, name: "All Projects" }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("table")).toBeVisible({ timeout: 20_000 });

    await page
      .getByRole("group", { name: "Project view" })
      .getByRole("button", { name: "Board" })
      .click();
    await expect(page).toHaveURL(/view=board/);
    await expect(
      page.getByRole("region", { name: "Active projects" }),
    ).toBeVisible();
    await expect(page.getByRole("table")).toHaveCount(0);

    await page
      .getByRole("group", { name: "Project view" })
      .getByRole("button", { name: "Table" })
      .click();
    await expect(page).not.toHaveURL(/view=board/);
    await expect(page.getByRole("table")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("project detail is split into Overview, Milestones & Tasks and Meetings tabs", async ({
    page,
  }) => {
    const errors = trackErrors(page);
    await page.goto("/projects/list");
    // Client-side navigation: the access token lives in memory.
    await page
      .getByRole("table")
      .getByRole("link")
      .first()
      .click({ timeout: 20_000 });
    await expect(page).toHaveURL(/\/projects\/\d+$/);

    const tablist = page.getByRole("tablist", { name: "Project sections" });
    await expect(tablist).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Milestone Progress")).toBeVisible();

    await tablist.getByRole("tab", { name: /Milestones & Tasks/ }).click();
    await expect(
      page.getByRole("heading", { name: /Milestones & Nested Deliverables/ }),
    ).toBeVisible();
    // The overview content is not rendered on this tab.
    await expect(page.getByText("Milestone Progress")).toHaveCount(0);

    await tablist.getByRole("tab", { name: "Meetings" }).click();
    await expect(
      page.getByRole("heading", { name: /Milestones & Nested Deliverables/ }),
    ).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("expenses table sorts by amount", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/projects/expenses");
    await expect(
      page.getByRole("heading", { level: 1, name: "Project Expenses" }),
    ).toBeVisible({ timeout: 20_000 });
    const amountHeader = page.getByRole("columnheader", { name: /Amount/ });
    await expect(amountHeader).toBeVisible({ timeout: 20_000 });
    await amountHeader.getByRole("button").click();
    await expect(amountHeader).toHaveAttribute(
      "aria-sort",
      /ascending|descending/,
    );
    expect(errors).toEqual([]);
  });

  test("dashboard shows the attention and task panels", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/projects/dashboard");
    await expect(
      page.getByRole("heading", { name: "Needs attention" }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByRole("heading", { name: "My open tasks" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Portfolio by status" }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });
});
