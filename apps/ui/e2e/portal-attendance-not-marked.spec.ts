import { expect, test, type Page, type Route } from "@playwright/test";
import { selectCombobox } from "./helpers/combobox";

/**
 * Portal attendance labels (MyAttendanceTrackerView / classifyDay): a past
 * working day with no check-in — or the API's NOT_MARKED — is "Not marked",
 * matching HR's month view, and only the API's ABSENT (HR recorded it) is
 * "Absent". Days before the joining date are blank. The API is mocked; the
 * previous month is used so every date is in the past whatever day this runs.
 */
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "none", typ: "JWT" })}.${b64(payload)}.sig`;
}

const iso = (d: Date) => new Intl.DateTimeFormat("en-CA").format(d);

/** Previous month's non-Sunday days from `fromDay`, as YYYY-MM-DD. */
function previousMonthWorkdays(fromDay: number): string[] {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const days: string[] = [];
  for (
    let d = new Date(first.getFullYear(), first.getMonth(), fromDay);
    d.getMonth() === first.getMonth();
    d.setDate(d.getDate() + 1)
  ) {
    if (d.getDay() !== 0) days.push(iso(d));
  }
  return days;
}

function row(date: string, status: string, sessions: unknown[] = []) {
  return {
    recordId: sessions.length > 0 ? 1 : null,
    employeeId: 7,
    attendanceDate: date,
    storedStatus: status === "ABSENT" ? "ABSENT" : null,
    status,
    targetMinutes: 480,
    workedMinutes: 0,
    overtimeMinutes: 0,
    shortfallMinutes: 0,
    hasOpenSession: false,
    pendingRegularization: sessions.length > 0,
    sessions,
  };
}

async function signInToPortal(page: Page, rows: unknown[], joinedOn: string) {
  await page.route(`${API}/**`, async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const json = (status: number, body: unknown) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    const { pathname } = url;

    if (pathname === "/auth/login") {
      return json(200, {
        data: {
          accessToken: jwt({ organizationId: 1, sub: 7 }),
          refreshToken: "r",
        },
      });
    }
    if (pathname === "/auth/me") {
      return json(200, {
        data: {
          userId: 7,
          organizationId: 1,
          email: "emp@texawave.test",
          fullName: "Meena Iyer",
          roleIds: [4],
          permissions: [
            "employee_self_service.profile.read",
            "employee_self_service.attendance.read",
          ],
        },
      });
    }
    if (pathname === "/employee/profile") {
      return json(200, {
        data: {
          id: 7,
          employeeCode: "EMP-000007",
          fullName: "Meena Iyer",
          onboardingStatus: "COMPLETE",
          dateOfJoining: joinedOn,
          workLocation: null,
        },
      });
    }
    if (pathname === "/menu/my-menu") {
      return json(200, {
        data: [
          {
            id: 1,
            code: "portal",
            label: "My Portal",
            path: null,
            icon: null,
            order: 1,
            parentId: null,
            permission: null,
            children: [
              {
                id: 2,
                code: "portal-attendance",
                label: "Attendance",
                path: "/portal/attendance",
                icon: null,
                order: 1,
                parentId: 1,
                permission: null,
                children: [],
              },
            ],
          },
        ],
      });
    }
    if (pathname === "/hr/attendance/mine") {
      const from = url.searchParams.get("from") ?? "";
      const to = url.searchParams.get("to") ?? "9999-12-31";
      const inRange = (rows as { attendanceDate: string }[]).filter(
        (r) => r.attendanceDate >= from && r.attendanceDate <= to,
      );
      return json(200, {
        data: inRange,
        meta: { page: 1, limit: 100, total: inRange.length, totalPages: 1 },
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
  await page.getByLabel("Email").fill("emp@texawave.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("not-checked-by-mock");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/portal$/);
  await page
    .getByRole("navigation", { name: "My Portal Navigation" })
    .getByRole("link", { name: "Attendance", exact: true })
    .click();
  await expect(page).toHaveURL(/\/portal\/attendance$/);
}

test("past days with no check-in are 'Not marked', only HR's ABSENT is 'Absent', and pre-joining days are blank", async ({
  page,
}) => {
  // Joined on the 10th of last month; everything before is not a working day.
  const workdays = previousMonthWorkdays(10);
  const joinedOn = workdays[0]!;
  const absentDay = workdays[1]!; // HR recorded ABSENT
  const autoClosedDay = workdays[2]!; // NOT_MARKED: auto-checkout awaiting HR
  const rows = [
    row(absentDay, "ABSENT"),
    row(autoClosedDay, "NOT_MARKED", [
      {
        id: 11,
        checkInAt: `${autoClosedDay}T04:30:00.000Z`,
        checkOutAt: `${autoClosedDay}T13:30:00.000Z`,
        source: "SYSTEM",
      },
    ]),
  ];

  await signInToPortal(page, rows, joinedOn);
  await page.getByRole("button", { name: "Month" }).click();
  await page.getByRole("button", { name: "Previous month" }).click();

  // Every working day from joining onwards except the ABSENT one is unmarked
  // (the auto-closed day included); nothing before joining is counted.
  const expectedUnmarked = workdays.length - 1;
  await expect(
    page.getByText("Absent Days", { exact: true }).locator(".."),
  ).toContainText("1 Days");
  await expect(
    page.getByText("Not Marked", { exact: true }).locator(".."),
  ).toContainText(`${expectedUnmarked} Days`);
  await expect(page.getByText("NM", { exact: true })).toHaveCount(
    expectedUnmarked,
  );

  // The "Not marked" filter keeps exactly those days.
  const main = page.locator("main");
  await selectCombobox(main, "Status filter", "Not marked");
  await expect(page.getByText("NM", { exact: true })).toHaveCount(
    expectedUnmarked,
  );
  await selectCombobox(main, "Status filter", "Absent");
  await expect(page.getByText("NM", { exact: true })).toHaveCount(0);
});
