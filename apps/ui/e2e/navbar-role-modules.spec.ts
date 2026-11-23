import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * The top module bar (HorizontalNavbar) shows only the modules a role can
 * use: a module appears when at least one of its entries passes the menu /
 * permission filter, and the Master List shows only the masters the user can
 * read (features/masters/master-permissions.ts). The bar is left-aligned
 * after the logo. The API is mocked, so the menu and permissions are exactly
 * what each test says; the user is an onboarded employee, like a real HR
 * Manager or Sales hire.
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

async function signIn(
  page: Page,
  options: { permissions: string[]; group: "hr" | "sales"; menu: MenuLink[] },
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
          accessToken: jwt({ organizationId: 1, sub: 8 }),
          refreshToken: "r",
        },
      });
    }
    if (pathname === "/auth/me") {
      return json(200, {
        data: {
          userId: 8,
          organizationId: 1,
          email: "staff@texawave.test",
          fullName: "Staff Member",
          roleIds: [2],
          permissions: options.permissions,
        },
      });
    }
    if (pathname === "/employee/profile") {
      return json(200, {
        data: {
          id: 8,
          employeeCode: "EMP-000008",
          fullName: "Staff Member",
          onboardingStatus: "COMPLETE",
        },
      });
    }
    if (pathname === "/menu/my-menu") {
      return json(200, {
        data: [
          {
            id: 1,
            code: options.group,
            label: options.group === "hr" ? "HR" : "Sales",
            path: null,
            icon: null,
            order: 1,
            parentId: null,
            permission: null,
            children: options.menu.map((m, i) => ({
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
    return json(404, {
      statusCode: 404,
      message: "Not mocked",
      error: "Not Found",
      path: pathname,
    });
  });

  await page.goto("/login");
  await page.getByLabel("Organization").fill("texawave-innovations");
  await page.getByLabel("Email").fill("staff@texawave.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("not-checked-by-mock");
  await page.getByRole("button", { name: "Sign in" }).click();
}

const ALL_MODULES = [
  "Dashboard",
  "Human Resources",
  "Sales",
  "Finance",
  "SCM",
  "CRM",
  "Purchases",
  "Projects",
  "Master List",
  "Settings",
];

const HR_MANAGER_PERMS = [
  "hr.workspace.access",
  "hr.employee.read.all",
  "master.designation.read",
  "master.work_location.read",
  "master.shift.read",
  "hr.leave_type.read",
];

test("an HR Manager sees only Dashboard, Human Resources and Master List (HR Master only), left-aligned", async ({
  page,
}) => {
  await signIn(page, {
    permissions: HR_MANAGER_PERMS,
    group: "hr",
    menu: [
      { code: "hr-dashboard", label: "Dashboard", path: "/hr/dashboard" },
      { code: "hr-employees", label: "Employees", path: "/hr/employees" },
    ],
  });
  await expect(page).toHaveURL(/\/hr$/);

  const rail = page.getByRole("navigation", {
    name: "Main application navigation",
  });
  const expected = ["Dashboard", "Human Resources", "Master List"];
  for (const label of expected) {
    await expect(
      rail.getByRole("button", { name: label, exact: true }),
    ).toBeVisible();
  }
  for (const label of ALL_MODULES.filter((l) => !expected.includes(l))) {
    await expect(
      rail.getByRole("button", { name: label, exact: true }),
    ).toHaveCount(0);
  }

  // The rail sits on the left, right after the logo — not centred.
  const viewport = page.viewportSize();
  const firstButton = await rail
    .getByRole("button", { name: "Dashboard", exact: true })
    .boundingBox();
  expect(viewport && firstButton).toBeTruthy();
  expect(firstButton!.x).toBeLessThan(viewport!.width / 3);

  // Master List offers HR Master only.
  await rail.getByRole("button", { name: "Master List", exact: true }).click();
  const masters = page.getByRole("menu", { name: "Master List categories" });
  await expect(masters.getByText("HR Master")).toBeVisible();
  for (const other of [
    "Sales & Document Masters",
    "Finance Master",
    "Projects Master",
    "SCM Master",
  ]) {
    await expect(masters.getByText(other)).toHaveCount(0);
  }
});

test("a Sales user sees Sales but no HR, Dashboard, Master List or Settings", async ({
  page,
}) => {
  await signIn(page, {
    permissions: ["sales.dashboard.read", "sales.customer.read"],
    group: "sales",
    menu: [
      { code: "sales-dashboard", label: "Dashboard", path: "/sales/dashboard" },
      { code: "sales-customers", label: "Customers", path: "/sales/customers" },
    ],
  });
  await expect(page).toHaveURL(/\/sales\/dashboard/);

  const rail = page.getByRole("navigation", {
    name: "Main application navigation",
  });
  await expect(
    rail.getByRole("button", { name: "Sales", exact: true }),
  ).toBeVisible();
  for (const label of [
    "Dashboard",
    "Human Resources",
    "Master List",
    "Settings",
  ]) {
    await expect(
      rail.getByRole("button", { name: label, exact: true }),
    ).toHaveCount(0);
  }
});
