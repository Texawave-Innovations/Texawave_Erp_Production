import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * The portal's Tasks and Tickets tabs render the one complete self-service
 * screen (features/hr/{tasks,tickets}/components/My*View), not the cut-down
 * copies they replaced — Docs/EMPLOYEE_SELF_SERVICE_API.md §4. The API is
 * mocked; `posts` records what the screens send.
 */
const API = "http://localhost:3000";

function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "none", typ: "JWT" })}.${b64(payload)}.sig`;
}

const PERMS = [
  "employee_self_service.profile.read",
  "employee_self_service.task.read",
  "employee_self_service.task.create",
  "employee_self_service.task.update_status",
  "employee_self_service.ticket.read",
  "employee_self_service.ticket.create",
  "employee_self_service.ticket.update",
];

const ME = { id: 7, fullName: "Karthi" };
const HR = { id: 2, fullName: "Priya Nair" };
const NOW = "2026-10-01T09:00:00.000Z";

const NOTICE = {
  id: 9,
  category: "Notice",
  subject: "Laptop return",
  description: "Please return the old laptop by Friday.",
  status: "OPEN",
  isActive: true,
  raisedByAdmin: true,
  raisedBy: HR,
  employee: ME,
  resolvedAt: null,
  createdAt: NOW,
  updatedAt: NOW,
};

function task(id: number, title: string, extra: Record<string, unknown>) {
  return {
    id,
    title,
    description: null,
    status: "PENDING",
    priority: "URGENT",
    dueDate: "2026-10-20",
    isOverdue: false,
    awaitingApproval: false,
    assignee: ME,
    assignedBy: HR,
    isEmployeeCreated: false,
    requestToAdmin: false,
    adminApproved: false,
    approvedBy: null,
    approvedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...extra,
  };
}

const TASKS = [
  task(1, "Prepare sprint demo", {}),
  task(2, "Close audit findings", {
    status: "DONE",
    adminApproved: true,
    approvedBy: HR,
    approvedAt: NOW,
  }),
];

const page1 = (rows: unknown[]) => ({
  data: rows,
  meta: { page: 1, limit: 20, total: rows.length, totalPages: 1 },
});

async function signIntoPortal(page: Page): Promise<{ posts: string[] }> {
  const posts: string[] = [];
  await page.route(`${API}/**`, async (route: Route) => {
    const req = route.request();
    const { pathname } = new URL(req.url());
    const json = (status: number, body: unknown) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    if (req.method() === "POST" && pathname !== "/auth/login") {
      posts.push(`${pathname} ${req.postData() ?? ""}`);
    }
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
          permissions: PERMS,
        },
      });
    }
    if (pathname === "/employee/profile") {
      return json(200, {
        data: {
          ...ME,
          employeeCode: "EMP-000007",
          onboardingStatus: "COMPLETE",
        },
      });
    }
    if (pathname === "/menu/my-menu") {
      const item = (id: number, label: string, path: string) => ({
        id,
        code: `portal-${id}`,
        label,
        path,
        icon: null,
        order: id,
        parentId: 1,
        permission: null,
        children: [],
      });
      return json(200, {
        data: [
          {
            ...item(1, "My Portal", ""),
            code: "portal",
            path: null,
            parentId: null,
            children: [
              item(2, "My Tasks", "/portal/tasks"),
              item(3, "My Tickets", "/portal/tickets"),
            ],
          },
        ],
      });
    }
    if (pathname === "/self-service/tasks") return json(200, page1(TASKS));
    if (pathname === "/self-service/tickets") {
      return json(200, page1([NOTICE]));
    }
    if (pathname === "/self-service/tickets/9") {
      return json(200, {
        data: {
          ...NOTICE,
          comments: [
            {
              id: 1,
              authorKind: "HR",
              author: HR,
              body: "The courier comes at 4 pm.",
              createdAt: NOW,
            },
          ],
        },
      });
    }
    if (pathname === "/self-service/tickets/9/comments") {
      return json(201, {
        data: {
          id: 2,
          authorKind: "EMPLOYEE",
          author: ME,
          body: "Will do.",
          createdAt: NOW,
        },
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
  await page.getByLabel("Email").fill("karthi@texawave.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("not-checked-by-mock");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/portal$/);
  return { posts };
}

const portalNav = (page: Page) =>
  page.getByRole("navigation", { name: "My Portal Navigation" });

test("portal tickets open the thread of an HR notice and send a reply", async ({
  page,
}) => {
  const { posts } = await signIntoPortal(page);
  await portalNav(page).getByRole("link", { name: "My Tickets" }).click();

  await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
  await page.getByRole("button", { name: "View" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("The courier comes at 4 pm.")).toBeVisible();
  await dialog.getByLabel("Reply").fill("Will do.");
  await dialog.getByRole("button", { name: "Send reply" }).click();

  await expect(page.getByText("Reply sent")).toBeVisible();
  expect(posts).toEqual([
    `/self-service/tickets/9/comments ${JSON.stringify({ body: "Will do." })}`,
  ]);
});

test("portal tasks offer only the moves the task's state allows", async ({
  page,
}) => {
  const { posts } = await signIntoPortal(page);
  await portalNav(page).getByRole("link", { name: "My Tasks" }).click();

  // The PENDING task can be started or completed...
  await expect(page.getByText("Prepare sprint demo").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Start working" })).toHaveCount(
    1,
  );
  await expect(page.getByRole("button", { name: "Mark as done" })).toHaveCount(
    1,
  );
  // ...the approved DONE task is locked: no "Mark as pending" anywhere.
  await expect(page.getByText("Close audit findings").first()).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Mark as pending" }),
  ).toHaveCount(0);
  expect(posts).toEqual([]);
});
