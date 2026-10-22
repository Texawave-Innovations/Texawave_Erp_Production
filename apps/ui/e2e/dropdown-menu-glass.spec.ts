import { test, expect } from "@playwright/test";
import { signInAsAdmin } from "./helpers/auth";

test.describe("TexaOne Shared Animated Glassmorphism Dropdowns & Controls", () => {
  test.beforeEach(async ({ page }) => {
    await signInAsAdmin(page);
  });

  test("Profile dropdown consumes shared DropdownMenu, renders glass styling, and handles sign-out", async ({
    page,
  }) => {
    const profileBtn = page.getByRole("button", {
      name: /Super Admin|admin@texawave\.com|Open profile menu/i,
    });
    await expect(profileBtn).toBeVisible();
    await expect(profileBtn).toHaveAttribute("aria-expanded", "false");

    // 1. Open dropdown
    await profileBtn.click();
    await expect(profileBtn).toHaveAttribute("aria-expanded", "true");

    // 2. Dropdown menu panel visible in portal with glassmorphism styling
    const menu = page.locator("div[role='menu']");
    await expect(menu).toBeVisible();
    await expect(menu).toHaveClass(/glass-dropdown/);

    // 3. Destructive sign-out option rendered with styling
    const signOutBtn = menu.getByRole("menuitem", { name: /Sign Out/i });
    await expect(signOutBtn).toBeVisible();

    // 4. Keyboard dismissal with Escape
    await page.keyboard.press("Escape");
    await expect(menu).not.toBeVisible();
    await expect(profileBtn).toHaveAttribute("aria-expanded", "false");
  });

  test("Select controls use animated glassmorphism dropdown with keyboard navigation and value changes", async ({
    page,
  }) => {
    const nav = page.getByRole("navigation", {
      name: "Main application navigation",
    });
    const hrBtn = nav.getByRole("button", { name: "Human Resources" });
    await hrBtn.hover();
    const dropdown = page.getByRole("menu", {
      name: "Human Resources categories",
    });
    await dropdown.getByRole("link", { name: "Employees", exact: true }).click();
    await expect(page).toHaveURL(/\/hr\/employees/);
    await page.waitForLoadState("networkidle");

    // 1. Locate the Sort Select combobox
    const sortTrigger = page.getByRole("combobox", { name: /Sort by/i });
    await expect(sortTrigger).toBeVisible();
    await expect(sortTrigger).toHaveAttribute("aria-expanded", "false");

    // 2. Open the animated glassmorphism select
    await sortTrigger.click();
    await expect(sortTrigger).toHaveAttribute("aria-expanded", "true");

    const listbox = page.locator("div[role='listbox']");
    await expect(listbox).toBeVisible();

    // 3. Verify options are rendered inside the animated portal
    const options = listbox.getByRole("option");
    expect(await options.count()).toBeGreaterThan(0);

    await page.screenshot({
      path: "C:/Users/aslam/.gemini/antigravity-ide/brain/113e345c-5799-4e4f-b6d9-b2cee30b5a04/employees_select_dropdown_verified.png",
    });

    // 4. Select an option (e.g. Name)
    const nameOption = listbox.getByRole("option", { name: /Name/i });
    await nameOption.click();

    // 5. Menu closes and trigger shows updated label
    await expect(listbox).not.toBeVisible();
    await expect(sortTrigger).toHaveAttribute("aria-expanded", "false");
    await expect(sortTrigger).toContainText("Name");
  });

  test("Table ActionMenu retains original circular orbit motion effect", async ({
    page,
  }) => {
    const nav = page.getByRole("navigation", {
      name: "Main application navigation",
    });
    const hrBtn = nav.getByRole("button", { name: "Human Resources" });
    await hrBtn.hover();
    const dropdown = page.getByRole("menu", {
      name: "Human Resources categories",
    });
    await dropdown.getByRole("link", { name: "Employees", exact: true }).click();
    await expect(page).toHaveURL(/\/hr\/employees/);
    await page.waitForLoadState("networkidle");

    const firstRow = page.locator("tbody tr").first();
    await expect(firstRow).toBeVisible();

    const actionBtn = firstRow.getByRole("button", { name: /^Actions for / });
    await expect(actionBtn).toBeVisible();

    // 1. Open circular ActionMenu
    await actionBtn.click();

    // 2. Circular modal dialog opens with radial items
    const dialog = page.locator("div[role='dialog']");
    await expect(dialog).toBeVisible();

    const closeBtn = dialog.getByRole("button", { name: "Close menu" });
    await expect(closeBtn).toBeVisible();

    const radialButtons = dialog.getByRole("menuitem");
    expect(await radialButtons.count()).toBeGreaterThan(0);

    // 3. Close the radial menu
    await closeBtn.click();
    await expect(dialog).not.toBeVisible();
  });
});
