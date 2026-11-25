import { expect, type Page, type Route, test } from "@playwright/test";
import { API, page1 } from "./helpers/mock-api";

/**
 * Task form: the ETA is a required, hand-entered number of hours (no Auto
 * default, no business-days x 8), and the reward points follow the Points
 * Master switch. A Team Lead (team-scoped writer) can only pick an employee of
 * their own team. API fully mocked - the backend rules (ETA validation, audit,
 * points maths, team scoping) are proven by
 * apps/api/test/projects-task-points.e2e-spec.ts.
 */

const project = {
  id: 1,
  projectCode: "TW/PRJ/ME/26-27/001",
  name: "Panel build",
  customerName: "Acme",
  expectedHours: 100,
  projectPrice: 1000,
  actualCost: 0,
  status: "active",
  startDate: "2026-10-01",
  plannedEndDate: "2026-12-31",
  departments: [],
  members: [
    {
      id: 1,
      projectId: 1,
      employeeId: 90,
      role: "Contributor",
      loggedHours: 0,
      estimatedHours: 0,
      hourlyRate: 0,
      employee: { id: 90, fullName: "Outside Member", employeeCode: "EMP-090" },
    },
  ],
  milestones: [],
  tasks: [],
  expenses: [],
};

const teamMember = {
  id: 7,
  fullName: "Team Member",
  employeeCode: "EMP-007",
  team: { id: 3, name: "Team A" },
};

const config = (timeBasedEnabled: boolean) => ({
  id: 1,
  low: 5,
  medium: 10,
  high: 20,
  urgent: 30,
  customRules: {},
  timeBasedEnabled,
  defaultTaskPoints: 10,
  onTimeBonus: 1,
  graceMinutes: 5,
});

/** A bearer the app can decode (it reads organizationId and sub); the mocked
 * API never verifies it. */
function fakeJwt(): string {
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "none", typ: "JWT" })}.${b64({ organizationId: 1, sub: 1 })}.sig`;
}

interface Setup {
  permissions: string[];
  timeBased: boolean;
}

/** Signs in as an onboarded employee with the given permissions against a
 * fully mocked API (own sign-in rather than the shared helper, whose HR
 * workspace answers /employee/profile with 404), then reaches the project by
 * client-side navigation only: the access token lives in memory. Returns the
 * recorded API calls. */
async function openAddTask(
  page: Page,
  { permissions, timeBased }: Setup,
): Promise<{ calls: string[] }> {
  const calls: string[] = [];
  await page.route(`${API}/**`, async (route: Route) => {
    const req = route.request();
    const { pathname: p, search } = new URL(req.url());
    const method = req.method();
    const json = (status: number, body: unknown) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    const tokens = {
      data: { accessToken: fakeJwt(), refreshToken: "r" },
    };
    if (p === "/auth/login") return json(200, tokens);
    if (p === "/auth/refresh") return json(201, tokens);
    if (p === "/auth/me")
      return json(200, {
        data: {
          userId: 1,
          organizationId: 1,
          email: "staff@texawave.test",
          fullName: "Staff Member",
          roleIds: [2],
          permissions,
        },
      });
    if (p === "/employee/profile")
      return json(200, {
        data: {
          id: 8,
          employeeCode: "EMP-000008",
          fullName: "Staff Member",
          onboardingStatus: "COMPLETE",
        },
      });
    if (p === "/menu/my-menu") {
      const links = [
        ["projects-dashboard", "Projects Dashboard", "/projects/dashboard"],
        ["projects-list", "All Projects", "/projects/list"],
      ] as const;
      return json(200, {
        data: [
          {
            id: 1,
            code: "hr",
            label: "HR",
            path: null,
            icon: null,
            order: 1,
            parentId: null,
            permission: null,
            children: links.map(([code, label, path], i) => ({
              id: i + 2,
              code,
              label,
              path,
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
    let body = "";
    try {
      body = JSON.stringify(req.postDataJSON());
    } catch {
      body = "";
    }
    calls.push(`${method} ${p}${search}${body ? ` ${body}` : ""}`);
    if (method === "GET" && p === "/projects")
      return json(200, page1([project]));
    if (method === "GET" && p === "/projects/1")
      return json(200, { data: project });
    if (method === "GET" && p === "/projects/points/config")
      return json(200, { data: config(timeBased) });
    if (method === "GET" && p === "/hr/employees")
      return json(200, page1([teamMember]));
    if (method === "POST" && p === "/projects/1/tasks")
      return json(201, { data: { id: 55 } });
    return json(404, {
      statusCode: 404,
      message: "Not mocked",
      error: "Not Found",
      path: p,
    });
  });

  await page.goto("/login");
  await page.getByLabel("Organization").fill("texawave-innovations");
  await page.getByLabel("Email").fill("staff@texawave.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("not-checked-by-mock");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/hr/);

  await page
    .getByRole("navigation", { name: "Main application navigation" })
    .getByRole("button", { name: "Projects", exact: true })
    .click();
  await expect(page).toHaveURL(/\/projects\/dashboard/);
  // The category flyout re-renders while the dashboard loads, so click the
  // link in the page itself (still a client-side Next link) and retry.
  await expect(async () => {
    await page
      .getByRole("link", { name: "All Projects" })
      .first()
      .evaluate((el) => (el as HTMLElement).click());
    await expect(page).toHaveURL(/\/projects\/list/, { timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
  await page.getByRole("table").getByRole("link").first().click();
  await expect(page).toHaveURL(/\/projects\/1$/);
  await page.getByRole("button", { name: "Add Task" }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  return { calls };
}

const ADMIN = [
  "hr.workspace.access",
  "projects.project.read",
  "projects.task.write",
];
const LEAD = [
  "hr.workspace.access",
  "projects.project.read",
  "projects.task_assignment.write.team",
];

test.describe("Task form: ETA and reward points", () => {
  test("the ETA is empty, required and not derived from the dates", async ({
    page,
  }) => {
    const { calls } = await openAddTask(page, {
      permissions: ADMIN,
      timeBased: true,
    });
    const dialog = page.getByRole("dialog");
    const eta = dialog.getByLabel(/Estimated hours/);
    await expect(eta).toHaveValue("");
    await expect(dialog.getByText("Auto", { exact: true })).toHaveCount(0);
    await expect(dialog.getByText(/The dates allow up to \d+h/)).toBeVisible();

    await dialog.getByLabel("Task Title").fill("Wire the panel");
    await dialog.getByRole("button", { name: /Create Task/ }).click();
    await expect(dialog.getByText(/Enter the ETA in hours/)).toBeVisible();
    expect(calls.some((c) => c.startsWith("POST /projects/1/tasks"))).toBe(
      false,
    );

    // A step that is not a quarter hour is refused too.
    await eta.fill("2.1");
    await dialog.getByRole("button", { name: /Create Task/ }).click();
    await expect(dialog.getByText(/Enter the ETA in hours/)).toBeVisible();
  });

  test("time-based points: fixed points, a live reward line, ETA sent and no points sent", async ({
    page,
  }) => {
    const { calls } = await openAddTask(page, {
      permissions: ADMIN,
      timeBased: true,
    });
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Task Title").fill("Wire the panel");
    await dialog.getByLabel(/Estimated hours/).fill("2");

    const reward = dialog.getByLabel("Reward Points");
    await expect(reward).toBeDisabled();
    await expect(reward).toHaveValue("10");
    await expect(
      dialog.getByText(
        "10 pts. +1 if done within 2h; fewer the longer it takes; 0 at 4h.",
      ),
    ).toBeVisible();

    await dialog.getByRole("button", { name: /Create Task/ }).click();
    await expect
      .poll(() => calls.find((c) => c.startsWith("POST /projects/1/tasks")))
      .toBeTruthy();
    const post = calls.find((c) => c.startsWith("POST /projects/1/tasks"))!;
    expect(post).toContain('"hoursToComplete":2');
    expect(post).not.toContain('"points"');
  });

  test("with time-based points off, points stay editable and are sent", async ({
    page,
  }) => {
    const { calls } = await openAddTask(page, {
      permissions: ADMIN,
      timeBased: false,
    });
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Task Title").fill("Wire the panel");
    await dialog.getByLabel(/Estimated hours/).fill("3.5");
    const reward = dialog.getByLabel("Reward Points");
    await expect(reward).toBeEnabled();
    await dialog.getByRole("button", { name: /Create Task/ }).click();
    await expect
      .poll(() => calls.find((c) => c.startsWith("POST /projects/1/tasks")))
      .toBeTruthy();
    const post = calls.find((c) => c.startsWith("POST /projects/1/tasks"))!;
    expect(post).toContain('"hoursToComplete":3.5');
    expect(post).toContain('"points":10');
  });

  test("a team lead can only pick their own team and must assign someone", async ({
    page,
  }) => {
    await openAddTask(page, { permissions: LEAD, timeBased: true });
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("combobox", { name: /Assignee/ }).click();
    const options = page.getByRole("option");
    await expect(options.filter({ hasText: /Team Member/ })).toHaveCount(1);
    // The project's own member from another team is not offered.
    await expect(options.filter({ hasText: /Outside Member/ })).toHaveCount(0);
    await page.keyboard.press("Escape");

    await dialog.getByLabel("Task Title").fill("Wire the panel");
    await dialog.getByLabel(/Estimated hours/).fill("2");
    await dialog.getByRole("button", { name: /Create Task/ }).click();
    await expect(
      dialog.getByText(/Choose an employee from your team/),
    ).toBeVisible();
  });
});
