import { test, expect, type Page } from "@playwright/test";
import { signInAsAdmin } from "./helpers/auth";
import * as path from "path";

const ARTIFACT_DIR =
  "C:/Users/skkin/.gemini/antigravity/brain/440f6961-9a9a-45ae-afdf-01d524582f5f";

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

async function navigateToRegional(page: Page) {
  await page.getByRole("button", { name: /^Settings/ }).click();
  await page.waitForTimeout(300);
  const link = page.getByRole("link", { name: "Regional Formats" });
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(/\/settings\/regional/);
  await expect(
    page.getByRole("heading", {
      name: /Regional Formats & Currency Architecture/,
    }),
  ).toBeVisible();
  await page.waitForTimeout(500);
}

async function navigateToHrDashboard(page: Page) {
  const logoLink = page
    .getByRole("link", { name: "TexaOne — Run Your Business as One." })
    .first();
  await logoLink.click();
  await expect(page).toHaveURL(/\/hr\/dashboard/);
  await page.waitForTimeout(500);
}

test.describe("Global Dark Theme Redesign & Verification", () => {
  test("Complete Dark Theme & Branding Verification across ERP", async ({
    page,
  }) => {
    // 1. Sign in as Admin
    await signInAsAdmin(page);
    await page.waitForTimeout(1000);

    // Ensure we are on HR dashboard
    if (!page.url().includes("/hr/dashboard")) {
      await navigateToHrDashboard(page);
    }

    // 2. Ensure Dark Mode is enabled
    const initialIsDark = await page.evaluate(() =>
      document.documentElement.classList.contains("dark"),
    );
    if (!initialIsDark) {
      const darkToggle = page.getByRole("button", {
        name: /Switch to dark mode/,
      });
      await expect(darkToggle).toBeVisible();
      await darkToggle.click();
      await page.waitForTimeout(600);
    }

    // 3. Measure Computed Styles on HR Dashboard
    const dashboardStyles = await page.evaluate(() => {
      const bodyBg = window.getComputedStyle(document.body).backgroundColor;
      const headerDiv = document.querySelector(
        'header[aria-label="TexaOne application navigation"]',
      );
      const headerBg = headerDiv
        ? window.getComputedStyle(headerDiv).backgroundColor
        : "";
      const darkLogo = document.querySelector(
        'img[src*="texaone-logo-dark.png"]',
      );
      const lightLogo = document.querySelector('img[src*="texaone-logo.png"]');

      return {
        bodyBg,
        headerBg,
        hasDarkLogo: Boolean(darkLogo),
        darkLogoDisplay: darkLogo
          ? window.getComputedStyle(darkLogo).display
          : "none",
        lightLogoDisplay: lightLogo
          ? window.getComputedStyle(lightLogo).display
          : "none",
      };
    });

    console.log(
      "HR Dashboard Computed Styles:",
      JSON.stringify(dashboardStyles, null, 2),
    );

    // Verify Flux near-black enterprise palette
    expect(dashboardStyles.bodyBg).toBe("rgb(8, 9, 13)"); // #08090D
    expect(dashboardStyles.hasDarkLogo).toBe(true);

    // Capture HR Dashboard Dark Screenshot
    const hrDarkScreenshot = path.join(ARTIFACT_DIR, "hr-dashboard-dark.png");
    await page.screenshot({ path: hrDarkScreenshot, fullPage: true });
    console.log("Captured hr-dashboard-dark.png");

    // 4. Navigate to Preferences Page client-side
    await navigateToPreferences(page);

    // Verify Preferences Page selection cards and styling
    const prefStyles = await page.evaluate(() => {
      const bodyBg = window.getComputedStyle(document.body).backgroundColor;
      const density = document.documentElement.getAttribute("data-density");
      const darkCard = document.querySelector(
        'button[role="radio"][aria-checked="true"]',
      );

      return {
        bodyBg,
        density,
        hasRadioCards: Boolean(darkCard),
      };
    });

    console.log(
      "Preferences Page Evaluation:",
      JSON.stringify(prefStyles, null, 2),
    );
    expect(prefStyles.bodyBg).toBe("rgb(8, 9, 13)");

    // Test Density Card interaction
    const compactCard = page
      .locator('button[role="radio"]:has-text("Compact")')
      .first();
    if ((await compactCard.count()) > 0) {
      await compactCard.click();
      await page.waitForTimeout(300);
      const densityVal = await page.evaluate(() =>
        document.documentElement.getAttribute("data-density"),
      );
      expect(densityVal).toBe("compact");
    }

    const comfortableCard = page
      .locator('button[role="radio"]:has-text("Comfortable")')
      .first();
    if ((await comfortableCard.count()) > 0) {
      await comfortableCard.click();
      await page.waitForTimeout(300);
      const densityVal = await page.evaluate(() =>
        document.documentElement.getAttribute("data-density"),
      );
      expect(densityVal).toBe("comfortable");
    }

    // Capture Preferences Dark Screenshot
    const prefDarkScreenshot = path.join(
      ARTIFACT_DIR,
      "settings-preferences-dark.png",
    );
    await page.screenshot({ path: prefDarkScreenshot, fullPage: true });
    console.log("Captured settings-preferences-dark.png");

    // 5. Navigate to Regional Formats Page client-side
    await navigateToRegional(page);

    const regStyles = await page.evaluate(() => {
      const bodyBg = window.getComputedStyle(document.body).backgroundColor;
      return { bodyBg };
    });
    expect(regStyles.bodyBg).toBe("rgb(8, 9, 13)");

    // Capture Regional Formats Dark Screenshot
    const regDarkScreenshot = path.join(
      ARTIFACT_DIR,
      "settings-regional-dark.png",
    );
    await page.screenshot({ path: regDarkScreenshot, fullPage: true });
    console.log("Captured settings-regional-dark.png");

    // 6. Switch to Light Mode and verify fidelity
    const lightToggle = page.getByRole("button", {
      name: /Switch to light mode/,
    });
    await expect(lightToggle).toBeVisible();
    await lightToggle.click();
    await page.waitForTimeout(600);

    const lightState = await page.evaluate(() => ({
      isDark: document.documentElement.classList.contains("dark"),
      bodyBg: window.getComputedStyle(document.body).backgroundColor,
    }));
    expect(lightState.isDark).toBe(false);
    expect(lightState.bodyBg).toBe("rgb(255, 255, 255)");

    // Capture Preferences Light Screenshot
    await navigateToPreferences(page);
    const prefLightScreenshot = path.join(
      ARTIFACT_DIR,
      "settings-preferences-light.png",
    );
    await page.screenshot({ path: prefLightScreenshot, fullPage: true });
    console.log("Captured settings-preferences-light.png");

    // Capture HR Dashboard Light Screenshot
    await navigateToHrDashboard(page);
    const hrLightScreenshot = path.join(ARTIFACT_DIR, "hr-dashboard-light.png");
    await page.screenshot({ path: hrLightScreenshot, fullPage: true });
    console.log("Captured hr-dashboard-light.png");
  });
});
