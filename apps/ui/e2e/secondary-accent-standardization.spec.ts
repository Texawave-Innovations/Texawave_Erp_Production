import { test, expect } from "@playwright/test";
import { signInAsAdmin } from "./helpers/auth";
import * as path from "path";

const ARTIFACT_DIR =
  "C:/Users/skkin/.gemini/antigravity/brain/440f6961-9a9a-45ae-afdf-01d524582f5f";

test.describe("ERP-Wide Secondary Accent Color Standardization Verification", () => {
  test("Payments tab, New payment batch button, and Sidebar navigation reflect blue-to-cyan gradient standard", async ({
    page,
  }) => {
    await signInAsAdmin(page);
    await page.waitForTimeout(1000);

    // 1. Ensure Dark Mode
    const isDark = await page.evaluate(() =>
      document.documentElement.classList.contains("dark"),
    );
    if (!isDark) {
      await page.getByRole("button", { name: /Switch to dark mode/ }).click();
      await page.waitForTimeout(500);
    }

    // 2. Navigate via Human Resources dropdown menu to Payroll
    const hrNavBtn = page.getByRole("button", { name: "Human Resources" });
    await expect(hrNavBtn).toBeVisible();
    await hrNavBtn.click();

    const categoryMenu = page.getByRole("menu", {
      name: "Human Resources categories",
    });
    await expect(categoryMenu).toBeVisible();

    const payrollCat = categoryMenu.getByRole("button", { name: "Payroll" });
    await payrollCat.hover();

    const payrollSubmenu = page.getByRole("menu", { name: "Payroll items" });
    await expect(payrollSubmenu).toBeVisible();
    await payrollSubmenu.getByRole("link", { name: "Payroll" }).click();

    await page.waitForURL(/\/hr\/payroll/);
    await page.waitForTimeout(800);

    // 3. Click the "Payments" tab
    const paymentsTab = page.getByRole("tab", { name: "Payments" });
    await expect(paymentsTab).toBeVisible();
    await paymentsTab.click();
    await page.waitForTimeout(500);

    // 4. Verify Payments tab styling uses blue-to-cyan gradient class
    const tabClasses = await paymentsTab.getAttribute("class");
    console.log("Payments tab classes:", tabClasses);
    expect(tabClasses).toContain("from-blue-600");
    expect(tabClasses).toContain("to-cyan-500");

    // 5. Verify "New payment batch" button styling
    const newBatchButton = page.getByRole("button", {
      name: /New payment batch/i,
    });
    if ((await newBatchButton.count()) > 0) {
      const btnClasses = await newBatchButton.first().getAttribute("class");
      console.log("New payment batch button classes:", btnClasses);
      expect(btnClasses).toMatch(/from-blue-600|bg-blue-600|to-cyan-500/);
    }

    // Capture Payroll Payments Dark screenshot
    const payrollDarkScreenshot = path.join(
      ARTIFACT_DIR,
      "payroll-payments-dark.png",
    );
    await page.screenshot({ path: payrollDarkScreenshot, fullPage: true });
    console.log("Captured payroll-payments-dark.png");

    // 6. Verify Dynamic Sidebar active navigation item styling on /hr/employees
    const employeesLink = page
      .getByRole("link", { name: "Employees", exact: true })
      .first();
    if ((await employeesLink.count()) > 0) {
      await employeesLink.click();
      await page.waitForURL(/\/hr\/employees/);
      await page.waitForTimeout(800);

      const activeSidebarItem = page
        .locator('aside nav a[aria-current="page"]')
        .first();
      if ((await activeSidebarItem.count()) > 0) {
        const sidebarClasses = await activeSidebarItem.getAttribute("class");
        console.log("Active sidebar item classes:", sidebarClasses);
        expect(sidebarClasses).toContain("from-blue-600");
        expect(sidebarClasses).toContain("to-cyan-500");
      }

      const sidebarDarkScreenshot = path.join(
        ARTIFACT_DIR,
        "sidebar-active-dark.png",
      );
      await page.screenshot({ path: sidebarDarkScreenshot, fullPage: true });
      console.log("Captured sidebar-active-dark.png");
    }

    // 7. Verify no purple/violet classes are attached to active components
    const hasPurpleInView = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll("*"));
      const purpleRegex =
        /\b(text|bg|border|ring|from|to|via)-violet-\d+|\b(text|bg|border|ring|from|to|via)-purple-\d+/;
      const offenders = elements
        .filter((el) => {
          const className = el.getAttribute("class") || "";
          return purpleRegex.test(className);
        })
        .map((el) => ({
          tag: el.tagName,
          id: el.id,
          class: el.getAttribute("class"),
          text: (el.textContent || "").slice(0, 30),
        }));
      return offenders;
    });

    console.log(
      "Offending purple elements on current page:",
      JSON.stringify(hasPurpleInView, null, 2),
    );
    expect(hasPurpleInView.length).toBe(0);

    // 8. Test Light Mode fidelity
    await page.getByRole("button", { name: /Switch to light mode/ }).click();
    await page.waitForTimeout(600);

    const employeesLightScreenshot = path.join(
      ARTIFACT_DIR,
      "employees-light.png",
    );
    await page.screenshot({ path: employeesLightScreenshot, fullPage: true });
    console.log("Captured employees-light.png");

    const hasPurpleInLight = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll("*"));
      const purpleRegex =
        /\b(text|bg|border|ring|from|to|via)-violet-\d+|\b(text|bg|border|ring|from|to|via)-purple-\d+/;
      return elements
        .filter((el) => purpleRegex.test(el.getAttribute("class") || ""))
        .map((el) => el.getAttribute("class"));
    });
    expect(hasPurpleInLight.length).toBe(0);

    // Restore to dark mode
    await page.getByRole("button", { name: /Switch to dark mode/ }).click();
    await page.waitForTimeout(500);
  });
});
