import { expect, type Page, type Route } from "@playwright/test";

/**
 * A fully mocked API for browser specs that prove UI behaviour on screens
 * whose data a dev database usually lacks (payroll masters, declarations,
 * reopen...). Sign-in goes through the real login form against the mock;
 * the API's own rules are proven by apps/api e2e suites.
 *
 * `handler` answers every non-auth request; return `undefined` to fall
 * through to a 404 "Not mocked" (so a spec notices an unexpected call).
 * Every request is recorded in `calls` as "METHOD /path {body}".
 */
export const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export interface MockRequest {
  method: string;
  pathname: string;
  search: URLSearchParams;
  body: unknown;
}

export type MockAnswer =
  { status?: number; body: unknown } | { file: string; contentType: string };

function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "none", typ: "JWT" })}.${b64(payload)}.sig`;
}

export const page1 = <T>(rows: T[]) => ({
  data: rows,
  meta: { page: 1, limit: 20, total: rows.length, totalPages: 1 },
});

interface MenuLink {
  code: string;
  label: string;
  path: string;
}

export async function signInWithMockedApi(
  page: Page,
  options: {
    permissions: string[];
    userId?: number;
    /** HR workspace (dashboard), the Sales workspace, or the employee portal. */
    workspace: "hr" | "sales" | "portal";
    menu: MenuLink[];
    handler: (req: MockRequest) => MockAnswer | undefined;
  },
): Promise<{ calls: string[] }> {
  const calls: string[] = [];
  const userId = options.userId ?? 1;
  await page.route(`${API}/**`, async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const { pathname } = url;
    let body: unknown = null;
    try {
      body = req.postDataJSON() as unknown;
    } catch {
      body = req.postData();
    }
    const json = (status: number, payload: unknown) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(payload),
      });
    if (pathname === "/auth/login") {
      return json(200, {
        data: {
          accessToken: jwt({ organizationId: 1, sub: userId }),
          refreshToken: "r",
        },
      });
    }
    if (pathname === "/auth/me") {
      return json(200, {
        data: {
          userId,
          organizationId: 1,
          email: "tester@texawave.test",
          fullName: "Tester",
          roleIds: [1],
          permissions: options.permissions,
        },
      });
    }
    if (pathname === "/menu/my-menu") {
      const groupCode = options.workspace;
      return json(200, {
        data: [
          {
            id: 1,
            code: groupCode,
            label:
              options.workspace === "hr"
                ? "HR"
                : options.workspace === "sales"
                  ? "Sales"
                  : "My Portal",
            path: null,
            icon: null,
            order: 1,
            parentId: null,
            permission: null,
            children: options.menu.map((m, i) => ({
              id: i + 2,
              code: m.code,
              label: m.label,
              path: m.path,
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
    if (pathname === "/employee/profile" || pathname === "/employee/me") {
      if (options.workspace !== "portal") {
        return json(404, {
          statusCode: 404,
          message: "Not an employee",
          error: "NOT_AN_EMPLOYEE",
          path: pathname,
        });
      }
      return json(200, {
        data: {
          id: 7,
          employeeCode: "EMP-000007",
          fullName: "Tester",
          onboardingStatus: "COMPLETE",
        },
      });
    }
    calls.push(
      `${req.method()} ${pathname}${url.search}${body ? ` ${JSON.stringify(body)}` : ""}`,
    );
    const answer = options.handler({
      method: req.method(),
      pathname,
      search: url.searchParams,
      body,
    });
    if (!answer) {
      return json(404, {
        statusCode: 404,
        message: "Not mocked",
        error: "Not Found",
        path: pathname,
      });
    }
    if ("file" in answer) {
      return route.fulfill({
        status: 200,
        contentType: answer.contentType,
        body: answer.file,
      });
    }
    return json(answer.status ?? 200, answer.body);
  });

  await page.goto("/login");
  await page.getByLabel("Organization").fill("texawave-innovations");
  await page.getByLabel("Email").fill("tester@texawave.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("not-checked-by-mock");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(
    options.workspace === "hr"
      ? /\/hr/
      : options.workspace === "sales"
        ? /\/sales\/dashboard/
        : /\/portal/,
  );
  return { calls };
}

/** An API error body as the backend sends it. */
export function apiError(status: number, error: string, message = error) {
  return {
    status,
    body: {
      statusCode: status,
      message,
      error,
      path: "/",
      timestamp: "2026-10-13T00:00:00.000Z",
    },
  };
}
