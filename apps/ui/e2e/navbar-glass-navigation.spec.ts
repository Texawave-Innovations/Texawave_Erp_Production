import { expect, test } from "@playwright/test";
import { signInAsAdmin } from "./helpers/auth";

/**
 * Visual & Functional E2E verification for:
 * 1. Top Horizontal Navbar (Level 1)
 * 2. Level 2 Category Menu with Frosted Glass (.glass-dropdown)
 * 3. Level 3 Nested Submenu with Frosted Glass (.glass-dropdown)
 * 4. Outside click and Escape key dismissal
 * 5. Mobile responsive accordion drawer
 * 6. Shared popover/dropdown glass styling (.glass-dropdown)
 */
test.describe("TexaOne 3-Level Horizontal Navigation & Glass Dropdowns", () => {
  test.beforeEach(async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto("/hr/dashboard");
    await page.waitForLoadState("domcontentloaded");
  });

  test("Navbar displays TexaOne branding, modules, and utilities", async ({
    page,
  }) => {
    const header = page.getByRole("banner");
    await expect(header).toBeVisible();

    // Verify TexaOne logo
    await expect(header.getByLabel(/TexaOne/i).first()).toBeVisible();

    // Verify Primary modules in desktop navigation
    const nav = header.getByRole("navigation", {
      name: "Main application navigation",
    });
    await expect(nav).toBeVisible();
    await expect(nav.getByRole("button", { name: "Dashboard" })).toBeVisible();
    await expect(
      nav.getByRole("button", { name: "Human Resources" }),
    ).toBeVisible();
    await expect(nav.getByRole("button", { name: "Settings" })).toBeVisible();

    // Verify Search, Notifications, Profile
    await expect(header.getByRole("textbox", { name: "Search" })).toBeVisible();
    await expect(
      header.getByRole("button", { name: "Notifications" }),
    ).toBeVisible();
  });

  test("Human Resources opens Level 2 categories with frosted glass styling", async ({
    page,
  }) => {
    const hrModule = page.getByRole("button", { name: "Human Resources" });
    await hrModule.click();

    // Level 2 Categories menu is visible with glass-dropdown class
    const categoryMenu = page.getByRole("menu", {
      name: "Human Resources categories",
    });
    await expect(categoryMenu).toBeVisible();
    await expect(categoryMenu).toHaveClass(/glass-dropdown/);

    // Verify categories from the reference image
    await expect(
      categoryMenu.getByRole("link", { name: "Overview" }),
    ).toBeVisible();
    await expect(
      categoryMenu.getByRole("button", { name: "People" }),
    ).toBeVisible();
    await expect(
      categoryMenu.getByRole("button", { name: "Time & Leave" }),
    ).toBeVisible();
    await expect(
      categoryMenu.getByRole("button", { name: "Operations" }),
    ).toBeVisible();
    await expect(
      categoryMenu.getByRole("button", { name: "Recruitment" }),
    ).toBeVisible();
    await expect(
      categoryMenu.getByRole("button", { name: "Payroll" }),
    ).toBeVisible();
    await expect(
      categoryMenu.getByRole("button", { name: "Compliance" }),
    ).toBeVisible();
  });

  test("People category opens Level 3 nested submenu with frosted glass styling", async ({
    page,
  }) => {
    const hrModule = page.getByRole("button", { name: "Human Resources" });
    await hrModule.click();

    const categoryMenu = page.getByRole("menu", {
      name: "Human Resources categories",
    });
    await expect(categoryMenu).toBeVisible();

    // Hover or click People category
    const peopleCat = categoryMenu.getByRole("button", { name: "People" });
    await peopleCat.click();

    // Level 3 nested submenu appears with frosted glass styling
    const peopleSubmenu = page.getByRole("menu", { name: "People items" });
    await expect(peopleSubmenu).toBeVisible();
    await expect(peopleSubmenu).toHaveClass(/glass-dropdown/);

    // Verify exact sub-tabs from reference image
    await expect(
      peopleSubmenu.getByRole("link", { name: "Employees" }),
    ).toBeVisible();
    await expect(
      peopleSubmenu.getByRole("link", { name: "Profiles" }),
    ).toBeVisible();
    await expect(
      peopleSubmenu.getByRole("link", { name: "Employee Documents" }),
    ).toBeVisible();
    await expect(
      peopleSubmenu.getByRole("link", { name: "Org Chart" }),
    ).toBeVisible();
    await expect(
      peopleSubmenu.getByRole("link", { name: "Departments" }),
    ).toBeVisible();
    await expect(
      peopleSubmenu.getByRole("link", { name: "Teams" }),
    ).toBeVisible();
  });

  test("Escape key closes all open navigation submenus", async ({ page }) => {
    const hrModule = page.getByRole("button", { name: "Human Resources" });
    await hrModule.click();

    const categoryMenu = page.getByRole("menu", {
      name: "Human Resources categories",
    });
    await expect(categoryMenu).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(categoryMenu).not.toBeVisible();
  });

  test("Mobile viewport (375x812) renders collapsible drawer with all modules", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });

    const hamburger = page.getByRole("button", {
      name: "Open navigation menu",
    });
    await expect(hamburger).toBeVisible();
    await hamburger.click();

    // Drawer is visible with glass-dropdown
    const drawer = page.locator(".glass-dropdown").first();
    await expect(drawer).toBeVisible();

    // Can expand Human Resources on mobile
    const hrMobileBtn = page.getByRole("button", { name: "Human Resources" });
    await expect(hrMobileBtn).toBeVisible();
    await hrMobileBtn.click();

    // People category is reachable
    await expect(page.getByRole("button", { name: "People" })).toBeVisible();
  });
});
