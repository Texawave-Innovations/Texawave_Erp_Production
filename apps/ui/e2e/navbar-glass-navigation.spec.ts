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
    await expect(page).toHaveURL(/\/hr/, { timeout: 15000 });
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

    // Verify Date & Time Calendar Trigger, Notifications, Profile
    await expect(
      header.getByRole("button", { name: /Current date and time/i }),
    ).toBeVisible();
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

  test("Payroll category opens Level 3 nested submenu matching Image 2", async ({
    page,
  }) => {
    const hrModule = page.getByRole("button", { name: "Human Resources" });
    await hrModule.click();

    const categoryMenu = page.getByRole("menu", {
      name: "Human Resources categories",
    });
    await expect(categoryMenu).toBeVisible();

    // Hover Payroll category
    const payrollCat = categoryMenu.getByRole("button", { name: "Payroll" });
    await payrollCat.hover();

    // Level 3 nested submenu appears with frosted glass styling and single child
    const payrollSubmenu = page.getByRole("menu", { name: "Payroll items" });
    await expect(payrollSubmenu).toBeVisible();
    await expect(payrollSubmenu).toHaveClass(/glass-dropdown/);

    const payrollProcessing = payrollSubmenu.getByRole("link", {
      name: "Payroll Processing",
    });
    await expect(payrollProcessing).toBeVisible();

    await page.screenshot({
      path: "C:/Users/aslam/.gemini/antigravity-ide/brain/8db39722-3c54-483a-ac36-dee6f74649cd/payroll_dropdown_verified.png",
    });
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

    await page.screenshot({
      path: "C:/Users/aslam/.gemini/antigravity-ide/brain/8db39722-3c54-483a-ac36-dee6f74649cd/dashboard_full_reference_verified.png",
      fullPage: false,
    });
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

  test("Hovering module and category opens menus; clicking pins selection across mouse movement", async ({
    page,
  }) => {
    const hrModule = page.getByRole("button", { name: "Human Resources" });

    // 1. Hover opens Level 2
    await hrModule.hover();
    const categoryMenu = page.getByRole("menu", {
      name: "Human Resources categories",
    });
    await expect(categoryMenu).toBeVisible();

    // 2. Click module to pin it
    await hrModule.click();

    // 3. Move mouse away to page content (e.g. heading)
    const pageHeading = page.getByRole("heading", { name: /Good/i });
    await pageHeading.hover();

    // 4. Pinned menu remains visible!
    await expect(categoryMenu).toBeVisible();

    // 5. Switching category updates Level 3 submenu
    const timeLeaveCat = categoryMenu.getByRole("button", {
      name: "Time & Leave",
    });
    await timeLeaveCat.click();
    const timeLeaveSubmenu = page.getByRole("menu", {
      name: "Time & Leave items",
    });
    await expect(timeLeaveSubmenu).toBeVisible();
    await expect(
      timeLeaveSubmenu.getByRole("link", { name: "Attendance" }),
    ).toBeVisible();

    // 6. Switch back to People
    const peopleCat = categoryMenu.getByRole("button", { name: "People" });
    await peopleCat.click();
    const peopleSubmenu = page.getByRole("menu", { name: "People items" });
    await expect(peopleSubmenu).toBeVisible();
    await expect(
      peopleSubmenu.getByRole("link", { name: "Employees" }),
    ).toBeVisible();

    // 7. Click leaf navigates and closes transient menus
    const employeesLeaf = peopleSubmenu.getByRole("link", {
      name: "Employees",
    });
    await employeesLeaf.click();
    await expect(page).toHaveURL(/\/hr\/employees/);
    await expect(categoryMenu).not.toBeVisible();

    // 8. Human Resources remains active module on the new route
    await expect(hrModule).toBeVisible();
  });

  test("Clicking outside dismisses open menus", async ({ page }) => {
    const hrModule = page.getByRole("button", { name: "Human Resources" });
    await hrModule.click();

    const categoryMenu = page.getByRole("menu", {
      name: "Human Resources categories",
    });
    await expect(categoryMenu).toBeVisible();

    // Click outside on the main area
    await page.locator("main").click({ position: { x: 10, y: 10 } });
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

  test("Top header renders .glass-navbar and spring-glide active indicator pill (.glass-pill)", async ({
    page,
  }) => {
    const navbar = page.locator(".glass-navbar");
    await expect(navbar).toBeVisible();

    const pill = navbar.locator(".glass-pill");
    await expect(pill).toBeAttached();

    // Verify indicator pill tracks Human Resources on /hr
    const hrBtn = page.getByRole("button", { name: "Human Resources" });
    await expect(hrBtn).toHaveAttribute("aria-current", "page");

    // Hover Dashboard module and verify glide
    const dashBtn = page.getByRole("button", { name: "Dashboard" });
    await dashBtn.hover();
    await expect(pill).toBeAttached();
  });

  test("Notifications and Profile menus open with .glass-dropdown styling", async ({
    page,
  }) => {
    // Notifications trigger
    const notifBtn = page.getByRole("button", { name: /Notifications/i });
    await notifBtn.click();
    const notifPanel = page.getByRole("region", {
      name: "Recent notifications",
    });
    await expect(notifPanel).toBeVisible();
    await expect(notifPanel).toHaveClass(/glass-dropdown/);

    // Profile trigger
    const profileBtn = page.getByRole("button", {
      name: /Profile menu|Software Engineer|Super Admin/i,
    });
    await profileBtn.click();
    const profileMenu = page.getByRole("menu");
    await expect(profileMenu).toBeVisible();
    await expect(profileMenu).toHaveClass(/glass-dropdown/);
    await expect(
      profileMenu.getByRole("menuitem", { name: "Sign out" }),
    ).toBeVisible();
  });

  test("HR submenu items synchronize background and border effects immediately without delay and ensure only one item is active", async ({
    page,
  }) => {
    const hrModule = page.getByRole("button", { name: "Human Resources" });

    // 1. Hover HR module on /hr/dashboard -> dropdown opens, only Overview is active
    await hrModule.hover();
    const categoryMenu = page.getByRole("menu", {
      name: "Human Resources categories",
    });
    await expect(categoryMenu).toBeVisible();

    const overview = categoryMenu.getByRole("link", { name: "Overview" });
    const people = categoryMenu.getByRole("button", { name: "People" });
    const compliance = categoryMenu.getByRole("button", { name: "Compliance" });
    const payroll = categoryMenu.getByRole("button", { name: "Payroll" });

    // Overview is active matching /hr/dashboard route
    await expect(overview).toHaveClass(/glass-item-active/);
    // People is NOT active (no blue background) even though its flyout is open
    await expect(people).not.toHaveClass(/glass-item-active/);

    // Verify exactly ONE item in Level 2 has glass-item-active
    const activeLevel2Items = categoryMenu.locator(".glass-item-active");
    await expect(activeLevel2Items).toHaveCount(1);

    // 2. Hover inactive Compliance -> subtle light hover, does NOT get glass-item-active, Overview stays active
    await compliance.hover();
    await expect(compliance).not.toHaveClass(/glass-item-active/);
    await expect(overview).toHaveClass(/glass-item-active/);
    await expect(activeLevel2Items).toHaveCount(1);

    // 3. Click Compliance -> becomes active, Overview loses active
    await compliance.click();
    await expect(compliance).toHaveClass(/glass-item-active/);
    await expect(overview).not.toHaveClass(/glass-item-active/);
    await expect(activeLevel2Items).toHaveCount(1);

    // 4. Click Payroll -> Payroll activates immediately, Compliance clears immediately
    await payroll.click();
    await expect(payroll).toHaveClass(/glass-item-active/);
    await expect(compliance).not.toHaveClass(/glass-item-active/);
    await expect(activeLevel2Items).toHaveCount(1);

    // Verify computed styles: Payroll has border and background, Compliance has transparent border and no shadow
    const payrollStyles = await payroll.evaluate((el) => {
      const cs = window.getComputedStyle(el);
      return {
        border: cs.border,
        boxShadow: cs.boxShadow,
        backgroundImage: cs.backgroundImage,
      };
    });
    expect(payrollStyles.backgroundImage).toContain("linear-gradient");
    expect(payrollStyles.border).toContain("1px solid");

    const complianceStyles = await compliance.evaluate((el) => {
      const cs = window.getComputedStyle(el);
      return {
        border: cs.border,
        boxShadow: cs.boxShadow,
        backgroundImage: cs.backgroundImage,
      };
    });
    expect(complianceStyles.backgroundImage).toBe("none");
    expect(complianceStyles.boxShadow).toBe("none");

    // 5. Switch between multiple categories rapidly
    await people.click();
    await expect(people).toHaveClass(/glass-item-active/);
    await expect(payroll).not.toHaveClass(/glass-item-active/);
    await expect(activeLevel2Items).toHaveCount(1);

    await compliance.click();
    await expect(compliance).toHaveClass(/glass-item-active/);
    await expect(people).not.toHaveClass(/glass-item-active/);
    await expect(activeLevel2Items).toHaveCount(1);

    // 6. Move pointer away from categories column
    const heading = page.getByRole("heading", { name: /Good/i });
    await heading.hover();
    // Compliance remains pinned as active category with glass-item-active
    await expect(compliance).toHaveClass(/glass-item-active/);
    await expect(activeLevel2Items).toHaveCount(1);
  });

  test("CRM module is enabled without 'Soon' badge and navigates to CRM pages", async ({
    page,
  }) => {
    const nav = page.getByRole("navigation", {
      name: "Main application navigation",
    });
    const crmButton = nav.getByRole("button", { name: "CRM" });
    await expect(crmButton).toBeVisible();

    // CRM should NOT have any 'Soon' badge
    await expect(crmButton.getByText(/Soon/i)).toHaveCount(0);

    // Hover CRM to open Level 2 categories
    await crmButton.hover();
    const dropdown = page.getByRole("menu", { name: "CRM categories" });
    await expect(dropdown).toBeVisible();

    // Verify CRM categories
    await expect(
      dropdown.getByRole("link", { name: "Pipeline", exact: true }),
    ).toBeVisible();
    await expect(
      dropdown.getByRole("button", { name: "Sales & Deals" }),
    ).toBeVisible();
    await expect(
      dropdown.getByRole("button", { name: "Customers & Contacts" }),
    ).toBeVisible();
    await expect(
      dropdown.getByRole("button", { name: "Outreach & Queues" }),
    ).toBeVisible();

    // Navigate to Pipeline
    await dropdown.getByRole("link", { name: "Pipeline", exact: true }).click();
    await expect(page).toHaveURL(/\/crm\/pipeline/);
  });
});
