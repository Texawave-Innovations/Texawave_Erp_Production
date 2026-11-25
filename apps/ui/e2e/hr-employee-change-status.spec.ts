import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * The "Change status" button on the employee detail page (EmployeeDetailView)
 * — the only UI for resigning or terminating an employee. It is shown to
 * holders of hr.employee_status.write while the employee is Active/Inactive,
 * and becomes the Super-Admin-only "Correct status" once they have left. The
 * API is mocked (its lifecycle rules and the login deactivation are covered
 * by apps/api tests); this proves what the UI offers and sends.
 */
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "none", typ: "JWT" })}.${b64(payload)}.sig`;
}

const ref = (id: number, name: string) => ({ id, name });

function employee(status: string) {
  return {
    id: 21,
    employeeCode: "EMP-000021",
    fullName: "Ravi Kumar",
    status,
    dateOfJoining: "2025-01-06",
    team: ref(1, "Software"),
    designation: ref(1, "Engineer"),
    employmentType: ref(1, "Permanent"),
    reportsToId: null,
    hasLogin: true,
    onboardingStatus: "COMPLETE",
    onboardingReviewStatus: "APPROVED",
    avatarUrl: null,
    workEmail: "ravi.kumar@texawave.test",
    phone: "9841055667",
    department: null,
    workLocation: null,
    reportsTo: null,
    userId: 30,
    probationEndDate: null,
    confirmationDate: null,
    referredBy: null,
    workDomain: null,
    onboardingSubmittedAt: null,
    onboardingReviewedAt: null,
    onboardingReviewedBy: null,
    onboardingReviewNote: null,
    dateOfExit: status === "RESIGNED" ? "2026-11-30" : null,
    exitReason: status === "RESIGNED" ? "Relocating" : null,
    isActive: status === "ACTIVE",
    version: 1,
    createdAt: "2025-01-06T00:00:00.000Z",
    updatedAt: "2025-01-06T00:00:00.000Z",
  };
}

/** Signs in as an onboarded HR employee against a mocked API, then opens
 * Ravi Kumar's record by clicking through the app (tokens are in memory, so
 * no `page.goto` to a protected URL). Returns the POSTed status changes. */
async function openEmployee(
  page: Page,
  permissions: string[],
  initialStatus: string,
): Promise<{ statusPosts: { path: string; body: unknown }[] }> {
  const statusPosts: { path: string; body: unknown }[] = [];
  let status = initialStatus;

  await page.route(`${API}/**`, async (route: Route) => {
    const req = route.request();
    const { pathname } = new URL(req.url());
    const method = req.method();
    const json = (code: number, body: unknown) =>
      route.fulfill({
        status: code,
        contentType: "application/json",
        body: JSON.stringify(body),
      });

    if (pathname === "/auth/login") {
      return json(200, {
        data: {
          accessToken: jwt({ organizationId: 1, sub: 2 }),
          refreshToken: "r",
        },
      });
    }
    if (pathname === "/auth/me") {
      return json(200, {
        data: {
          userId: 2,
          organizationId: 1,
          email: "hr@texawave.test",
          fullName: "HR Person",
          roleIds: [2],
          permissions,
        },
      });
    }
    if (pathname === "/employee/profile") {
      return json(200, {
        data: {
          id: 2,
          employeeCode: "EMP-000002",
          fullName: "HR Person",
          onboardingStatus: "COMPLETE",
        },
      });
    }
    if (pathname === "/menu/my-menu") {
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
            children: [
              {
                id: 2,
                code: "hr-dashboard",
                label: "Dashboard",
                path: "/hr/dashboard",
                icon: null,
                order: 1,
                parentId: 1,
                permission: null,
                children: [],
              },
              {
                id: 3,
                code: "hr-employees",
                label: "Employees",
                path: "/hr/employees",
                icon: null,
                order: 2,
                parentId: 1,
                permission: null,
                children: [],
              },
            ],
          },
        ],
      });
    }
    if (pathname === "/hr/employees" && method === "GET") {
      return json(200, {
        data: [employee(status)],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });
    }
    if (pathname === "/hr/employees/21" && method === "GET") {
      return json(200, { data: employee(status) });
    }
    if (pathname === "/hr/employees/21/status-history") {
      return json(200, {
        data: [],
        meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
      });
    }
    if (
      method === "POST" &&
      (pathname === "/hr/employees/21/status" ||
        pathname === "/hr/employees/21/status-correction")
    ) {
      const body = req.postDataJSON() as { status: string };
      statusPosts.push({ path: pathname, body });
      status = body.status;
      return json(201, { data: employee(status) });
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
  await page.getByLabel("Email").fill("hr@texawave.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("not-checked-by-mock");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/hr$/);

  // HR dashboard → Employees (the TOTAL EMPLOYEES card links there) → record.
  await page.locator("main a[href='/hr/employees']").first().click();
  await expect(page).toHaveURL(/\/hr\/employees$/);
  await page.getByText("Ravi Kumar").first().click();
  await expect(page).toHaveURL(/\/hr\/employees\/21$/);
  await expect(page.getByRole("heading", { name: "Ravi Kumar" })).toBeVisible();

  return { statusPosts };
}

const HR_BASE = [
  "hr.workspace.access",
  "hr.employee.read.all",
  "hr.employee.write.all",
];

test("HR resigns an active employee from the detail page, warned that access ends on save", async ({
  page,
}) => {
  const { statusPosts } = await openEmployee(
    page,
    [...HR_BASE, "hr.employee_status.write"],
    "ACTIVE",
  );

  await page.getByRole("button", { name: "Change status" }).click();
  const dialog = page.getByRole("dialog", { name: "Change employment status" });
  await expect(dialog).toBeVisible();

  // Inactive pauses portal access (reversible); an exit ends it.
  await dialog.getByLabel(/^New status/).selectOption("INACTIVE");
  await expect(
    dialog.getByText("Portal access pauses while inactive"),
  ).toBeVisible();
  await dialog.getByLabel(/^New status/).selectOption("RESIGNED");
  await expect(
    dialog.getByText("Portal access pauses while inactive"),
  ).toHaveCount(0);
  await expect(
    dialog.getByText("Portal access ends when you save"),
  ).toBeVisible();
  await dialog.getByLabel(/^Last working day/).fill("2026-11-30");
  await dialog.getByLabel(/^Reason/).fill("Relocating to another city");
  await dialog.getByRole("button", { name: "Save status" }).click();

  await expect(dialog).toHaveCount(0);
  expect(statusPosts).toEqual([
    {
      path: "/hr/employees/21/status",
      body: {
        status: "RESIGNED",
        effectiveDate: "2026-11-30",
        reason: "Relocating to another city",
      },
    },
  ]);
  // Once resigned, a status writer without the correction permission gets
  // no further status action.
  await expect(page.getByRole("button", { name: "Change status" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "Correct status" }),
  ).toHaveCount(0);
});

test("no status button without hr.employee_status.write", async ({ page }) => {
  await openEmployee(page, HR_BASE, "ACTIVE");
  await expect(page.getByRole("button", { name: "Change status" })).toHaveCount(
    0,
  );
});

test("a resigned employee offers only the audited correction, to its permission holder", async ({
  page,
}) => {
  const { statusPosts } = await openEmployee(
    page,
    [...HR_BASE, "hr.employee_status.write", "hr.employee_status.correct"],
    "RESIGNED",
  );

  await expect(page.getByRole("button", { name: "Change status" })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Correct status" }).click();
  const dialog = page.getByRole("dialog", {
    name: "Correct employment status",
  });
  await dialog.getByLabel(/^New status/).selectOption("ACTIVE");
  await expect(
    dialog.getByText("Portal access ends when you save"),
  ).toHaveCount(0);
  await dialog.getByLabel(/^Reason/).fill("Resignation withdrawn");
  await dialog.getByRole("button", { name: "Save status" }).click();

  await expect(dialog).toHaveCount(0);
  expect(statusPosts).toHaveLength(1);
  expect(statusPosts[0]?.path).toBe("/hr/employees/21/status-correction");
});
