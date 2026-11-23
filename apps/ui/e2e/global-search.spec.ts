import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * Global search in the top bars (components/layout/GlobalSearch.tsx):
 * - HR workspace: only pages the role can open (same filter as the module
 *   bar), synonyms, a permission-gated action, employee lookup via the
 *   existing employee API, Ctrl+K, keyboard selection and recent pages.
 * - Employee portal header: only the portal pages the sidebar shows, "/"
 *   shortcut, and no employee lookup.
 * The API is mocked, so menus and permissions are exactly what each test says.
 */
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "none", typ: "JWT" })}.${b64(payload)}.sig`;
}

interface MenuLink {
  code: string;
  label: string;
  path: string;
}

const ravi = {
  id: 21,
  employeeCode: "EMP-000021",
  fullName: "Ravi Kumar",
  status: "ACTIVE",
  dateOfJoining: "2025-01-06",
  team: { id: 1, name: "Software" },
  designation: { id: 1, name: "Engineer" },
  employmentType: { id: 1, name: "Permanent" },
  reportsToId: null,
  hasLogin: true,
  onboardingStatus: "COMPLETE",
  onboardingReviewStatus: "APPROVED",
};

async function signIn(
  page: Page,
  opts: {
    permissions: string[];
    group: "hr" | "portal";
    menu: MenuLink[];
    landing: RegExp;
  },
): Promise<{ employeeSearches: string[] }> {
  const employeeSearches: string[] = [];
  await page.route(`${API}/**`, async (route: Route) => {
    const url = new URL(route.request().url());
    const { pathname } = url;
    const json = (status: number, body: unknown) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    if (pathname === "/auth/login") {
      return json(200, {
        data: {
          accessToken: jwt({ organizationId: 1, sub: 3 }),
          refreshToken: "r",
        },
      });
    }
    if (pathname === "/auth/me") {
      return json(200, {
        data: {
          userId: 3,
          organizationId: 1,
          email: "u@texawave.test",
          fullName: "Search User",
          roleIds: [2],
          permissions: opts.permissions,
        },
      });
    }
    if (pathname === "/employee/profile") {
      return json(200, {
        data: {
          id: 3,
          employeeCode: "EMP-000003",
          fullName: "Search User",
          onboardingStatus: "COMPLETE",
        },
      });
    }
    if (pathname === "/menu/my-menu") {
      return json(200, {
        data: [
          {
            id: 1,
            code: opts.group,
            label: opts.group === "hr" ? "HR" : "My Portal",
            path: null,
            icon: null,
            order: 1,
            parentId: null,
            permission: null,
            children: opts.menu.map((m, i) => ({
              id: i + 2,
              ...m,
              icon: null,
              order: i + 1,
              parentId: 1,
              permission: null,
              children: [],
            })),
          },
        ],
      });
    }
    if (pathname === "/hr/employees") {
      const search = url.searchParams.get("search") ?? "";
      employeeSearches.push(search);
      const rows =
        search && "ravi kumar emp-000021".includes(search.toLowerCase())
          ? [ravi]
          : [];
      return json(200, {
        data: rows,
        meta: { page: 1, limit: 5, total: rows.length, totalPages: 1 },
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
  await page.getByLabel("Email").fill("u@texawave.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("not-checked-by-mock");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(opts.landing);
  return { employeeSearches };
}

const search = (page: Page) =>
  page.getByRole("combobox", { name: "Search pages and people" });
const results = (page: Page) =>
  page.getByRole("listbox", { name: "Search results" });

test("HR workspace: role-filtered pages, synonyms, action, employee lookup, keyboard and recents", async ({
  page,
}) => {
  await signIn(page, {
    permissions: [
      "hr.workspace.access",
      "hr.employee.read.all",
      "hr.employee.write.all",
    ],
    group: "hr",
    menu: [
      { code: "hr-dashboard", label: "Dashboard", path: "/hr/dashboard" },
      { code: "hr-employees", label: "Employees", path: "/hr/employees" },
      { code: "hr-leaves", label: "Leaves", path: "/hr/leaves" },
    ],
    landing: /\/hr$/,
  });

  // Ctrl+K focuses the search from anywhere on the page.
  await page.locator("main").click();
  await page.keyboard.press("Control+k");
  await expect(search(page)).toBeFocused();

  // A synonym finds the page the role can open...
  await search(page).fill("staff");
  await expect(
    results(page).getByRole("option", { name: /Employees/ }),
  ).toBeVisible();
  await search(page).fill("new employee");
  await expect(
    results(page).getByRole("option", { name: /New employee/ }),
  ).toBeVisible();

  // Pages of modules this role cannot open are never offered.
  await search(page).fill("quotations");
  await expect(results(page)).toContainText('No matches for "quotations"');

  // Keyboard: Enter opens the highlighted page, which becomes a recent.
  await search(page).fill("leaves");
  await expect(
    results(page)
      .getByRole("option", { name: /Leaves/ })
      .first(),
  ).toBeVisible();
  await search(page).press("Enter");
  await expect(page).toHaveURL(/\/hr\/leaves$/);
  await search(page).focus();
  await expect(results(page)).toContainText("Recent");
  await expect(
    results(page).getByRole("option", { name: /Leaves/ }),
  ).toBeVisible();

  // Employee lookup through the employee API; choosing opens the record.
  await search(page).fill("ravi");
  const raviOption = results(page).getByRole("option", { name: /Ravi Kumar/ });
  await expect(raviOption).toBeVisible();
  await expect(raviOption).toContainText("EMP-000021");
  await raviOption.click();
  await expect(page).toHaveURL(/\/hr\/employees\/21$/);
});

test("employee portal header: only the portal pages the sidebar shows, '/' shortcut, no employee lookup", async ({
  page,
}) => {
  const { employeeSearches } = await signIn(page, {
    permissions: [
      "employee_self_service.profile.read",
      "employee_self_service.payslip.read",
    ],
    group: "portal",
    menu: [
      {
        code: "portal-payslips",
        label: "My Payslips",
        path: "/portal/payslips",
      },
      { code: "portal-leave", label: "Leave Tracker", path: "/portal/leave" },
    ],
    landing: /\/portal$/,
  });

  await page.locator("main").click();
  await page.keyboard.press("/");
  await expect(search(page)).toBeFocused();

  await search(page).fill("salary");
  await expect(
    results(page).getByRole("option", { name: /My Payslips/ }),
  ).toBeVisible();

  // Not in this employee's sidebar â†’ not offered.
  await search(page).fill("team leaves");
  await expect(results(page)).toContainText("No matches");

  // Portal search never looks up other employees.
  await search(page).fill("ravi");
  await expect(results(page)).toContainText("No matches");
  expect(employeeSearches).toEqual([]);

  await search(page).fill("salary");
  await search(page).press("Enter");
  await expect(page).toHaveURL(/\/portal\/payslips$/);
});
