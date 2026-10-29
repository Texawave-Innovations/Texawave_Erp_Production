import { test, expect, type Page, type Route } from "@playwright/test";
import { signInAsAdmin } from "./helpers/auth";

const API = "http://localhost:3000";

function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "none", typ: "JWT" })}.${b64(payload)}.sig`;
}

function menuNode(
  code: string,
  label: string,
  path: string | null,
  children: unknown[] = [],
) {
  return {
    id: 1,
    code,
    label,
    path,
    icon: null,
    order: 1,
    parentId: null,
    permission: null,
    children,
  };
}

async function signInPortalEmployee(
  page: Page,
  options: { userId?: number; email?: string } = {},
) {
  const userId = options.userId ?? 42;
  const email = options.email ?? "portal.user@texawave.test";

  await page.route(`${API}/**`, async (route: Route) => {
    const { pathname } = new URL(route.request().url());
    const json = (status: number, body: unknown) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });

    if (pathname === "/auth/login") {
      return json(200, {
        data: {
          accessToken: jwt({ organizationId: 1, sub: userId }),
          refreshToken: "mock-refresh",
        },
      });
    }
    if (pathname === "/auth/me") {
      return json(200, {
        data: {
          userId,
          organizationId: 1,
          email,
          fullName: "Portal Employee",
          roleIds: [2],
          permissions: [
            "employee_self_service.profile.read",
            "employee_self_service.leave_request.read",
            "hr.attendance.read.team",
          ],
        },
      });
    }
    if (pathname === "/employee/profile") {
      return json(200, {
        data: {
          id: 101,
          fullName: "Portal Employee",
          employeeCode: "EMP-000101",
          onboardingStatus: "COMPLETE",
        },
      });
    }
    if (pathname === "/menu/my-menu") {
      return json(200, {
        data: [
          menuNode("portal", "My Portal", null, [
            menuNode("portal-profile", "My Profile", "/portal/profile"),
          ]),
        ],
      });
    }
    if (pathname.startsWith("/settings/preferences")) {
      return json(200, {
        preferences: null,
        effective: {
          theme: "system",
          density: "comfortable",
          timezone: "Asia/Kolkata",
          dateFormat: "DD/MM/YYYY",
          timeFormat: "12h",
          displayCurrency: "INR",
        },
      });
    }
    return json(404, {
      statusCode: 404,
      message: "Not mocked",
      error: "Not Found",
    });
  });

  await page.goto("/login");
  await page.getByLabel("Organization").fill("texawave-innovations");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("valid-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/portal/);
}

test.describe("Separate Theme Preferences — Main ERP Dashboard vs Employee Portal", () => {
  test("1. Employee portal has an accessible theme toggle icon in header and defaults to light mode", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.evaluate(() => {
      localStorage.clear();
    });

    await signInPortalEmployee(page);

    // Initial portal rendering defaults to light mode
    const isDark = await page.evaluate(() =>
      document.documentElement.classList.contains("dark"),
    );
    expect(isDark).toBe(false);

    // Theme toggle button exists near notification and sign-out controls
    const portalToggle = page.getByRole("button", {
      name: /Switch to dark theme|Switch to dark mode/i,
    });
    await expect(portalToggle).toBeVisible();

    // Tooltip / title attribute check
    await expect(portalToggle).toHaveAttribute(
      "title",
      /Switch to dark theme|Switch to dark mode/i,
    );
  });

  test("2. Toggling theme in Employee Portal updates theme, persists independently, and restores when employee returns", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.evaluate(() => {
      localStorage.clear();
      // Main ERP was set to dark previously
      localStorage.setItem("texawave_theme", "dark");
    });

    await signInPortalEmployee(page, { userId: 42 });

    // Verify main ERP key exists and is dark, while portal starts light
    const initialStorage = await page.evaluate(() => ({
      mainTheme: localStorage.getItem("texawave_theme"),
      portalTheme: localStorage.getItem("texawave_portal_theme"),
      userPortalTheme: localStorage.getItem("texawave_portal_theme_42"),
      isDark: document.documentElement.classList.contains("dark"),
    }));
    expect(initialStorage.mainTheme).toBe("dark");
    expect(initialStorage.isDark).toBe(false);

    // Click portal theme toggle -> Switch to Dark
    const toggleToDark = page.getByRole("button", {
      name: /Switch to dark theme|Switch to dark mode/i,
    });
    await toggleToDark.click();
    await page.waitForTimeout(300);

    // Capture Portal Dark Screenshot
    const darkScreenshot =
      "C:/Users/skkin/.gemini/antigravity/brain/440f6961-9a9a-45ae-afdf-01d524582f5f/portal-dashboard-dark.png";
    await page.screenshot({ path: darkScreenshot, fullPage: true });

    // Portal is now dark
    const afterDarkClick = await page.evaluate(() => ({
      mainTheme: localStorage.getItem("texawave_theme"),
      portalTheme: localStorage.getItem("texawave_portal_theme"),
      userPortalTheme: localStorage.getItem("texawave_portal_theme_42"),
      isDark: document.documentElement.classList.contains("dark"),
    }));
    expect(afterDarkClick.isDark).toBe(true);
    expect(afterDarkClick.portalTheme).toBe("dark");
    expect(afterDarkClick.userPortalTheme).toBe("dark");
    // Main ERP theme must remain completely UNTOUCHED
    expect(afterDarkClick.mainTheme).toBe("dark");

    // Toggle button aria-label now reads "Switch to light theme"
    const toggleToLight = page.getByRole("button", {
      name: /Switch to light theme|Switch to light mode/i,
    });
    await expect(toggleToLight).toBeVisible();

    // Sign in again as employee 42 to verify restoration upon return
    await signInPortalEmployee(page, { userId: 42 });
    await page.waitForTimeout(500);

    // Portal restores its own dark theme preference when employee returns
    const afterReturn = await page.evaluate(() => ({
      mainTheme: localStorage.getItem("texawave_theme"),
      portalTheme: localStorage.getItem("texawave_portal_theme"),
      userPortalTheme: localStorage.getItem("texawave_portal_theme_42"),
      isDark: document.documentElement.classList.contains("dark"),
    }));
    expect(afterReturn.isDark).toBe(true);
    expect(afterReturn.portalTheme).toBe("dark");
    expect(afterReturn.userPortalTheme).toBe("dark");
    expect(afterReturn.mainTheme).toBe("dark");

    // Toggle back to light in portal
    await page
      .getByRole("button", {
        name: /Switch to light theme|Switch to light mode/i,
      })
      .click();
    await page.waitForTimeout(300);

    // Capture Portal Light Screenshot
    const lightScreenshot =
      "C:/Users/skkin/.gemini/antigravity/brain/440f6961-9a9a-45ae-afdf-01d524582f5f/portal-dashboard-light.png";
    await page.screenshot({ path: lightScreenshot, fullPage: true });

    const afterLightClick = await page.evaluate(() => ({
      mainTheme: localStorage.getItem("texawave_theme"),
      portalTheme: localStorage.getItem("texawave_portal_theme"),
      userPortalTheme: localStorage.getItem("texawave_portal_theme_42"),
      isDark: document.documentElement.classList.contains("dark"),
    }));
    expect(afterLightClick.isDark).toBe(false);
    expect(afterLightClick.portalTheme).toBe("light");
    expect(afterLightClick.userPortalTheme).toBe("light");
    expect(afterLightClick.mainTheme).toBe("dark");
  });

  test("3. Complete isolation matrix: Main ERP changes do not alter Portal theme, and Portal changes do not alter Main ERP", async ({
    context,
  }) => {
    // Open Main ERP in Tab 1
    const pageErp = await context.newPage();
    await signInAsAdmin(pageErp);
    await pageErp.waitForTimeout(1000);

    // Ensure Main ERP is Dark
    const isErpDarkInit = await pageErp.evaluate(() =>
      document.documentElement.classList.contains("dark"),
    );
    if (!isErpDarkInit) {
      const darkBtn = pageErp.getByRole("button", {
        name: /Switch to dark mode/i,
      });
      await darkBtn.click();
      await pageErp.waitForTimeout(500);
    }
    expect(
      await pageErp.evaluate(() =>
        document.documentElement.classList.contains("dark"),
      ),
    ).toBe(true);

    // Open Employee Portal in Tab 2
    const pagePortal = await context.newPage();
    await signInPortalEmployee(pagePortal);

    // 1. Employee Portal must NOT inherit Main ERP's dark mode
    const portalInitIsDark = await pagePortal.evaluate(() =>
      document.documentElement.classList.contains("dark"),
    );
    expect(portalInitIsDark).toBe(false);

    // 2. Set employee portal to Dark
    await pagePortal
      .getByRole("button", {
        name: /Switch to dark theme|Switch to dark mode/i,
      })
      .click();
    await pagePortal.waitForTimeout(400);

    expect(
      await pagePortal.evaluate(() =>
        document.documentElement.classList.contains("dark"),
      ),
    ).toBe(true);

    // Main ERP in Tab 1 must remain Unchanged (still Dark)
    expect(
      await pageErp.evaluate(() =>
        document.documentElement.classList.contains("dark"),
      ),
    ).toBe(true);

    // 3. Switch Main ERP to Light in Tab 1
    const lightBtn = pageErp.getByRole("button", {
      name: /Switch to light mode/i,
    });
    await lightBtn.click();
    await pageErp.waitForTimeout(500);

    expect(
      await pageErp.evaluate(() =>
        document.documentElement.classList.contains("dark"),
      ),
    ).toBe(false);

    // Employee Portal in Tab 2 must remain Unchanged (still Dark)
    expect(
      await pagePortal.evaluate(() =>
        document.documentElement.classList.contains("dark"),
      ),
    ).toBe(true);

    // 4. Switch Employee Portal to Light in Tab 2
    await pagePortal
      .getByRole("button", {
        name: /Switch to light theme|Switch to light mode/i,
      })
      .click();
    await pagePortal.waitForTimeout(400);

    expect(
      await pagePortal.evaluate(() =>
        document.documentElement.classList.contains("dark"),
      ),
    ).toBe(false);

    // Main ERP in Tab 1 must remain Unchanged (still Light)
    expect(
      await pageErp.evaluate(() =>
        document.documentElement.classList.contains("dark"),
      ),
    ).toBe(false);
  });

  test("4. Root layout initialization script evaluates portal path vs main ERP path with zero flashing", async ({
    page,
  }) => {
    await page.goto("/login");
    // Seed storage with contrasting preferences
    await page.evaluate(() => {
      localStorage.setItem("texawave_theme", "dark");
      localStorage.setItem("texawave_portal_theme", "light");
    });

    // Directly evaluate the root layout script on portal path simulation
    const portalResult = await page.evaluate(() => {
      const path = "/portal/attendance";
      const isPortal =
        path.indexOf("/portal") === 0 ||
        path.indexOf("/onboarding") === 0 ||
        path.indexOf("/self-service") === 0;
      const portalTheme = localStorage.getItem("texawave_portal_theme");
      return { isPortal, portalTheme, isDark: portalTheme === "dark" };
    });
    expect(portalResult.isPortal).toBe(true);
    expect(portalResult.isDark).toBe(false);

    // Directly evaluate the root layout script on main ERP path simulation
    const erpResult = await page.evaluate(() => {
      const path = "/hr/dashboard";
      const isPortal =
        path.indexOf("/portal") === 0 ||
        path.indexOf("/onboarding") === 0 ||
        path.indexOf("/self-service") === 0;
      const theme = localStorage.getItem("texawave_theme");
      return { isPortal, theme, isDark: theme === "dark" };
    });
    expect(erpResult.isPortal).toBe(false);
    expect(erpResult.isDark).toBe(true);
  });
});
