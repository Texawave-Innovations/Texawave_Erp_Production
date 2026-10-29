import { test, expect, type Page } from "@playwright/test";
import { signInAsAdmin } from "./helpers/auth";

async function navigateToPreferences(page: Page) {
  await page.getByRole("button", { name: /^Settings/ }).click();
  await page.waitForTimeout(300);
  const link = page.getByRole("link", { name: "Preferences" });
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(/\/settings\/preferences/);
  await expect(
    page.getByRole("heading", { name: "User Preferences" }),
  ).toBeVisible();
  await page.waitForTimeout(500);
}

async function navigateToEmployees(page: Page) {
  const hrModule = page.getByRole("button", { name: "Human Resources" });
  await hrModule.click();
  const categoryMenu = page.getByRole("menu", {
    name: "Human Resources categories",
  });
  await expect(categoryMenu).toBeVisible();
  const peopleCat = categoryMenu.getByRole("button", { name: "People" });
  await peopleCat.click();
  const peopleSubmenu = page.getByRole("menu", { name: "People items" });
  await expect(peopleSubmenu).toBeVisible();
  const employeesLink = peopleSubmenu.getByRole("link", { name: "Employees" });
  await employeesLink.click();
  await expect(page).toHaveURL(/\/hr\/employees$/);
  await expect(
    page.getByRole("heading", { name: "Employees", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("table", { name: "Employees" })).toBeVisible();
  await page.waitForTimeout(500);
}

async function navigateToHrDashboard(page: Page) {
  const hrModule = page.getByRole("button", { name: "Human Resources" });
  await hrModule.click();
  const categoryMenu = page.getByRole("menu", {
    name: "Human Resources categories",
  });
  await expect(categoryMenu).toBeVisible();
  const overviewLink = categoryMenu.getByRole("link", { name: "Overview" });
  await overviewLink.click();
  await expect(page).toHaveURL(/\/hr\/dashboard/);
  await expect(
    page.getByRole("heading", { name: /Workforce & operational metrics/i }),
  ).toBeVisible();
  await page.waitForTimeout(500);
}

test.describe("Final Settings Integration, Global Formatting & Density Verification", () => {
  test("Global UI density scaling across Preferences and ERP Data Tables", async ({
    page,
  }) => {
    await signInAsAdmin(page);
    await navigateToPreferences(page);

    // 1. Select Compact Density
    const compactCard = page
      .locator("button")
      .filter({ hasText: "Compact" })
      .first();
    await expect(compactCard).toBeVisible();
    await compactCard.click();
    await page.waitForTimeout(500);

    // Verify DOM and localStorage for Compact
    const compactDom = await page.evaluate(() => ({
      attr: document.documentElement.getAttribute("data-density"),
      storage: localStorage.getItem("texawave_density"),
    }));
    expect(compactDom.attr).toBe("compact");
    expect(compactDom.storage).toBe("compact");

    // 2. Navigate to Employees table and verify compact padding
    await navigateToEmployees(page);
    const compactCellPadding = await page.evaluate(() => {
      const td = document.querySelector("table tbody tr td");
      if (!td) return null;
      const style = window.getComputedStyle(td);
      return {
        paddingTop: style.paddingTop,
        paddingBottom: style.paddingBottom,
        fontSize: style.fontSize,
      };
    });
    expect(compactCellPadding).not.toBeNull();
    // 0.375rem is 6px
    expect(compactCellPadding?.paddingTop).toBe("6px");
    expect(compactCellPadding?.paddingBottom).toBe("6px");

    // 3. Switch to Spacious Density
    await navigateToPreferences(page);
    const spaciousCard = page
      .locator("button")
      .filter({ hasText: "Spacious" })
      .first();
    await expect(spaciousCard).toBeVisible();
    await spaciousCard.click();
    await page.waitForTimeout(500);

    const spaciousDom = await page.evaluate(() => ({
      attr: document.documentElement.getAttribute("data-density"),
      storage: localStorage.getItem("texawave_density"),
    }));
    expect(spaciousDom.attr).toBe("spacious");
    expect(spaciousDom.storage).toBe("spacious");

    // 4. Navigate back to Employees table and verify spacious padding
    await navigateToEmployees(page);
    const spaciousCellPadding = await page.evaluate(() => {
      const td = document.querySelector("table tbody tr td");
      if (!td) return null;
      const style = window.getComputedStyle(td);
      return {
        paddingTop: style.paddingTop,
        paddingBottom: style.paddingBottom,
        fontSize: style.fontSize,
      };
    });
    expect(spaciousCellPadding).not.toBeNull();
    // 0.875rem is 14px
    expect(spaciousCellPadding?.paddingTop).toBe("14px");
    expect(spaciousCellPadding?.paddingBottom).toBe("14px");

    // 5. Restore Comfortable Density and Save
    await navigateToPreferences(page);
    const comfortableCard = page
      .locator("button")
      .filter({ hasText: "Comfortable" })
      .first();
    await comfortableCard.click();
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: "Save Preferences" }).click();
    await page.waitForTimeout(1000);

    const restoredDom = await page.evaluate(() => ({
      attr: document.documentElement.getAttribute("data-density"),
      storage: localStorage.getItem("texawave_density"),
    }));
    expect(restoredDom.attr).toBe("comfortable");
    expect(restoredDom.storage).toBe("comfortable");
  });

  test("Date Format reactivity across Preferences and Employees directory", async ({
    page,
  }) => {
    await signInAsAdmin(page);
    await navigateToPreferences(page);

    // 1. Select YYYY-MM-DD Date Format
    const dateFormatSelect = page.locator("#display select").nth(1);
    await dateFormatSelect.selectOption("YYYY-MM-DD");
    await page.getByRole("button", { name: "Save Preferences" }).click();
    await page.waitForTimeout(1200);

    // 2. Navigate to Employees and verify dates follow YYYY-MM-DD
    await navigateToEmployees(page);
    const joinedDatesIso = await page.evaluate(() => {
      const table = document.querySelector("table");
      if (!table) return [];
      const headers = Array.from(table.querySelectorAll("thead th")).map((th) =>
        th.textContent?.trim(),
      );
      const joinedColIdx = headers.findIndex((h) => h === "Joined");
      if (joinedColIdx === -1) return [];

      const rows = Array.from(table.querySelectorAll("tbody tr"));
      return rows
        .map((r) => r.querySelectorAll("td")[joinedColIdx]?.textContent?.trim())
        .filter((d): d is string => Boolean(d && d !== "—"));
    });

    expect(joinedDatesIso.length).toBeGreaterThan(0);
    for (const d of joinedDatesIso) {
      expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }

    // 3. Change Date Format to DD/MM/YYYY
    await navigateToPreferences(page);
    await dateFormatSelect.selectOption("DD/MM/YYYY");
    await page.getByRole("button", { name: "Save Preferences" }).click();
    await page.waitForTimeout(1200);

    // 4. Navigate to Employees and verify dates follow DD/MM/YYYY
    await navigateToEmployees(page);
    const joinedDatesDmY = await page.evaluate(() => {
      const table = document.querySelector("table");
      if (!table) return [];
      const headers = Array.from(table.querySelectorAll("thead th")).map((th) =>
        th.textContent?.trim(),
      );
      const joinedColIdx = headers.findIndex((h) => h === "Joined");
      if (joinedColIdx === -1) return [];

      const rows = Array.from(table.querySelectorAll("tbody tr"));
      return rows
        .map((r) => r.querySelectorAll("td")[joinedColIdx]?.textContent?.trim())
        .filter((d): d is string => Boolean(d && d !== "—"));
    });

    expect(joinedDatesDmY.length).toBeGreaterThan(0);
    for (const d of joinedDatesDmY) {
      expect(d).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    }
  });

  test("Number grouping and KPI StatCards render integers cleanly without trailing decimals", async ({
    page,
  }) => {
    await signInAsAdmin(page);
    await navigateToHrDashboard(page);

    // Verify Total Employees value is a clean integer
    const totalEmployeesCard = page.locator("#kpi-total");
    await expect(totalEmployeesCard).toBeVisible();
    const cardText = await totalEmployeesCard.evaluate((el) => {
      const container = el.closest("[class*='rounded-2xl']");
      return container?.textContent || "";
    });

    // Value should not have decimals like .00
    expect(cardText).not.toMatch(/\d+\.00/);

    // Live clock is running and visible
    const clockBadge = page
      .locator(".font-mono")
      .filter({ hasText: /(?:AM|PM|\d{2}:\d{2})/ })
      .first();
    await expect(clockBadge).toBeVisible();
  });
});
