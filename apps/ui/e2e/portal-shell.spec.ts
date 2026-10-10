import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * Which shell a signed-in employee gets (Docs/MENU_NAVIGATION_API.md §5.1):
 * Employees and Team Leads work in the portal — whatever hr.* team reads
 * their role holds — and see exactly the portal tabs their menu returns;
 * only `hr.workspace.access` opens the HR workspace. The API is mocked, so
 * the menu and permissions are exactly what each test says.
 */
const API = "http://localhost:3000";

function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "none", typ: "JWT" })}.${b64(payload)}.sig`;
}

let nextId = 1;
function menuNode(
  code: string,
  label: string,
  path: string | null,
  children: unknown[] = [],
) {
  return {
    id: nextId++,
    code,
    label,
    path,
    icon: null,
    order: nextId,
    parentId: null,
    permission: null,
    children,
  };
}

const TEAM_LEAD_PERMS = [
  "employee_self_service.profile.read",
  "employee_self_service.leave_request.read",
  "hr.attendance.read.team",
  "hr.leave_request.read.team",
  "hr.task.read.team",
  "hr.task.write.team",
  "hr.holiday.read",
];

async function signIn(
  page: Page,
  permissions: string[],
  menu: unknown[],
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
          email: "karthi@texawave.test",
          fullName: "Karthi",
          roleIds: [1],
          permissions,
        },
      });
    }
    if (pathname === "/employee/profile") {
      return json(200, {
        data: {
          id: 7,
          fullName: "Karthi",
          employeeCode: "EMP-000007",
          onboardingStatus: "COMPLETE",
        },
      });
    }
    if (pathname === "/menu/my-menu") {
      return json(200, { data: menu });
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
  await page.getByLabel("Email").fill("karthi@texawave.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("not-checked-by-mock");
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("a team lead lands in the portal and sees only their granted tabs", async ({
  page,
}) => {
  await signIn(page, TEAM_LEAD_PERMS, [
    menuNode("portal", "My Portal", null, [
      menuNode("portal-profile", "My Profile", "/portal/profile"),
      menuNode(
        "portal-task-assignment",
        "Task Assignment",
        "/portal/task-assignment",
      ),
      menuNode(
        "portal-team-attendance",
        "Team Attendance",
        "/portal/team-attendance",
      ),
    ]),
  ]);

  // hr.* team reads alone no longer send anyone to the HR workspace.
  await expect(page).toHaveURL(/\/portal$/);
  const nav = page.getByRole("navigation", { name: "My Portal Navigation" });
  for (const label of ["My Profile", "Task Assignment", "Team Attendance"]) {
    await expect(nav.getByRole("link", { name: label })).toBeVisible();
  }
  // A tab the role was not granted is not there.
  await expect(nav.getByRole("link", { name: "Team Leaves" })).toHaveCount(0);
  // No HR workspace chrome at all.
  await expect(
    page.getByRole("navigation", { name: "Human Resources Navigation" }),
  ).toHaveCount(0);

  await nav.getByRole("link", { name: "Team Attendance" }).click();
  await expect(page).toHaveURL(/\/portal\/team-attendance$/);
});

test("the HR workspace sends a portal-only user back to the portal", async ({
  page,
}) => {
  // A (mis)configured link into /hr: the dashboard layout must still refuse.
  await signIn(page, TEAM_LEAD_PERMS, [
    menuNode("portal", "My Portal", null, [
      menuNode("portal-stray", "HR Dashboard", "/hr/dashboard"),
    ]),
  ]);
  await expect(page).toHaveURL(/\/portal$/);

  await page
    .getByRole("navigation", { name: "My Portal Navigation" })
    .getByRole("link", { name: "HR Dashboard" })
    .click();
  await expect(page).toHaveURL(/\/portal$/);
  await expect(
    page.getByRole("navigation", { name: "Human Resources Navigation" }),
  ).toHaveCount(0);
});

test("hr.workspace.access lands an employee in the HR workspace", async ({
  page,
}) => {
  await signIn(
    page,
    ["hr.workspace.access", ...TEAM_LEAD_PERMS],
    [
      menuNode("hr", "HR", null, [
        menuNode("hr-dashboard", "Dashboard", "/hr/dashboard"),
      ]),
    ],
  );

  await expect(page).toHaveURL(/\/hr$/);
  await expect(
    page
      .getByRole("navigation", { name: "Human Resources Navigation" })
      .locator("a[href='/hr/dashboard']"),
  ).toBeVisible();
});
