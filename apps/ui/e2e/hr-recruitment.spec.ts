import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * HR → Recruitment UI, against a mocked API. The backend is not needed: every
 * request to the API origin is answered here, so these tests cover the UI's
 * contract with the endpoints (URLs, query params, bodies, status codes).
 *
 * Tokens live in memory only (see auth-store.ts), so the app is reached by a
 * client-side link after sign-in rather than by a full page load.
 */

const API_ORIGIN = "http://localhost:3000";
const UI_ORIGIN = process.env.UI_BASE_URL ?? "http://localhost:3001";

const ALL_RECRUITMENT_PERMISSIONS = [
  "hr.interview.read",
  "hr.interview.write",
  "hr.offer_letter.read",
  "hr.offer_letter.write",
  "hr.revision_letter.read.team",
  "hr.revision_letter.write.team",
  "hr.promotion_letter.read.team",
  "hr.promotion_letter.write.team",
  "master.designation.read",
  "master.designation.write",
  "hr.employee.read.team",
];

interface ApiRequest {
  method: string;
  path: string;
  search: URLSearchParams;
  body: unknown;
}

interface ApiResponse {
  status?: number;
  json: unknown;
}

type ApiHandler = (req: ApiRequest) => ApiResponse | undefined;

const CORS = {
  "access-control-allow-origin": UI_ORIGIN,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "authorization,content-type",
  "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
};

function base64url(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

const FAKE_JWT = `${base64url({ alg: "none" })}.${base64url({ organizationId: 1, sub: 1 })}.sig`;

const PAGE_META = (total: number) => ({
  page: 1,
  limit: 10,
  total,
  totalPages: Math.max(1, Math.ceil(total / 10)),
});

const FORBIDDEN = (path: string) => ({
  status: 403,
  json: {
    statusCode: 403,
    message: "Forbidden",
    error: "FORBIDDEN",
    path,
    timestamp: new Date().toISOString(),
  },
});

async function installApi(page: Page, handler: ApiHandler): Promise<void> {
  await page.route(`${API_ORIGIN}/**`, async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: CORS });
      return;
    }
    let body: unknown;
    try {
      body = request.postDataJSON();
    } catch {
      body = undefined;
    }
    const result = handler({
      method: request.method(),
      path: url.pathname,
      search: url.searchParams,
      body,
    }) ?? {
      status: 404,
      json: {
        statusCode: 404,
        message: "Not mocked",
        error: "NOT_FOUND",
        path: url.pathname,
        timestamp: new Date().toISOString(),
      },
    };
    await route.fulfill({
      status: result.status ?? 200,
      headers: { ...CORS, "content-type": "application/json" },
      body: JSON.stringify(result.json),
    });
  });
}

/** Installs the auth/menu mocks, the Recruitment mocks, and signs in. */
async function signInAndOpenRecruitment(
  page: Page,
  options: { permissions?: string[]; recruitment?: ApiHandler } = {},
): Promise<void> {
  const permissions = options.permissions ?? ALL_RECRUITMENT_PERMISSIONS;
  await installApi(page, (req) => {
    if (req.method === "POST" && req.path === "/auth/login") {
      return {
        json: { data: { accessToken: FAKE_JWT, refreshToken: "refresh" } },
      };
    }
    if (req.method === "GET" && req.path === "/auth/me") {
      return {
        json: {
          data: {
            userId: 1,
            organizationId: 1,
            email: "hr@texawave.com",
            fullName: "HR User",
            roleIds: [1],
            permissions,
          },
        },
      };
    }
    if (req.method === "GET" && req.path === "/menu/my-menu") {
      return {
        json: {
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
                  code: "hr.recruitment",
                  label: "Recruitment",
                  path: "/hr/recruitment",
                  icon: null,
                  order: 1,
                  parentId: 1,
                  permission: null,
                  children: [],
                },
              ],
            },
          ],
        },
      };
    }
    return options.recruitment?.(req);
  });

  // Wait for hydration before interacting: a click on the un-hydrated form is
  // a native submit that leaves the URL unchanged.
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Organization").fill("texawave-innovations");
  await page.getByLabel("Email").fill("hr@texawave.com");
  await page.getByLabel("Password").fill("not-used-by-mock");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/reference\/tags/);
  // The sidebar mounts after the menu loads and animates in, so retry the
  // click until the client-side navigation has actually happened.
  // Below the lg breakpoint the sidebar is an off-canvas drawer, so open it.
  const viewportWidth = page.viewportSize()?.width ?? 1280;
  if (viewportWidth < 1024) {
    await page.getByRole("button", { name: "Open navigation" }).click();
  }
  const link = page.getByRole("link", { name: "Recruitment" });
  await expect(link).toBeVisible();
  await expect(async () => {
    await link.click();
    await expect(page).toHaveURL(/\/hr\/recruitment/, { timeout: 2000 });
  }).toPass({ timeout: 15000 });
  await expect(
    page.getByRole("heading", { name: "Recruitment & onboarding" }),
  ).toBeVisible();
}

const INTERVIEWS = [
  {
    id: 1,
    candidateName: "Ramesh Kumar",
    roleTitle: "Full Stack Developer",
    interviewerName: "Tech Lead",
    interviewDate: "2026-10-12",
    interviewTime: "14:30",
    mode: "ONLINE",
    status: "SCHEDULED",
    notes: "Resume: example.com/ramesh",
    createdBy: 1,
    updatedBy: null,
    createdAt: "2026-10-05T09:00:00.000Z",
    updatedAt: "2026-10-05T09:00:00.000Z",
  },
  {
    id: 2,
    candidateName: "Priya Sharma",
    roleTitle: "QA Engineer",
    interviewerName: "HR",
    interviewDate: "2026-10-13",
    interviewTime: "11:00",
    mode: "PHONE",
    status: "COMPLETED",
    notes: null,
    createdBy: 1,
    updatedBy: 1,
    createdAt: "2026-10-05T09:05:00.000Z",
    updatedAt: "2026-10-05T09:05:00.000Z",
  },
];

test("interview schedule loads, searches and filters through the API", async ({
  page,
}) => {
  const searches: string[] = [];
  await signInAndOpenRecruitment(page, {
    recruitment: (req) => {
      if (req.method === "GET" && req.path === "/hr/interviews") {
        const search = req.search.get("search") ?? "";
        const status = req.search.get("status");
        if (search) searches.push(search);
        const rows = INTERVIEWS.filter(
          (row) =>
            (!search ||
              row.candidateName.toLowerCase().includes(search.toLowerCase())) &&
            (!status || row.status === status),
        );
        return { json: { data: rows, meta: PAGE_META(rows.length) } };
      }
      return undefined;
    },
  });

  // Candidate names share a cell with their notes, so match the name text.
  const candidate = (name: string) => page.getByText(name, { exact: true });
  await expect(candidate("Ramesh Kumar")).toBeVisible();
  await expect(candidate("Priya Sharma")).toBeVisible();

  await page.getByLabel("Search interviews").fill("Priya");
  await expect(candidate("Ramesh Kumar")).toHaveCount(0);
  await expect(candidate("Priya Sharma")).toBeVisible();
  expect(searches).toContain("Priya");

  await page.getByLabel("Search interviews").fill("");
  await page.getByLabel("Filter by status").selectOption("SCHEDULED");
  await expect(candidate("Priya Sharma")).toHaveCount(0);
  await expect(candidate("Ramesh Kumar")).toBeVisible();
});

test("schedule form blocks an empty submit and sends nothing", async ({
  page,
}) => {
  let posts = 0;
  await signInAndOpenRecruitment(page, {
    recruitment: (req) => {
      if (req.method === "GET" && req.path === "/hr/interviews") {
        return { json: { data: [], meta: PAGE_META(0) } };
      }
      if (req.method === "POST" && req.path === "/hr/interviews") {
        posts += 1;
        return { json: { data: {} } };
      }
      return undefined;
    },
  });

  await page.getByRole("button", { name: "Schedule interview" }).click();
  await page.getByRole("button", { name: "Save interview" }).click();
  await expect(
    page.getByText("Candidate name must be at least 2 characters"),
  ).toBeVisible();
  expect(posts).toBe(0);
});

test("schedules an interview and sends the DTO fields", async ({ page }) => {
  let created: unknown;
  await signInAndOpenRecruitment(page, {
    recruitment: (req) => {
      if (req.method === "GET" && req.path === "/hr/interviews") {
        return { json: { data: [], meta: PAGE_META(0) } };
      }
      if (req.method === "POST" && req.path === "/hr/interviews") {
        created = req.body;
        return { status: 201, json: { data: { ...INTERVIEWS[0], id: 3 } } };
      }
      return undefined;
    },
  });

  await page.getByRole("button", { name: "Schedule interview" }).click();
  await page.getByLabel("Candidate name").fill("Ramesh Kumar");
  await page.getByLabel("Role / position").fill("Full Stack Developer");
  await page.getByLabel("Interviewer name").fill("Tech Lead");
  await page.getByLabel(/^Date/).fill("2026-10-12");
  await page.getByLabel(/^Time/).fill("14:30");
  await page.getByRole("button", { name: "Save interview" }).click();

  await expect(page.getByText("Interview scheduled")).toBeVisible();
  expect(created).toEqual({
    candidateName: "Ramesh Kumar",
    roleTitle: "Full Stack Developer",
    interviewerName: "Tech Lead",
    interviewDate: "2026-10-12",
    interviewTime: "14:30",
    mode: "ONLINE",
    notes: "",
  });
});

test("changing an interview status sends a PATCH with the new status", async ({
  page,
}) => {
  let patched: { path: string; body: unknown } | undefined;
  await signInAndOpenRecruitment(page, {
    recruitment: (req) => {
      if (req.method === "GET" && req.path === "/hr/interviews") {
        return { json: { data: [INTERVIEWS[0]], meta: PAGE_META(1) } };
      }
      if (req.method === "PATCH" && req.path === "/hr/interviews/1/status") {
        patched = { path: req.path, body: req.body };
        return { json: { data: { ...INTERVIEWS[0], status: "SELECTED" } } };
      }
      return undefined;
    },
  });

  await page
    .getByLabel("Change status for Ramesh Kumar")
    .selectOption("SELECTED");
  await expect(page.getByText("Status set to Selected")).toBeVisible();
  expect(patched).toEqual({
    path: "/hr/interviews/1/status",
    body: { status: "SELECTED" },
  });
});

test("a 403 on offers shows an access message, not a crash", async ({
  page,
}) => {
  await signInAndOpenRecruitment(page, {
    recruitment: (req) => {
      if (req.method === "GET" && req.path === "/hr/offer-letters") {
        return FORBIDDEN(req.path);
      }
      if (req.method === "GET" && req.path === "/hr/interviews") {
        return { json: { data: [], meta: PAGE_META(0) } };
      }
      return undefined;
    },
  });

  await page.getByRole("tab", { name: "Offer letter" }).click();
  await expect(page.getByText("Access denied")).toBeVisible();
  await expect(
    page.getByText("You do not have permission to view offer letters."),
  ).toBeVisible();
});

test("read-only users see no write actions", async ({ page }) => {
  await signInAndOpenRecruitment(page, {
    permissions: ["hr.interview.read"],
    recruitment: (req) => {
      if (req.method === "GET" && req.path === "/hr/interviews") {
        return { json: { data: [INTERVIEWS[0]], meta: PAGE_META(1) } };
      }
      return undefined;
    },
  });

  await expect(page.getByRole("tab")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Schedule interview" }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Change status for Ramesh Kumar")).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "View interview for Ramesh Kumar" }),
  ).toBeVisible();
});

test("revision letter is issued to a picked employee with their employee id", async ({
  page,
}) => {
  let issued: unknown;
  await signInAndOpenRecruitment(page, {
    recruitment: (req) => {
      if (req.method === "GET" && req.path === "/hr/employees") {
        return {
          json: {
            data: [
              {
                id: 5,
                employeeCode: "EMP-000005",
                fullName: "Arun Kumar",
                status: "ACTIVE",
                designation: { id: 9, name: "Senior Software Engineer" },
                team: { id: 3, name: "Platform" },
              },
            ],
            meta: PAGE_META(1),
          },
        };
      }
      if (req.method === "GET" && req.path === "/hr/revision-letters") {
        return { json: { data: [], meta: PAGE_META(0) } };
      }
      if (req.method === "POST" && req.path === "/hr/revision-letters") {
        issued = req.body;
        return { status: 201, json: { data: {} } };
      }
      return undefined;
    },
  });

  await page.getByRole("tab", { name: "Revision letter" }).click();
  await page
    .getByRole("button", { name: "Issue revision letter to Arun Kumar" })
    .click();
  // Required labels carry a trailing "*", so anchor the match rather than exact.
  await expect(page.getByLabel(/^Designation/)).toHaveValue(
    "Senior Software Engineer",
  );
  await page.getByLabel(/^Effective date/).fill("2026-11-01");
  await page
    .getByRole("button", { name: "Issue revision letter", exact: true })
    .click();

  await expect(page.getByText("Revision letter issued")).toBeVisible();
  expect(issued).toMatchObject({
    employeeId: 5,
    designation: "Senior Software Engineer",
    effectiveDate: "2026-11-01",
    location: "Chennai",
    signatoryName: "Amanullah Khan",
    signatoryDesignation: "Co-Founder",
  });
  expect(issued).not.toHaveProperty("basic");
});

test("desktop layout renders the three tabs with data", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signInAndOpenRecruitment(page, {
    recruitment: (req) => {
      if (req.method === "GET" && req.path === "/hr/interviews") {
        return { json: { data: INTERVIEWS, meta: PAGE_META(2) } };
      }
      if (req.method === "GET" && req.path === "/hr/revision-letters") {
        return { json: { data: [], meta: PAGE_META(0) } };
      }
      if (req.method === "GET" && req.path === "/hr/employees") {
        return { json: { data: [], meta: PAGE_META(0) } };
      }
      return undefined;
    },
  });
  await expect(page.getByText("Ramesh Kumar", { exact: true })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("recruitment-1440-interviews.png"),
    fullPage: true,
  });
});

test("the Recruitment screens fit a 375px phone without horizontal scroll", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await signInAndOpenRecruitment(page, {
    recruitment: (req) => {
      if (req.method === "GET" && req.path === "/hr/interviews") {
        return { json: { data: INTERVIEWS, meta: PAGE_META(2) } };
      }
      if (req.method === "GET" && req.path === "/hr/offer-letters") {
        return { json: { data: [], meta: PAGE_META(0) } };
      }
      if (req.method === "GET" && req.path === "/hr/revision-letters") {
        return { json: { data: [], meta: PAGE_META(0) } };
      }
      if (req.method === "GET" && req.path === "/hr/employees") {
        return { json: { data: [EMPLOYEE], meta: PAGE_META(1) } };
      }
      return promotionApi({ letters: [PROMOTION] })(req);
    },
  });

  for (const tab of [
    "Interview schedule",
    "Offer letter",
    "Revision letter",
    "Promotion letter",
  ]) {
    await page.getByRole("tab", { name: tab }).click();
    if (tab === "Promotion letter") {
      // The widest state: an employee expanded with their history table.
      await page
        .getByRole("button", { name: "Show salary history of Arun Kumar" })
        .click();
      await expect(page.getByText("PR-HIST-1")).toBeVisible();
    }
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow, `horizontal overflow on ${tab}`).toBeLessThanOrEqual(0);
  }

  await page.getByRole("tab", { name: "Interview schedule" }).click();
  await page.screenshot({
    path: testInfo.outputPath("recruitment-375-interviews.png"),
    fullPage: true,
  });
});

// --- Promotion letter -------------------------------------------------------

const EMPLOYEE = {
  id: 5,
  employeeCode: "EMP-000005",
  fullName: "Arun Kumar",
  status: "ACTIVE",
  designation: { id: 9, name: "Software Engineer" },
  team: { id: 3, name: "Platform" },
};

function designation(id: number, name: string, code: string, isActive = true) {
  return {
    id,
    organizationId: 1,
    code,
    name,
    description: null,
    isActive,
    customFields: {},
    createdBy: 1,
    updatedBy: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
  };
}

const DESIGNATIONS = [
  designation(9, "Software Engineer", "SE"),
  designation(10, "Team Lead", "TL"),
  designation(11, "Retired Title", "OLD", false),
];

const COMPONENTS = {
  basic: "35000.00",
  da: "15000.00",
  hra: "30000.00",
  ca: "20000.00",
};

const HISTORY = {
  employee: {
    id: 5,
    employeeCode: "EMP-000005",
    fullName: "Arun Kumar",
    currentDesignation: "Software Engineer",
  },
  revisionsIncluded: true,
  entries: [
    {
      kind: "PROMOTION",
      id: 2,
      documentNo: "PR-HIST-1",
      designation: "Software Engineer",
      previousDesignation: "Associate Engineer" as string | null,
      letterDate: "2026-03-20",
      effectiveDate: "2026-04-01",
      components: COMPONENTS,
      grossMonthly: "100000.00",
      grossAnnual: "1200000.00",
    },
    {
      kind: "REVISION",
      id: 1,
      documentNo: "RV-HIST-1",
      designation: "Associate Engineer",
      previousDesignation: null,
      letterDate: "2025-03-20",
      effectiveDate: "2025-04-01",
      components: COMPONENTS,
      grossMonthly: "70000.00",
      grossAnnual: "840000.00",
    },
  ],
};

const PROMOTION = {
  id: 7,
  documentNo: "TW/HR/PRO/26-27/001",
  employee: { id: 5, employeeCode: "EMP-000005", fullName: "Arun Kumar" },
  employeeName: "Arun Kumar",
  designationId: 10,
  designation: "Team Lead",
  previousDesignation: "Software Engineer",
  location: "Chennai",
  letterDate: "2026-10-09",
  effectiveDate: "2026-11-01",
  components: COMPONENTS,
  grossMonthly: "100000.00",
  grossAnnual: "1200000.00",
  signatoryName: "Amanullah Khan",
  signatoryDesignation: "Co-Founder",
  status: "GENERATED",
  createdBy: 1,
  updatedBy: 1,
  createdAt: "2026-10-09T09:00:00.000Z",
  updatedAt: "2026-10-09T09:00:00.000Z",
};

/** Answers every Promotion-tab read; `extra` is consulted first (writes). */
function promotionApi(
  options: {
    history?: typeof HISTORY;
    letters?: (typeof PROMOTION)[];
    designations?: ReturnType<typeof designation>[];
    extra?: ApiHandler;
  } = {},
): ApiHandler {
  return (req) => {
    const extra = options.extra?.(req);
    if (extra) return extra;
    if (req.method === "GET" && req.path === "/hr/interviews") {
      return { json: { data: [], meta: PAGE_META(0) } };
    }
    if (req.method === "GET" && req.path === "/hr/employees") {
      return { json: { data: [EMPLOYEE], meta: PAGE_META(1) } };
    }
    if (req.method === "GET" && req.path === "/hr/promotion-letters") {
      const letters = options.letters ?? [];
      return { json: { data: letters, meta: PAGE_META(letters.length) } };
    }
    if (
      req.method === "GET" &&
      req.path === "/hr/promotion-letters/salary-history/5"
    ) {
      return { json: { data: options.history ?? HISTORY } };
    }
    if (req.method === "GET" && req.path === "/master-data/designations") {
      const rows = options.designations ?? DESIGNATIONS;
      return { json: { data: rows, meta: PAGE_META(rows.length) } };
    }
    return undefined;
  };
}

test("expanding an employee loads and shows their salary history", async ({
  page,
}) => {
  let historyCalls = 0;
  await signInAndOpenRecruitment(page, {
    recruitment: promotionApi({
      extra: (req) => {
        if (req.path === "/hr/promotion-letters/salary-history/5") {
          historyCalls += 1;
        }
        return undefined;
      },
    }),
  });

  await page.getByRole("tab", { name: "Promotion letter" }).click();
  const toggle = page.getByRole("button", {
    name: "Show salary history of Arun Kumar",
  });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  // Fetched only once the employee is expanded.
  expect(historyCalls).toBe(0);

  await toggle.click();
  const history = page.getByRole("table", {
    name: "Salary history of Arun Kumar",
  });
  await expect(history).toBeVisible();
  await expect(page.getByText("Current designation:")).toBeVisible();
  await expect(history.getByText("Promotion", { exact: true })).toBeVisible();
  await expect(history.getByText("Revision", { exact: true })).toBeVisible();
  await expect(
    history.getByText("Associate Engineer → Software Engineer"),
  ).toBeVisible();
  // Rows keep the API's order: newest effective date first.
  await expect(history.locator("tbody tr td:nth-child(2)")).toHaveText([
    "PR-HIST-1",
    "RV-HIST-1",
  ]);
  expect(historyCalls).toBe(1);

  await page
    .getByRole("button", { name: "Hide salary history of Arun Kumar" })
    .click();
  await expect(history).toHaveCount(0);
});

test("salary history says when revision letters are hidden", async ({
  page,
}) => {
  await signInAndOpenRecruitment(page, {
    recruitment: promotionApi({
      history: {
        ...HISTORY,
        revisionsIncluded: false,
        entries: HISTORY.entries.filter((e) => e.kind === "PROMOTION"),
      },
    }),
  });

  await page.getByRole("tab", { name: "Promotion letter" }).click();
  await page
    .getByRole("button", { name: "Show salary history of Arun Kumar" })
    .click();
  await expect(
    page.getByText(
      "Revision letters are hidden — you do not have access to them.",
    ),
  ).toBeVisible();
  await expect(page.getByText("RV-HIST-1")).toHaveCount(0);
});

test("a promotion letter needs a master designation and sends its id", async ({
  page,
}) => {
  const issued: unknown[] = [];
  await signInAndOpenRecruitment(page, {
    recruitment: promotionApi({
      extra: (req) => {
        if (req.method === "POST" && req.path === "/hr/promotion-letters") {
          issued.push(req.body);
          return { status: 201, json: { data: PROMOTION } };
        }
        return undefined;
      },
    }),
  });

  await page.getByRole("tab", { name: "Promotion letter" }).click();
  await page
    .getByRole("button", { name: "Issue promotion letter to Arun Kumar" })
    .click();
  await expect(page.getByLabel("Previous designation")).toHaveValue(
    "Software Engineer",
  );

  // Only active designations are offered.
  const select = page.getByLabel(/^New designation/);
  await expect(select.locator("option")).toHaveText([
    "Select a designation",
    "Software Engineer",
    "Team Lead",
  ]);

  const submit = page.getByRole("button", {
    name: "Issue promotion letter",
    exact: true,
  });
  await submit.click();
  await expect(select).toHaveAttribute("aria-invalid", "true");
  expect(issued).toHaveLength(0);

  await select.selectOption({ label: "Team Lead" });
  await page.getByLabel("Monthly salary").fill("100000");
  await page.getByLabel(/^Effective date/).fill("2026-11-01");
  await submit.click();

  await expect(page.getByText("Promotion letter issued")).toBeVisible();
  expect(issued).toHaveLength(1);
  expect(issued[0]).toMatchObject({
    employeeId: 5,
    designationId: 10,
    effectiveDate: "2026-11-01",
    location: "Chennai",
    basic: 35000,
    da: 15000,
    hra: 30000,
    ca: 20000,
  });
  expect(issued[0]).not.toHaveProperty("designation");
});

test("an inactive-designation refusal is shown on the designation field", async ({
  page,
}) => {
  await signInAndOpenRecruitment(page, {
    recruitment: promotionApi({
      extra: (req) => {
        if (req.method === "POST" && req.path === "/hr/promotion-letters") {
          return {
            status: 422,
            json: {
              statusCode: 422,
              message: "Designation not found or inactive",
              error: "INVALID_DESIGNATION",
              path: req.path,
              timestamp: new Date().toISOString(),
            },
          };
        }
        return undefined;
      },
    }),
  });

  await page.getByRole("tab", { name: "Promotion letter" }).click();
  await page
    .getByRole("button", { name: "Issue promotion letter to Arun Kumar" })
    .click();
  await page
    .getByLabel(/^New designation/)
    .selectOption({ label: "Team Lead" });
  await page
    .getByRole("button", { name: "Issue promotion letter", exact: true })
    .click();
  await expect(
    page.getByText(
      "That designation is inactive or no longer exists. Pick another.",
    ),
  ).toBeVisible();
});

test("a designation can be added to the master from the promotion form", async ({
  page,
}) => {
  const designations = [...DESIGNATIONS];
  let created: unknown;
  let posts = 0;
  await signInAndOpenRecruitment(page, {
    recruitment: promotionApi({
      designations,
      extra: (req) => {
        if (req.method === "POST" && req.path === "/master-data/designations") {
          posts += 1;
          created = req.body;
          const row = designation(12, "Tech Architect", "TECH_ARCHITECT");
          designations.push(row);
          return { status: 201, json: { data: row } };
        }
        return undefined;
      },
    }),
  });

  await page.getByRole("tab", { name: "Promotion letter" }).click();
  await page
    .getByRole("button", { name: "Issue promotion letter to Arun Kumar" })
    .click();
  await page.getByRole("button", { name: "+ Add designation" }).click();
  await page.getByLabel(/^Designation name/).fill("Tech Architect");
  // The code is the user's own entry — typing a name never fills it in.
  const code = page.getByLabel(/^Code/);
  await expect(code).toHaveValue("");
  const add = page.getByRole("button", {
    name: "Add designation",
    exact: true,
  });
  await add.click();
  await expect(page.getByText("Code: 2–30 letters, digits or _")).toBeVisible();
  expect(posts).toBe(0);

  // Typed in lower case; sent upper-cased, as the master-data API stores it.
  await code.fill("tech_architect");
  await expect(page.getByLabel(/^Designation name/)).toHaveValue(
    "Tech Architect",
  );
  await add.click();

  await expect(page.getByLabel(/^New designation/)).toHaveValue("12");
  expect(created).toEqual({ name: "Tech Architect", code: "TECH_ARCHITECT" });
});

test("a promotion reader without write sees no issue or edit actions", async ({
  page,
}) => {
  await signInAndOpenRecruitment(page, {
    permissions: ["hr.promotion_letter.read.team", "hr.employee.read.team"],
    recruitment: promotionApi({ letters: [PROMOTION] }),
  });

  await expect(page.getByRole("tab")).toHaveCount(1);
  await expect(page.getByText("TW/HR/PRO/26-27/001")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Issue promotion letter to Arun Kumar" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Edit promotion TW/HR/PRO/26-27/001" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "View promotion TW/HR/PRO/26-27/001" }),
  ).toBeVisible();
});
