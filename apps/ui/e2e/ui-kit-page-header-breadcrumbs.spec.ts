import { expect, test } from "@playwright/test";
import { signInAsAdmin } from "./helpers/auth";

/**
 * Focused tests for Phase 4 promoted UI-Kit components:
 * 1. PageHeader (neutral variant): title, subtitle, breadcrumbs, action button
 * 2. Breadcrumbs: semantic nav, aria-current="page", ancestor vs current items, accessible separators
 * 3. PageHeader (banner variant): gradient banner, white icon container, badge, action integration
 */

test.describe("Global UI Kit Phase 4 — PageHeader & Breadcrumbs", () => {
  test("PageHeader (neutral) renders semantic heading, subtitle, actions, and integrated Breadcrumbs", async ({
    page,
  }) => {
    await signInAsAdmin(page);

    // Navigate to /admin/users which consumes PageHeader (neutral)
    await page.locator("a[href='/admin/users']").first().click();
    await expect(page).toHaveURL(/\/admin\/users$/);

    // 1. Semantic heading and subtitle
    const heading = page.getByRole("heading", { name: "Users", level: 1 });
    await expect(heading).toBeVisible();
    await expect(
      page.getByText("Manage user accounts, roles and team access."),
    ).toBeVisible();

    // 2. Breadcrumbs hierarchy
    const breadcrumbNav = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(breadcrumbNav).toBeVisible();

    // Verify breadcrumb items
    const breadcrumbList = breadcrumbNav.locator("ol");
    await expect(breadcrumbList).toBeVisible();
    await expect(breadcrumbList.getByText("HR")).toBeVisible();
    await expect(breadcrumbList.getByText("People")).toBeVisible();

    // Verify current page has aria-current="page" and is not a navigable link
    const currentCrumb = breadcrumbList.locator("[aria-current='page']");
    await expect(currentCrumb).toBeVisible();
    await expect(currentCrumb).toHaveText("Users");
    await expect(currentCrumb).not.toHaveAttribute("href");

    // 3. Primary action button is functional
    const newUserButton = page.getByRole("button", { name: "New user" });
    await expect(newUserButton).toBeVisible();
    await newUserButton.click();

    // Modal opens upon action click
    const dialog = page.locator("dialog[open]");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("heading", { name: "New user" }),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).not.toBeVisible();
  });

  test("Breadcrumbs renders semantic nav, handles current page, and supports action trigger in Roles", async ({
    page,
  }) => {
    await signInAsAdmin(page);

    // Switch to Settings -> Roles
    await page.locator("a[href='/admin/users']").first().click();
    await expect(page).toHaveURL(/\/admin\/users$/);
    await page.locator("a[href='/admin/roles']").first().click();
    await expect(page).toHaveURL(/\/admin\/roles$/);

    // 1. Breadcrumbs
    const breadcrumbs = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(breadcrumbs).toBeVisible();
    await expect(breadcrumbs.getByText("HR")).toBeVisible();
    await expect(breadcrumbs.getByText("People")).toBeVisible();

    const currentItem = breadcrumbs.locator("[aria-current='page']");
    await expect(currentItem).toBeVisible();
    await expect(currentItem).toHaveText("Roles & Permissions");

    // 2. PageHeader heading & subtitle
    await expect(
      page.getByRole("heading", { name: "Roles & Permissions", level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Manage what each role can access across your organization.",
      ),
    ).toBeVisible();

    // 3. Action button is functional
    const createRoleButton = page.getByRole("button", { name: "Create Role" });
    await expect(createRoleButton).toBeVisible();
    await createRoleButton.click();

    const dialog = page.locator("dialog[open]");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("heading", { name: "Create New Role" }),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).not.toBeVisible();
  });

  test("PageHeader (banner) renders full-width gradient banner, icon, and contextual primary action", async ({
    page,
  }) => {
    await signInAsAdmin(page);

    // Navigate to /hr/employees which consumes HrPageHeader (wrapping PageHeader variant="banner")
    await page.locator("a[href='/hr/employees']").first().click();
    await expect(page).toHaveURL(/\/hr\/employees$/);

    // 1. Banner header container
    const header = page.locator("header").filter({ hasText: "Employees" });
    await expect(header).toBeVisible();
    await expect(header).toHaveClass(/bg-linear-135/);

    // 2. Title and description
    const heading = header.getByRole("heading", {
      name: "Employees",
      level: 1,
    });
    await expect(heading).toBeVisible();
    await expect(
      header.getByText("Manage your organization's workforce efficiently"),
    ).toBeVisible();

    // 3. White rounded icon box
    const iconContainer = header.locator(".bg-white.text-brand-600");
    await expect(iconContainer).toBeVisible();

    // 4. Contextual action button
    const addEmployeeBtn = header.getByRole("button", { name: "Add Employee" });
    await expect(addEmployeeBtn).toBeVisible();
  });
});
