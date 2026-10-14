import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { uniqueName } from "./helpers/auth";

/**
 * Proves the employee self-service portal (Docs/ARCHITECTURE.md §7) actually
 * works end to end: an Employee-role user's sidebar is driven by the same
 * `MenuItem`/`getMyMenu()` mechanism as the admin dashboard, but gated by
 * `employee_self_service.*` permissions only — never `hr.*`. All profile
 * data is seeded through the production API (same pattern as
 * hr-profiles.spec.ts), so this test only exercises the UI it's meant to
 * check: the portal sidebar and the My Profile page.
 */
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
const ADMIN = {
  organizationSlug: "texawave-innovations",
  email: "admin@texawave.com",
  password: "ChangeMe123!",
};

// A minimal valid PDF — detectFileType only checks the first 5 bytes
// (apps/api/src/shared/file-storage/file-storage.service.ts), content is
// otherwise irrelevant to this test.
const DUMMY_PDF = Buffer.from("%PDF-1.4\n%%EOF");
const REQUIRED_DOCUMENT_TYPES = [
  "PROFILE_PHOTO",
  "AADHAAR",
  "PAN",
  "BANK_STATEMENT",
  "CERT_10TH",
  "CERT_12TH",
  "CERT_GRADUATION",
];

async function adminToken(request: APIRequestContext): Promise<string> {
  const res = await request.post(`${API}/auth/login`, { data: ADMIN });
  expect(res.ok(), await res.text()).toBeTruthy();
  const body = (await res.json()) as { data: { accessToken: string } };
  return body.data.accessToken;
}

async function firstId(
  request: APIRequestContext,
  token: string,
  path: string,
): Promise<number> {
  const res = await request.get(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  const rows = ((await res.json()) as { data: Array<{ id: number }> }).data;
  expect(
    rows.length,
    `seed must provide at least one row at ${path}`,
  ).toBeGreaterThan(0);
  return rows[0]!.id;
}

/**
 * A dedicated role holding exactly the permission codes matching `predicate`
 * — not the seeded "Employee"/"Team Lead" roles, which are shared, mutable
 * admin state (e.g. the "Menu access" matrix editor edits them directly) and
 * must not be something a test's correctness depends on staying untouched.
 */
async function createRoleWithPermissions(
  request: APIRequestContext,
  token: string,
  name: string,
  predicate: (code: string) => boolean,
): Promise<{ roleId: number; permissionIds: number[] }> {
  const headers = { Authorization: `Bearer ${token}` };
  const catalogRes = await request.get(`${API}/settings/permissions`, {
    headers,
  });
  expect(catalogRes.ok(), await catalogRes.text()).toBeTruthy();
  const catalog = (
    (await catalogRes.json()) as { data: Array<{ id: number; code: string }> }
  ).data;
  const permissionIds = catalog
    .filter((p) => predicate(p.code))
    .map((p) => p.id);
  expect(
    permissionIds.length,
    `catalog must have permissions matching this role (${name})`,
  ).toBeGreaterThan(0);

  const roleRes = await request.post(`${API}/settings/roles`, {
    headers,
    data: { name },
  });
  expect(roleRes.ok(), await roleRes.text()).toBeTruthy();
  const roleId = ((await roleRes.json()) as { data: { id: number } }).data.id;

  const setRes = await request.put(
    `${API}/settings/roles/${roleId}/permissions`,
    {
      headers,
      data: { permissionIds },
    },
  );
  expect(setRes.ok(), await setRes.text()).toBeTruthy();
  return { roleId, permissionIds };
}

async function createSelfServiceOnlyRole(
  request: APIRequestContext,
  token: string,
  name: string,
): Promise<number> {
  const { roleId } = await createRoleWithPermissions(
    request,
    token,
    name,
    (code) => code.startsWith("employee_self_service."),
  );
  return roleId;
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Organization").fill(ADMIN.organizationSlug);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

/**
 * Creates a user with the given role, an employee record for them, fills in
 * and submits the full onboarding profile, and returns that employee's own
 * bearer token. Shared by every test here that needs to reach `/portal` as a
 * fully onboarded employee — onboarding completion is a precondition for the
 * portal shell to render at all (apps/ui/src/app/(employee-portal)/layout.tsx),
 * not something each test should re-derive.
 */
async function createOnboardedEmployeeUser(
  request: APIRequestContext,
  token: string,
  options: {
    email: string;
    password: string;
    fullName: string;
    roleId: number;
  },
): Promise<string> {
  const { email, password, fullName, roleId } = options;
  const headers = { Authorization: `Bearer ${token}` };

  const userRes = await request.post(`${API}/users`, {
    headers,
    data: {
      email,
      fullName,
      password,
      mustChangePassword: false,
      roleIds: [roleId],
    },
  });
  expect(userRes.ok(), await userRes.text()).toBeTruthy();
  const userId = ((await userRes.json()) as { data: { id: number } }).data.id;

  const [teamId, departmentId, designationId, employmentTypeId] =
    await Promise.all([
      firstId(request, token, "/hr/teams?limit=1"),
      firstId(request, token, "/departments?limit=1"),
      firstId(request, token, "/master-data/designations?limit=1"),
      firstId(request, token, "/master-data/employment-types?limit=1"),
    ]);

  const employeeRes = await request.post(`${API}/hr/employees`, {
    headers,
    data: {
      fullName,
      workEmail: email,
      phone: "9841055667",
      teamId,
      departmentId,
      designationId,
      employmentTypeId,
      dateOfJoining: "2026-01-01",
      userId,
    },
  });
  expect(employeeRes.ok(), await employeeRes.text()).toBeTruthy();

  // From here on, act as the employee themselves — the profile endpoints
  // operate on "my own record", not an id the caller picks.
  const employeeLogin = await request.post(`${API}/auth/login`, {
    data: { ...ADMIN, email, password },
  });
  expect(employeeLogin.ok(), await employeeLogin.text()).toBeTruthy();
  const employeeToken = (
    (await employeeLogin.json()) as { data: { accessToken: string } }
  ).data.accessToken;
  const authHeaders = { Authorization: `Bearer ${employeeToken}` };

  await Promise.all([
    request.put(`${API}/employee/profile/personal-details`, {
      headers: authHeaders,
      data: {
        dateOfBirth: "1995-06-15",
        gender: "FEMALE",
        emergencyContactName: "Portal Contact",
        emergencyContactRelation: "Sister",
        emergencyContactPhone: "9841055668",
        fatherName: "Portal Father",
        fatherPhone: "9841055669",
        motherName: "Portal Mother",
        motherPhone: "9841055670",
      },
    }),
    request.put(`${API}/employee/profile/address/PERMANENT`, {
      headers: authHeaders,
      data: {
        addressLine: "12 Portal Road",
        district: "Bengaluru Urban",
        city: "Bengaluru",
        state: "Karnataka",
        pincode: "560001",
      },
    }),
    request.put(`${API}/employee/profile/bank-details`, {
      headers: authHeaders,
      data: {
        accountHolderName: "Portal Employee",
        accountNumber: "123456789012",
        ifsc: "HDFC0001234",
        bankName: "Portal Test Bank",
      },
    }),
    request.put(`${API}/employee/profile/government-ids`, {
      headers: authHeaders,
      data: { aadhaarNumber: "123456789012", panNumber: "ABCDE1234F" },
    }),
  ]).then((results) =>
    results.forEach((res) => expect(res.ok(), res.url()).toBeTruthy()),
  );

  for (const documentType of REQUIRED_DOCUMENT_TYPES) {
    const res = await request.put(
      `${API}/employee/profile/documents/${documentType}/file`,
      {
        headers: authHeaders,
        multipart: {
          file: {
            name: "doc.pdf",
            mimeType: "application/pdf",
            buffer: DUMMY_PDF,
          },
        },
      },
    );
    expect(res.ok(), await res.text()).toBeTruthy();
  }

  const submitRes = await request.post(`${API}/employee/profile/submit`, {
    headers: authHeaders,
  });
  expect(submitRes.ok(), await submitRes.text()).toBeTruthy();
  const submitBody = (await submitRes.json()) as {
    data: { missing: string[] };
  };
  expect(submitBody.data.missing).toEqual([]);

  return employeeToken;
}

test.describe("Employee self-service portal navigation", () => {
  test("a fully onboarded Employee sees only employee_self_service tabs, never HR/Admin ones", async ({
    request,
    page,
  }) => {
    const token = await adminToken(request);
    const suffix = Date.now();
    const roleId = await createSelfServiceOnlyRole(
      request,
      token,
      `E2E Portal Role ${suffix}`,
    );

    const email = `portal-${suffix}@example.com`;
    const password = "PortalTest123!";
    const fullName = uniqueName("Portal Employee");
    const bankName = "Portal Test Bank";
    const fatherName = "Portal Father";

    const employeeToken = await createOnboardedEmployeeUser(request, token, {
      email,
      password,
      fullName,
      roleId,
    });
    const authHeaders = { Authorization: `Bearer ${employeeToken}` };

    // §7's guarantee, made literal by construction: this role was created
    // with exactly the employee_self_service.* catalog and nothing else
    // (createSelfServiceOnlyRole), so its JWT must carry zero hr.*
    // permissions. (Note: the seeded "Employee" role is a different story —
    // it legitimately holds a few hr.*.own/reference-data reads, e.g.
    // hr.shift_assignment.read.own, hr.holiday.read — this test doesn't use
    // that role precisely so it isn't exposed to that nuance or to whatever
    // the admin "Menu access" matrix has mutated it to.)
    const meRes = await request.get(`${API}/auth/me`, { headers: authHeaders });
    expect(meRes.ok(), await meRes.text()).toBeTruthy();
    const me = (await meRes.json()) as { data: { permissions: string[] } };
    expect(me.data.permissions.some((p) => p.startsWith("hr."))).toBe(false);
    expect(
      me.data.permissions.some((p) => p.startsWith("employee_self_service.")),
    ).toBe(true);

    // Now the real UI check: a completed profile lands on /portal, the
    // sidebar shows exactly the granted self-service tab, and My Profile
    // renders the data seeded above.
    await signIn(page, email, password);
    await expect(page).toHaveURL(/\/portal$/);

    const nav = page.getByRole("navigation");
    await expect(nav.locator("a[href='/portal/profile']")).toBeVisible();
    // The portal sidebar is flattened to this one root's children
    // (DynamicSidebar's `onlyRootCode="portal"`) — an HR or Admin link here
    // would mean the self-service/HR separation (Docs/ARCHITECTURE.md §7)
    // silently broke, regardless of what permissions this role holds.
    await expect(nav.getByText("HR", { exact: true })).toHaveCount(0);
    await expect(nav.getByText("Admin", { exact: true })).toHaveCount(0);
    await expect(nav.getByText("Employees", { exact: true })).toHaveCount(0);

    await nav.locator("a[href='/portal/profile']").click();
    await expect(page).toHaveURL(/\/portal\/profile/);
    await expect(
      page.getByRole("heading", { name: "My Profile" }),
    ).toBeVisible();
    await expect(page.getByText(fatherName)).toBeVisible();
    await expect(page.getByText(bankName)).toBeVisible();
  });

  test("a Team Lead sees Task Assignment only once hr.task.write.team is granted, and never a 'Go to HR/Admin' button", async ({
    request,
    page,
  }) => {
    const token = await adminToken(request);
    const suffix = Date.now();

    // Starts with the self-service catalog plus a team-scoped HR read, like
    // a real Team Lead (default-roles.ts) — deliberately NOT hr.task.*, so
    // the portal-task-assignment tab (packages/database/prisma/seed.ts,
    // gated by hr.task.write.team — Docs/ARCHITECTURE.md §7's documented
    // exception) must be absent until it's granted below.
    const { roleId, permissionIds } = await createRoleWithPermissions(
      request,
      token,
      `E2E Team Lead Role ${suffix}`,
      (code) =>
        code.startsWith("employee_self_service.") ||
        code === "hr.employee.read.team",
    );

    const email = `teamlead-${suffix}@example.com`;
    const password = "TeamLeadTest123!";
    const fullName = uniqueName("Portal Team Lead");

    await createOnboardedEmployeeUser(request, token, {
      email,
      password,
      fullName,
      roleId,
    });

    await signIn(page, email, password);
    await expect(page).toHaveURL(/\/portal$/);

    const nav = page.getByRole("navigation");
    await expect(nav.locator("a[href='/portal/task-assignment']")).toHaveCount(
      0,
    );
    await expect(
      page.getByRole("button", { name: "Go to HR/Admin" }),
    ).toHaveCount(0);

    // Grant the team-scoped task permissions an admin would enable via
    // Settings → Roles → Menu access, then confirm the tab appears without
    // creating a new session.
    const catalogRes = await request.get(`${API}/settings/permissions`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(catalogRes.ok(), await catalogRes.text()).toBeTruthy();
    const catalog = (
      (await catalogRes.json()) as { data: Array<{ id: number; code: string }> }
    ).data;
    const taskPermissionIds = catalog
      .filter(
        (p) =>
          p.code === "hr.task.read.team" || p.code === "hr.task.write.team",
      )
      .map((p) => p.id);
    expect(taskPermissionIds.length).toBe(2);

    const grantRes = await request.put(
      `${API}/settings/roles/${roleId}/permissions`,
      {
        headers: { Authorization: `Bearer ${token}` },
        data: { permissionIds: [...permissionIds, ...taskPermissionIds] },
      },
    );
    expect(grantRes.ok(), await grantRes.text()).toBeTruthy();

    // The access token is memory-only by design (apps/ui/src/stores/auth-store.ts)
    // — a page reload logs the user out entirely, so picking up the new grant
    // takes a fresh sign-in, exactly like a real admin-grants/user-relogs-in flow.
    await signIn(page, email, password);
    await expect(page).toHaveURL(/\/portal$/);
    await expect(
      nav.locator("a[href='/portal/task-assignment']"),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Go to HR/Admin" }),
    ).toHaveCount(0);

    await nav.locator("a[href='/portal/task-assignment']").click();
    await expect(page).toHaveURL(/\/portal\/task-assignment/);
    await expect(
      page.getByRole("heading", { name: "Task Assignment" }),
    ).toBeVisible();
  });
});
