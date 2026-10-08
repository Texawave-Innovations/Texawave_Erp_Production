import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { signInAsAdmin, uniqueName } from "./helpers/auth";

/**
 * Real-API coverage for the HR profile screens. Each test creates its own
 * employee through the production API (no fixtures or static data), so reruns
 * against the same dev DB never collide. Requires the seeded Super Admin and a
 * running API (packages/database/prisma/seed.ts).
 *
 * Only two things are stubbed, and only where the test needs a specific
 * response the API would not give the seeded admin: the permission list in
 * /auth/me (to check that controls hide), and one save failure (to check the
 * error state). Every other request goes to the real server.
 *
 * Tokens live in memory only (stores/auth-store.ts), so every navigation
 * after sign-in is an in-app link/button click, never `page.goto` to a
 * protected URL — a hard navigation discards them and lands back on /login
 * (same constraint documented in e2e/hr-employees.spec.ts). This file signs
 * in with the shared `signInAsAdmin` helper and then reaches the profile and
 * edit screens by clicking through Employees → the employee → "Profile" →
 * "Edit profile", the same path a real user takes.
 */
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
const ADMIN = {
  organizationSlug: "texawave-innovations",
  email: "admin@texawave.com",
  password: "ChangeMe123!",
};

const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 640, height: 800 },
  { width: 390, height: 844 },
  { width: 375, height: 812 },
];

async function adminToken(request: APIRequestContext): Promise<string> {
  const res = await request.post(`${API}/auth/login`, { data: ADMIN });
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { data: { accessToken: string } };
  return body.data.accessToken;
}

async function createEmployee(
  request: APIRequestContext,
  token: string,
  name: string,
): Promise<number> {
  const res = await request.post(`${API}/hr/employees`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      fullName: name,
      teamId: 1,
      designationId: await designationId(request, token),
      employmentTypeId: 2,
      dateOfJoining: "2026-01-01",
    },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  return ((await res.json()) as { data: { id: number } }).data.id;
}

/** Reuses the first active designation; creates one if none exists. */
async function designationId(
  request: APIRequestContext,
  token: string,
): Promise<number> {
  const headers = { Authorization: `Bearer ${token}` };
  const list = await request.get(
    `${API}/master-data/designations?page=1&limit=1`,
    {
      headers,
    },
  );
  const rows = ((await list.json()) as { data: Array<{ id: number }> }).data;
  if (rows.length > 0) return rows[0]!.id;
  const created = await request.post(`${API}/master-data/designations`, {
    headers,
    data: { code: "PROFILE_E2E_ROLE", name: "Profile E2E Role" },
  });
  expect(created.ok()).toBeTruthy();
  return ((await created.json()) as { data: { id: number } }).data.id;
}

/** Opens the off-canvas drawer first when the viewport is below `lg` (the
 * nav link is `invisible` there), a no-op on desktop widths where it is
 * always shown. */
async function openNavIfCollapsed(page: Page) {
  const toggle = page.getByRole("button", { name: "Open navigation" });
  if (await toggle.isVisible()) {
    await toggle.click();
  }
}

/** Employees → search by the (unique) name → the employee → "Profile". Never
 * `page.goto`s a protected URL; see the file-level comment.
 *
 * The HR sidebar has both an "Employees" and a "Profiles" entry pointing at
 * the same `/hr/employees` href (packages/database/prisma/seed.ts, no
 * dedicated profile directory route exists), so selecting by href alone is
 * ambiguous (Playwright strict mode) — selected by link text instead. */
async function openEmployeeProfile(page: Page, name: string) {
  await openNavIfCollapsed(page);
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Employees", exact: true })
    .click();
  await page.getByRole("searchbox", { name: "Search employees" }).fill(name);
  await page.getByRole("link", { name, exact: true }).click();
  // Exact: non-exact "Profile" also substring-matches the sidebar's
  // "Profiles" entry (same ambiguity as above).
  await page.getByRole("link", { name: "Profile", exact: true }).click();
}

/** As above, then "Edit profile". */
async function openEmployeeProfileEdit(page: Page, name: string) {
  await openEmployeeProfile(page, name);
  await page.getByRole("link", { name: "Edit profile" }).click();
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow, "page must not scroll horizontally").toBeLessThanOrEqual(0);
}

test.describe.configure({ mode: "serial" });

test.describe("HR profile", () => {
  let token: string;
  let populatedId: number;
  const populatedName = uniqueName("Profile Populated");
  const emptyName = uniqueName("Profile Empty");

  test.beforeAll(async ({ request }) => {
    token = await adminToken(request);
    await createEmployee(request, token, emptyName);
    populatedId = await createEmployee(request, token, populatedName);
    // Seed real profile values through the production PATCH endpoint.
    const res = await request.patch(
      `${API}/hr/employees/${populatedId}/profile`,
      {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          title: "Mr",
          dateOfBirth: "1992-04-18",
          gender: "Male",
          bloodGroup: "O+",
          languages: ["English", "Hindi"],
          fatherName: "Ramesh Kumar",
          emergencyContactName: "Sita Kumar",
          emergencyContactPhone: "+91 98765 43210",
          emergencyContactRelation: "Mother",
          presentAddress: {
            address: "12 MG Road",
            city: "Bengaluru",
            state: "Karnataka",
            pincode: "560001",
          },
          experienceYears: 4.5,
          previousCompany: "Acme Software",
        },
      },
    );
    expect(res.ok(), await res.text()).toBeTruthy();
  });

  test("profile loads and renders the stored data", async ({ page }) => {
    await signInAsAdmin(page);
    await openEmployeeProfile(page, populatedName);

    await expect(
      page.getByRole("heading", { name: populatedName }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Personal information" }),
    ).toBeVisible();
    await expect(page.getByText("Ramesh Kumar")).toBeVisible();
    await expect(page.getByText("English, Hindi")).toBeVisible();
    await expect(page.getByText("Sita Kumar")).toBeVisible();
    await expect(page.getByText("4.5 years")).toBeVisible();
    await expect(page.getByText("12 MG Road")).toBeVisible();
  });

  test("shows an honest empty state for an employee with no profile yet", async ({
    page,
  }) => {
    await signInAsAdmin(page);
    await openEmployeeProfile(page, emptyName);

    await expect(page.getByText("No profile details yet")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Edit profile" }),
    ).toBeVisible();
  });

  // No in-app link ever points at a nonexistent id, and a hard `page.goto`
  // to a protected URL discards the in-memory-only auth tokens
  // (stores/auth-store.ts) — the page lands back on /login instead of the
  // profile route, regardless of when the goto happens. Same constraint as
  // the fixme'd case in e2e/hr-employees.spec.ts. The API-level 404 for an
  // out-of-scope/unknown employee is covered by
  // apps/api/test/hr-profiles.e2e-spec.ts.
  test.fixme("shows a not-found state for an unknown or out-of-scope employee", async ({
    page,
  }) => {
    await signInAsAdmin(page);
    await page.goto("/hr/employees/999999999/profile");

    await expect(page.getByText("Profile not found")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Back to employees" }),
    ).toBeVisible();
  });

  test("edit form opens prefilled and saves only the changed field", async ({
    page,
    request,
  }) => {
    await signInAsAdmin(page);
    await openEmployeeProfile(page, populatedName);
    await page.getByRole("link", { name: "Edit profile" }).click();

    await expect(page).toHaveURL(
      new RegExp(`/hr/employees/${populatedId}/profile/edit$`),
    );
    const father = page.getByLabel("Father's name");
    await expect(father).toHaveValue("Ramesh Kumar");

    const save = page.getByRole("button", { name: "Save profile" });
    await expect(save).toBeDisabled();

    await father.fill("Ramesh K. Kumar");
    await expect(save).toBeEnabled();
    await save.click();

    await expect(page).toHaveURL(
      new RegExp(`/hr/employees/${populatedId}/profile$`),
    );
    await expect(page.getByText("Ramesh K. Kumar")).toBeVisible();

    // Fields the user did not touch are still stored.
    const after = await request.get(
      `${API}/hr/employees/${populatedId}/profile`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    const view = (
      (await after.json()) as { data: { profile: Record<string, unknown> } }
    ).data.profile;
    expect(view.fatherName).toBe("Ramesh K. Kumar");
    expect(view.previousCompany).toBe("Acme Software");
    expect(view.emergencyContact).toMatchObject({ name: "Sita Kumar" });
  });

  test("validation blocks an incomplete address before any request", async ({
    page,
  }) => {
    let patched = false;
    page.on("request", (req) => {
      if (req.method() === "PATCH" && req.url().includes("/profile"))
        patched = true;
    });

    await signInAsAdmin(page);
    await openEmployeeProfileEdit(page, populatedName);
    await page
      .getByRole("group", { name: "Permanent address" })
      .getByLabel("Address")
      .fill("Plot 4");
    await page.getByRole("button", { name: "Save profile" }).click();

    await expect(page.getByText("City is required")).toBeVisible();
    await expect(page.getByText("Pincode is required")).toBeVisible();
    expect(patched).toBe(false);
  });

  test("a rejected save shows the error and keeps the entered values", async ({
    page,
  }) => {
    await page.route(`${API}/hr/employees/${populatedId}/profile`, (route) => {
      if (route.request().method() !== "PATCH") return route.continue();
      return route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({
          statusCode: 400,
          message: [
            "spouseName must be shorter than or equal to 120 characters",
          ],
          error: "VALIDATION_FAILED",
        }),
      });
    });

    await signInAsAdmin(page);
    await openEmployeeProfileEdit(page, populatedName);
    await page.getByLabel("Spouse name").fill("Anita");
    await page.getByRole("button", { name: "Save profile" }).click();

    await expect(page.getByText("Could not save")).toBeVisible();
    await expect(
      page.getByText(
        "spouseName must be shorter than or equal to 120 characters",
      ),
    ).toBeVisible();
    await expect(page.getByLabel("Spouse name")).toHaveValue("Anita");
  });

  test("statutory and bank details stay hidden until revealed", async ({
    page,
  }) => {
    let sensitiveReads = 0;
    page.on("request", (req) => {
      if (req.method() === "GET" && req.url().includes("/sensitive"))
        sensitiveReads++;
    });

    await signInAsAdmin(page);
    await openEmployeeProfile(page, populatedName);
    await expect(
      page.getByText("These details are hidden", { exact: false }),
    ).toBeVisible();
    expect(sensitiveReads).toBe(0);

    await page.getByRole("button", { name: "Show details" }).click();
    await expect(page.getByText("PAN", { exact: true })).toBeVisible();
    expect(sensitiveReads).toBe(1);

    await page.getByRole("button", { name: "Hide details" }).click();
    await expect(
      page.getByText("These details are hidden", { exact: false }),
    ).toBeVisible();
  });

  // The "Profile" entry link on the employee page is itself conditional on
  // this permission (EmployeeDetailView), so with it stripped there is no
  // in-app link to the profile route at all — and a hard `page.goto` there
  // discards the in-memory-only auth tokens (same constraint as above).
  // The API still enforces the route either way
  // (apps/api/test/hr-profiles.e2e-spec.ts covers the permission boundary);
  // this was only ever UI-visibility coverage.
  test.fixme("hides edit controls when the profile permissions are missing", async ({
    page,
  }) => {
    await page.route("**/auth/me", async (route) => {
      const res = await route.fetch();
      const body = (await res.json()) as {
        data: { permissions: string[] };
      };
      body.data.permissions = body.data.permissions.filter(
        (p) => !p.startsWith("hr.employee_profile."),
      );
      await route.fulfill({ response: res, json: body });
    });

    await signInAsAdmin(page);
    await page.goto(`/hr/employees/${populatedId}/profile`);

    await expect(
      page.getByText("You don't have access to employee profiles"),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Edit profile" })).toHaveCount(
      0,
    );
  });

  for (const viewport of VIEWPORTS) {
    test(`profile and edit fit at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await signInAsAdmin(page);
      await openEmployeeProfile(page, populatedName);
      await expect(
        page.getByRole("heading", { name: populatedName }),
      ).toBeVisible();
      await expectNoHorizontalOverflow(page);

      await page.getByRole("link", { name: "Edit profile" }).click();
      await expect(
        page.getByRole("heading", { name: "Edit profile" }),
      ).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });
  }

  test("mobile navigation drawer opens on the profile page at 375px", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await signInAsAdmin(page);
    await openEmployeeProfile(page, populatedName);

    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(
      page.getByRole("button", { name: "Close navigation" }).first(),
    ).toBeVisible();
    // Closed with Escape, not a click: two elements share this name (the
    // header toggle and the full-screen backdrop,
    // app/(dashboard)/layout.tsx), and neither is reliably clickable here —
    // the backdrop (fixed, z-30) visually covers the header toggle while
    // open, and the drawer itself (z-40) covers the backdrop over its own
    // width, so only the strip of backdrop beside the drawer actually
    // closes it. The header button's own "click again to close" not
    // working once open is a pre-existing layout-shell defect, outside
    // this module's scope to fix; reported, not patched. Escape (the
    // documented keyboard path, same layout.tsx) exercises the close
    // behavior without depending on that geometry.
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Open navigation" }),
    ).toBeVisible();
  });
});
