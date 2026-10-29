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
}

async function navigateToRegional(page: Page) {
  await page.getByRole("button", { name: /^Settings/ }).click();
  await page.waitForTimeout(300);
  const link = page.getByRole("link", { name: "Regional Formats" });
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(/\/settings\/regional/);
  await expect(
    page.getByRole("heading", { name: /Organization Regional Conventions/ }),
  ).toBeVisible();
}

test.describe("Settings Stability Phase: Theme Persistence, Dark Consistency & Navigation", () => {
  test("Settings navigation direct links to Preferences and Regional Formats", async ({
    page,
  }) => {
    await signInAsAdmin(page);

    // Direct link to Preferences
    await navigateToPreferences(page);

    // Direct link to Regional Formats
    await navigateToRegional(page);
  });

  test("Theme toggle and coherent dark palette verification", async ({
    page,
  }) => {
    await signInAsAdmin(page);

    // Ensure we start in Light Mode
    const initialIsDark = await page.evaluate(() =>
      document.documentElement.classList.contains("dark"),
    );
    if (initialIsDark) {
      await page.getByRole("button", { name: /Switch to light mode/ }).click();
      await page.waitForTimeout(500);
    }

    // Verify Light Mode baseline
    const lightState = await page.evaluate(() => ({
      isDark: document.documentElement.classList.contains("dark"),
      bodyBg: window.getComputedStyle(document.body).backgroundColor,
    }));
    expect(lightState.isDark).toBe(false);
    expect(lightState.bodyBg).toBe("rgb(255, 255, 255)");

    // Switch to Dark Mode via Quick Toggle
    const darkToggle = page.getByRole("button", {
      name: /Switch to dark mode/,
    });
    await expect(darkToggle).toBeVisible();
    await darkToggle.click();
    await page.waitForTimeout(600);

    // Verify Dark Mode palette: #08090D is rgb(8, 9, 13)
    const darkState = await page.evaluate(() => ({
      isDark: document.documentElement.classList.contains("dark"),
      bodyBg: window.getComputedStyle(document.body).backgroundColor,
    }));
    expect(darkState.isDark).toBe(true);
    expect(darkState.bodyBg).toBe("rgb(8, 9, 13)");

    // Toggle back to Light Mode
    const lightToggle = page.getByRole("button", {
      name: /Switch to light mode/,
    });
    await expect(lightToggle).toBeVisible();
    await lightToggle.click();
    await page.waitForTimeout(600);

    const backToLight = await page.evaluate(() => ({
      isDark: document.documentElement.classList.contains("dark"),
      bodyBg: window.getComputedStyle(document.body).backgroundColor,
    }));
    expect(backToLight.isDark).toBe(false);
    expect(backToLight.bodyBg).toBe("rgb(255, 255, 255)");
  });

  test("Saving preferences does NOT change or flip the theme (Light Mode protected)", async ({
    page,
  }) => {
    await signInAsAdmin(page);

    // 1. Ensure Light Mode is active
    const isDarkInit = await page.evaluate(() =>
      document.documentElement.classList.contains("dark"),
    );
    if (isDarkInit) {
      await page.getByRole("button", { name: /Switch to light mode/ }).click();
      await page.waitForTimeout(500);
    }

    // Go to /settings/preferences via in-app navbar
    await navigateToPreferences(page);

    // Verify still Light
    expect(
      await page.evaluate(() =>
        document.documentElement.classList.contains("dark"),
      ),
    ).toBe(false);

    // 2. Change Date Format and Save
    const dateFormatSelect = page.locator("#display select").nth(1);
    await dateFormatSelect.selectOption("YYYY-MM-DD");
    await page.getByRole("button", { name: "Save Preferences" }).click();
    await page.waitForTimeout(1000);

    // Verify still Light
    const afterDateSave = await page.evaluate(() => ({
      isDark: document.documentElement.classList.contains("dark"),
      themeStorage: localStorage.getItem("texawave_theme"),
    }));
    expect(afterDateSave.isDark).toBe(false);

    // 3. Change Interface Density and Save
    const compactDensityCard = page
      .locator('button[role="radio"]:has-text("Compact")')
      .first();
    await compactDensityCard.click();
    await page.getByRole("button", { name: "Save Preferences" }).click();
    await page.waitForTimeout(1000);

    // Verify density applied and still Light
    const afterDensitySave = await page.evaluate(() => ({
      isDark: document.documentElement.classList.contains("dark"),
      density: document.documentElement.getAttribute("data-density"),
    }));
    expect(afterDensitySave.isDark).toBe(false);
    expect(afterDensitySave.density).toBe("compact");

    // 4. Navigate to Regional Formats and Save Organization Settings
    await navigateToRegional(page);

    // Verify still Light on regional formats page
    expect(
      await page.evaluate(() =>
        document.documentElement.classList.contains("dark"),
      ),
    ).toBe(false);

    // Change a regional format value and save
    const orgDateSelect = page.locator("#formats select").first();
    await orgDateSelect.selectOption("DD/MM/YYYY");
    await page
      .getByRole("button", { name: "Save Organization Settings" })
      .click();
    await page.waitForTimeout(1500);

    // CRITICAL: Theme must remain Light after saving organization settings
    const afterOrgSave = await page.evaluate(() => ({
      isDark: document.documentElement.classList.contains("dark"),
      themeStorage: localStorage.getItem("texawave_theme"),
      bodyBg: window.getComputedStyle(document.body).backgroundColor,
    }));
    expect(afterOrgSave.isDark).toBe(false);
    expect(afterOrgSave.bodyBg).toBe("rgb(255, 255, 255)");
  });

  test("Saving preferences does NOT change or flip the theme (Dark Mode protected)", async ({
    page,
  }) => {
    await signInAsAdmin(page);

    // 1. Ensure Dark Mode is active
    const isDarkInit = await page.evaluate(() =>
      document.documentElement.classList.contains("dark"),
    );
    if (!isDarkInit) {
      await page.getByRole("button", { name: /Switch to dark mode/ }).click();
      await page.waitForTimeout(500);
    }

    // Go to /settings/preferences via in-app navbar
    await navigateToPreferences(page);

    // Verify Dark Mode active
    expect(
      await page.evaluate(() =>
        document.documentElement.classList.contains("dark"),
      ),
    ).toBe(true);

    // 2. Change Currency and Save
    const currencySelect = page.locator("#display select").nth(3);
    await currencySelect.selectOption("USD");
    await page.getByRole("button", { name: "Save Preferences" }).click();
    await page.waitForTimeout(1000);

    // Verify still Dark
    expect(
      await page.evaluate(() =>
        document.documentElement.classList.contains("dark"),
      ),
    ).toBe(true);

    // 3. Navigate to Regional Formats and save
    await navigateToRegional(page);

    // Verify still Dark
    expect(
      await page.evaluate(() =>
        document.documentElement.classList.contains("dark"),
      ),
    ).toBe(true);

    await page
      .getByRole("button", { name: "Save Organization Settings" })
      .click();
    await page.waitForTimeout(1500);

    // CRITICAL: Theme must remain Dark after saving organization settings
    const afterOrgSaveDark = await page.evaluate(() => ({
      isDark: document.documentElement.classList.contains("dark"),
      themeStorage: localStorage.getItem("texawave_theme"),
      bodyBg: window.getComputedStyle(document.body).backgroundColor,
    }));
    expect(afterOrgSaveDark.isDark).toBe(true);
    expect(afterOrgSaveDark.bodyBg).toBe("rgb(8, 9, 13)");

    // Restore to Light Mode for cleanliness
    await page.getByRole("button", { name: /Switch to light mode/ }).click();
    await page.waitForTimeout(500);
  });

  test("Reset to Organization Defaults resets overrides cleanly", async ({
    page,
  }) => {
    await signInAsAdmin(page);
    await navigateToPreferences(page);

    const resetButton = page.getByRole("button", {
      name: "Reset to Organization Defaults",
    });
    await expect(resetButton).toBeVisible();

    page.once("dialog", (dialog) => dialog.accept());
    await resetButton.click();
    await page.waitForTimeout(1500);

    const afterReset = await page.evaluate(() => ({
      density: document.documentElement.getAttribute("data-density"),
      storageDensity: localStorage.getItem("texawave_density"),
    }));
    expect(afterReset.density).toBe("comfortable");
    expect(afterReset.storageDensity).toBe("comfortable");
  });
});
