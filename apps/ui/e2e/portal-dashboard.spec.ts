import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * The employee portal home (features/employee-self-service/dashboard): the
 * admin dashboard's cards scoped to the signed-in employee. The API is mocked,
 * so permissions, attendance, leave, tasks and hours are exactly as below.
 */
const API = "http://localhost:3000";

function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "none", typ: "JWT" })}.${b64(payload)}.sig`;
}

const TODAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
}).format(new Date());

function shift(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const ALL_PERMS = [
  "employee_self_service.profile.read",
  "employee_self_service.attendance.read",
  "employee_self_service.attendance.punch",
  "employee_self_service.leave_request.read",
  "employee_self_service.leave_request.create",
  "employee_self_service.task.read",
  "employee_self_service.timesheet.read",
  "hr.holiday.read",
];

let nextId = 1;
function node(
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

const MENU = [
  node(
    "portal",
    "My Portal",
    null,
    ["attendance", "leave", "tasks", "timesheet", "profile"].map((c) =>
      node(`portal-${c}`, c, `/portal/${c}`),
    ),
  ),
];

/** This month so far: weekdays present (one absent, one on leave), Sundays off, checked in today. */
function attendanceRows() {
  const rows = [];
  for (let d = `${TODAY.slice(0, 8)}01`; d <= TODAY; d = shift(d, 1)) {
    const weekday = new Date(`${d}T00:00:00Z`).getUTCDay();
    const isToday = d === TODAY;
    const n = Number(d.slice(8));
    const status =
      weekday === 0 && !isToday
        ? "WEEKLY_OFF"
        : isToday
          ? "PRESENT"
          : n === 2
            ? "ABSENT"
            : n === 3
              ? "ON_LEAVE"
              : "PRESENT";
    const checkInAt = isToday
      ? new Date(Date.now() - (2 * 3600 + 15 * 60) * 1000).toISOString()
      : `${d}T03:45:00.000Z`;
    rows.push({
      recordId: n,
      employeeId: 7,
      attendanceDate: d,
      storedStatus: null,
      status,
      targetMinutes: status === "WEEKLY_OFF" ? null : 480,
      workedMinutes: status === "PRESENT" && !isToday ? 470 : 0,
      overtimeMinutes: 0,
      shortfallMinutes: 0,
      hasOpenSession: isToday,
      pendingRegularization: false,
      sessions:
        status === "PRESENT"
          ? [
              {
                id: n,
                checkInAt,
                checkOutAt: isToday ? null : `${d}T12:35:00.000Z`,
                source: "WEB",
              },
            ]
          : [],
    });
  }
  return rows;
}

function timesheetMonth(month: string) {
  const days = [];
  for (
    let d = `${month}-01`;
    d.slice(0, 7) === month && d <= TODAY;
    d = shift(d, 1)
  ) {
    const weekday = new Date(`${d}T00:00:00Z`).getUTCDay();
    const worked = weekday === 0 ? 0 : d === TODAY ? 135 : 420;
    days.push({
      date: d,
      weekday: weekday === 0 ? 7 : weekday,
      attendanceStatus: weekday === 0 ? "WEEKLY_OFF" : "PRESENT",
      checkInAt: null,
      checkOutAt: null,
      workedMinutes: worked,
      targetMinutes: weekday === 0 ? null : 480,
      baseTargetMinutes: 480,
      permissions: [],
      permissionMinutes: 0,
      loggedMinutes: Math.max(0, worked - 30),
      reviewStatus: null,
      rowCount: 1,
    });
  }
  return {
    month,
    from: `${month}-01`,
    to: TODAY,
    summary: {
      presentDays: 14,
      absentDays: 1,
      leaveDays: 1,
      holidayDays: 0,
      loggedMinutes: 5400,
      workedMinutes: 6120,
      permissionMinutes: 0,
    },
    days,
  };
}

const page1 = (data: unknown[]) => ({
  data,
  meta: { page: 1, limit: 10, total: data.length, totalPages: 1 },
});
const ref = (id: number, name: string) => ({
  id,
  name,
  fullName: name,
  code: `E${id}`,
  employeeCode: `E${id}`,
});

function leave(
  id: number,
  code: string,
  name: string,
  start: string,
  days: number,
  status: string,
) {
  return {
    id,
    employee: ref(7, "Karthik"),
    leaveType: { id: code === "CL" ? 1 : 2, code, name },
    startDate: start,
    endDate: shift(start, days - 1),
    dayPortion: "FULL",
    leaveDays: days,
    calendarDays: days,
    reason: "Personal",
    status,
    approvalLevels: 1,
    awaiting: status === "PENDING" ? "TEAM_LEAD" : null,
  };
}

function task(
  id: number,
  title: string,
  status: string,
  priority: string,
  due: string,
  isOverdue: boolean,
) {
  return {
    id,
    title,
    description: null,
    status,
    priority,
    dueDate: due,
    isOverdue,
    awaitingApproval: false,
    assignee: ref(7, "Karthik"),
    assignedBy: ref(2, "Lead"),
    isEmployeeCreated: false,
    requestToAdmin: false,
    adminApproved: false,
    approvedBy: null,
    approvedAt: null,
    createdAt: TODAY,
    updatedAt: TODAY,
  };
}

async function signIn(page: Page, permissions: string[] = ALL_PERMS) {
  await page.route(`${API}/**`, async (route: Route) => {
    const url = new URL(route.request().url());
    const p = url.pathname;
    const json = (status: number, body: unknown) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    if (p === "/auth/login") {
      return json(200, {
        data: {
          accessToken: jwt({ organizationId: 1, sub: 1 }),
          refreshToken: "r",
        },
      });
    }
    if (p === "/auth/me") {
      return json(200, {
        data: {
          userId: 1,
          organizationId: 1,
          email: "karthik@texawave.test",
          fullName: "Karthik Subramanian",
          roleIds: [1],
          permissions,
        },
      });
    }
    if (p === "/employee/profile") {
      return json(200, {
        data: {
          id: 7,
          fullName: "Karthik Subramanian",
          employeeCode: "EMP-000007",
          onboardingStatus: "COMPLETE",
        },
      });
    }
    if (p === "/menu/my-menu") return json(200, { data: MENU });
    if (p === "/hr/attendance/mine") return json(200, page1(attendanceRows()));
    if (p === "/timesheets/my-month") {
      return json(200, {
        data: timesheetMonth(
          url.searchParams.get("month") ?? TODAY.slice(0, 7),
        ),
      });
    }
    if (p === "/self-service/leave-requests/balances") {
      return json(200, {
        data: [
          {
            leaveTypeId: 1,
            code: "CL",
            name: "Casual Leave",
            isPaid: true,
            year: 2026,
            opening: 0,
            entitlement: 12,
            accrued: 12,
            used: 4,
            pending: 1,
            available: 7,
          },
          {
            leaveTypeId: 2,
            code: "SL",
            name: "Sick Leave",
            isPaid: true,
            year: 2026,
            opening: 0,
            entitlement: 8,
            accrued: 8,
            used: 2,
            pending: 0,
            available: 6,
          },
          {
            leaveTypeId: 3,
            code: "LOP",
            name: "Loss of Pay",
            isPaid: false,
            year: 2026,
            opening: 0,
            entitlement: 0,
            accrued: 0,
            used: 0,
            pending: 0,
            available: null,
          },
        ],
      });
    }
    if (p === "/self-service/leave-requests") {
      return json(
        200,
        page1([
          leave(11, "CL", "Casual Leave", shift(TODAY, 9), 2, "APPROVED"),
          leave(10, "SL", "Sick Leave", shift(TODAY, 3), 1, "PENDING"),
          leave(9, "CL", "Casual Leave", shift(TODAY, -12), 1, "REJECTED"),
        ]),
      );
    }
    if (p === "/self-service/tasks") {
      return json(
        200,
        page1([
          task(
            1,
            "Update onboarding checklist",
            "IN_PROGRESS",
            "HIGH",
            shift(TODAY, -1),
            true,
          ),
          task(
            2,
            "Prepare sprint demo",
            "PENDING",
            "MEDIUM",
            shift(TODAY, 2),
            false,
          ),
          task(3, "Review API docs", "PENDING", "LOW", shift(TODAY, 5), false),
          task(4, "Old finished task", "DONE", "LOW", shift(TODAY, -9), false),
        ]),
      );
    }
    if (p === "/hr/holidays") {
      return json(
        200,
        page1([
          {
            id: 1,
            holidayDate: shift(TODAY, 6),
            name: "Founders Day",
            description: "Office closed",
            workLocation: null,
            isActive: true,
            createdAt: TODAY,
            updatedAt: TODAY,
          },
        ]),
      );
    }
    return json(404, {
      statusCode: 404,
      message: "Not mocked",
      error: "Not Found",
      path: p,
    });
  });

  await page.goto("/login");
  await page.getByLabel("Organization").fill("texawave-innovations");
  await page.getByLabel("Email").fill("karthik@texawave.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("not-checked-by-mock");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/portal$/);
}

const kpi = (page: Page, id: string) =>
  page.locator(`a[aria-labelledby="kpi-${id}"]`);
const tracker = (page: Page) =>
  page.locator('section[aria-labelledby="self-tracker-heading"]');

/** Optional screenshots for visual review: SHOT_DIR=<dir> pnpm test:e2e … */
async function shot(page: Page, name: string) {
  const dir = process.env.SHOT_DIR;
  if (dir)
    await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
}

test("shows the employee's own figures in the dashboard cards", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page);

  await expect(
    page.getByRole("heading", { level: 1, name: "Dashboard" }),
  ).toBeVisible();
  await expect(kpi(page, "present")).toContainText("Present Days");
  await expect(kpi(page, "present")).toContainText("1 absent · 1 on leave");
  // Paid balances only: 7 CL + 6 SL (unpaid LOP has no balance).
  await expect(kpi(page, "leave-balance")).toContainText("13");
  await expect(kpi(page, "leave-balance")).toContainText(
    "1 day(s) awaiting approval",
  );
  // DONE tasks are not open work.
  await expect(kpi(page, "open-tasks")).toContainText("3");
  await expect(kpi(page, "open-tasks")).toContainText("1 overdue");
  await expect(kpi(page, "hours-month")).toContainText("102");

  await expect(
    page.getByRole("heading", { name: "Working hours" }),
  ).toBeVisible();

  const tasks = page.locator('section[aria-labelledby="admin-list-heading"]');
  await expect(tasks).toContainText("Update onboarding checklist");
  await expect(tasks).toContainText("Overdue");
  await expect(tasks).not.toContainText("Old finished task");

  const leaves = page.locator(
    'section[aria-labelledby="admin-people-heading"]',
  );
  await expect(leaves).toContainText("Sick Leave");
  await expect(leaves).toContainText("Pending");

  // The next holiday comes before the approved leave.
  await expect(
    page.locator('section[aria-labelledby="admin-reminders-heading"]'),
  ).toContainText("Founders Day");

  await shot(page, "self-light");
});

test("the time tracker runs while checked in and shows progress to the target", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page);

  await expect(tracker(page)).toContainText("Working");
  await expect(tracker(page)).toContainText("of 8h today");
  await expect(tracker(page)).toContainText("28%");
  await expect(
    tracker(page).getByRole("button", { name: "Check Out" }),
  ).toBeVisible();

  const readTime = async () =>
    (await tracker(page).locator(".sr-only").innerText()).slice(0, 8);
  const first = await readTime();
  // Checked in 2h15m before the mock answered; allow for the round-trip.
  expect(first).toMatch(/^02:1[45]:\d\d$/);
  await expect.poll(readTime, { timeout: 4000 }).not.toBe(first);

  // 8h target − 2h15m worked; the finish time is projected from now.
  await expect(tracker(page)).toContainText("Time left");
  await expect(tracker(page)).toContainText(/5h 4[45]m/);
  await expect(tracker(page)).toContainText("Expected finish");

  // The clock's second hand advances (the last of the three hands).
  const secondHand = tracker(page)
    .locator('div[aria-hidden="true"][style*="rotate"]')
    .last();
  const angle = async () =>
    Number(
      /rotate\(([\d.]+)deg\)/.exec(
        (await secondHand.getAttribute("style")) ?? "",
      )?.[1] ?? 0,
    );
  const before = await angle();
  await expect.poll(angle, { timeout: 4000 }).toBeGreaterThan(before);
  await shot(page, "self-tracker");
});

test("a card the employee cannot read says so instead of failing", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(
    page,
    ALL_PERMS.filter((p) => p !== "employee_self_service.task.read"),
  );

  await expect(
    page.locator('section[aria-labelledby="admin-list-heading"]'),
  ).toContainText("You don't have access to open tasks.");
  // The other cards still load.
  await expect(kpi(page, "present")).toContainText("Present Days");
});

test("has no horizontal overflow on a phone and in dark mode", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page);
  await expect(tracker(page)).toContainText("Working");
  await page.getByRole("button", { name: /dark/i }).first().click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  // Let the theme transition and counters settle before any screenshot.
  if (process.env.SHOT_DIR) await page.waitForTimeout(1500);
  await shot(page, "self-dark");
  await page.getByRole("button", { name: /light/i }).first().click();

  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(200);
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  await shot(page, "self-mobile");
});
