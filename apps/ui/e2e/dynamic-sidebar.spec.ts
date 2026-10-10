import { expect, test, type Page, type Route } from "@playwright/test";
import { signInAsAdmin } from "./helpers/auth";

const API = "http://localhost:3000";

function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "none", typ: "JWT" })}.${b64(payload)}.sig`;
}

let nextId = 1;
function menuNode(code: string, path: string | null, children: unknown[] = []) {
  return {
    id: nextId++,
    code,
    label: code,
    path,
    icon: null,
    order: nextId,
    parentId: null,
    permission: null,
    children,
  };
}

/**
 * Signs in through the real login form with the API mocked, so the user's
 * permission-filtered menu (`GET /menu/my-menu`) is exactly `menu` — or that
 * endpoint fails with `menuStatus`. Everything else the screens fetch is a 404.
 */
async function signInWithMenu(
  page: Page,
  menu: unknown[],
  menuStatus = 200,
): Promise<void> {
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
          accessToken: jwt({ organizationId: 1, sub: 1 }),
          refreshToken: "r",
        },
      });
    }
    if (pathname === "/auth/me") {
      return json(200, {
        data: {
          userId: 1,
          organizationId: 1,
          email: "lead@texawave.test",
          fullName: "Team Lead",
          roleIds: [1],
          permissions: ["hr.leave_request.read.team", "hr.holiday.read"],
        },
      });
    }
    if (pathname === "/menu/my-menu") {
      return menuStatus === 200
        ? json(200, { data: menu })
        : json(menuStatus, {
            statusCode: menuStatus,
            message: "Forbidden",
            error: "Forbidden",
            path: pathname,
          });
    }
    if (pathname === "/reference/tags") {
      return json(200, {
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 1 },
      });
    }
    return json(404, {
      statusCode: 404,
      message: "Not mocked",
      error: "Not Found",
      path: pathname,
    });
  });

  await page.goto("/login");
  await page.getByLabel("Organization").fill("texawave-innovations");
  await page.getByLabel("Email").fill("lead@texawave.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("not-checked-by-mock");
  await page.getByRole("button", { name: "Sign in" }).click();
  // HR grants land on the HR dashboard (features/auth/landing.ts).
  await expect(page).toHaveURL(/\/hr$/);
}

test("HR sidebar shows only the tabs the user's menu allows", async ({
  page,
}) => {
  await signInWithMenu(page, [
    menuNode("hr", null, [
      menuNode("hr-dashboard", "/hr/dashboard"),
      menuNode("hr-leaves", "/hr/leaves"),
      menuNode("hr-holidays", "/hr/holidays"),
    ]),
  ]);
  const nav = page.getByRole("navigation", {
    name: "Human Resources Navigation",
  });

  for (const href of ["/hr/dashboard", "/hr/leaves", "/hr/holidays"]) {
    await expect(nav.locator(`a[href='${href}']`)).toBeVisible();
  }
  // Tabs the menu (i.e. the role's grants) leaves out are not linked at all...
  for (const href of [
    "/hr/employees",
    "/hr/recruitment",
    "/hr/attendance",
    "/hr/payroll",
    "/hr/teams",
  ]) {
    await expect(nav.locator(`a[href='${href}']`)).toHaveCount(0);
  }
  // ...and a group left with no tab is not rendered either.
  await expect(nav.getByRole("button", { name: "Workforce" })).toHaveCount(0);
  await expect(
    nav.getByRole("button", { name: "Leave & Calendar" }),
  ).toBeVisible();

  await nav.locator("a[href='/hr/leaves']").click();
  await expect(page).toHaveURL(/\/hr\/leaves$/);
});

test("HR sidebar shows no links when the menu cannot be loaded", async ({
  page,
}) => {
  await signInWithMenu(page, [], 403);
  const nav = page.getByRole("navigation", {
    name: "Human Resources Navigation",
  });

  await expect(nav.getByText("Could not load navigation.")).toBeVisible();
  await expect(nav.locator("a")).toHaveCount(0);
});

test("sidebar shows permission-gated admin links and navigates", async ({
  page,
}) => {
  await signInAsAdmin(page);
  const nav = page.getByRole("navigation");

  for (const label of ["Departments", "Roles", "Users", "Navigation Menu"]) {
    await expect(nav.getByRole("link", { name: label })).toBeVisible();
  }

  await nav.getByRole("link", { name: "Users" }).click();
  await expect(page).toHaveURL(/\/admin\/users/);
  await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
});

test("sidebar shows the HR group and navigates to its screens", async ({
  page,
}) => {
  await signInAsAdmin(page);
  const nav = page.getByRole("navigation");

  await expect(nav.getByText("HR", { exact: true })).toBeVisible();
  for (const href of ["/hr/dashboard", "/hr/employees", "/hr/recruitment"]) {
    await expect(nav.locator(`a[href='${href}']`)).toBeVisible();
  }

  await nav.locator("a[href='/hr/employees']").click();
  await expect(page).toHaveURL(/\/hr\/employees/);
  await expect(page.getByRole("heading", { name: "Employees" })).toBeVisible();

  await nav.locator("a[href='/hr/recruitment']").click();
  await expect(page).toHaveURL(/\/hr\/recruitment/);

  await nav.locator("a[href='/hr/dashboard']").click();
  await expect(page).toHaveURL(/\/hr\/dashboard/);
});
