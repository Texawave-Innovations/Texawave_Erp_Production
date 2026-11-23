import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * Where a new hire lands after submitting the onboarding wizard.
 *
 * Regression: an HR Manager hire (hr.workspace.access) used to be sent to
 * /portal on submit — the wizard and the portal layout both hard-coded it —
 * and the portal had no way back to /hr. Finishing onboarding now follows
 * the same rule as sign-in (apps/ui/src/features/auth/landing.ts): HR staff
 * go to the HR workspace, everyone else to the portal.
 *
 * The API is mocked (the server's own onboarding rules are covered by the
 * apps/api e2e suites); the profile flips to COMPLETE when the wizard submits.
 */
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "none", typ: "JWT" })}.${b64(payload)}.sig`;
}

const EMPLOYEE_PERMS = [
  "employee_self_service.profile.read",
  "employee_self_service.profile.write",
];
const HR_PERMS = [
  "hr.workspace.access",
  "hr.employee.read.all",
  ...EMPLOYEE_PERMS,
];

function menuFor(workspace: "hr" | "portal") {
  const child =
    workspace === "hr"
      ? { code: "hr-dashboard", label: "Dashboard", path: "/hr/dashboard" }
      : {
          code: "portal-profile",
          label: "My Profile",
          path: "/portal/profile",
        };
  return [
    {
      id: 1,
      code: workspace,
      label: workspace === "hr" ? "HR" : "My Portal",
      path: null,
      icon: null,
      order: 1,
      parentId: null,
      permission: null,
      children: [
        {
          id: 2,
          ...child,
          icon: null,
          order: 1,
          parentId: 1,
          permission: null,
          children: [],
        },
      ],
    },
  ];
}

/** Mocks the API for a hire whose onboarding is incomplete until submitted,
 * then signs in through the real login form. */
async function signInAsNewHire(
  page: Page,
  permissions: string[],
  workspace: "hr" | "portal",
): Promise<void> {
  let onboardingStatus = "IN_PROGRESS";

  await page.route(`${API}/**`, async (route: Route) => {
    const req = route.request();
    const { pathname } = new URL(req.url());
    const method = req.method();
    const json = (status: number, body: unknown) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });

    if (pathname === "/auth/login") {
      return json(200, {
        data: {
          accessToken: jwt({ organizationId: 1, sub: 8 }),
          refreshToken: "r",
        },
      });
    }
    if (pathname === "/auth/me") {
      return json(200, {
        data: {
          userId: 8,
          organizationId: 1,
          email: "new.hire@texawave.test",
          fullName: "New Hire",
          roleIds: [2, 4],
          permissions,
        },
      });
    }
    if (pathname === "/menu/my-menu") {
      return json(200, { data: menuFor(workspace) });
    }
    if (pathname === "/employee/profile" && method === "GET") {
      return json(200, {
        data: {
          id: 8,
          employeeCode: "EMP-000008",
          fullName: "New Hire",
          onboardingStatus,
        },
      });
    }
    if (pathname === "/employee/profile/submit") {
      onboardingStatus = "COMPLETE";
      return json(200, { data: { missing: [] } });
    }
    if (pathname.startsWith("/employee/profile/")) {
      if (method !== "GET") return json(200, { data: {} });
      const isList = /\/(family|experience|documents)$/.test(pathname);
      return json(200, { data: isList ? [] : null });
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
  await page.getByLabel("Email").fill("new.hire@texawave.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("not-checked-by-mock");
  await page.getByRole("button", { name: "Sign in" }).click();
}

/** Fills each wizard step with valid values and submits it. Required labels
 * carry an asterisk in their accessible name, so labels match the start. */
async function completeWizard(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/onboarding$/);

  // Step 1 — personal details
  await page.getByLabel(/^Date of birth/).fill("1995-05-10");
  await page.getByLabel(/^Gender/).selectOption("MALE");
  await page.getByLabel(/^Contact person name/).fill("Ramesh Kumar");
  await page.getByLabel(/^Relationship/).fill("Brother");
  await page.getByLabel(/^Emergency phone number/).fill("9841055667");
  await page.getByLabel(/^Father's full name/).fill("Suresh Kumar");
  await page.getByLabel(/^Father's contact phone/).fill("9841055668");
  await page.getByLabel(/^Mother's full name/).fill("Lakshmi Kumar");
  await page.getByLabel(/^Mother's contact phone/).fill("9841055669");
  await page
    .getByRole("button", { name: "Save & Continue to Address" })
    .click();

  // Step 2 — address (present address defaults to "same as permanent")
  await page.getByLabel(/^Address line/).fill("14/B, Gandhi Street");
  await page.getByLabel(/^District/).fill("Chennai");
  await page.getByLabel(/^City/).fill("Chennai");
  await page.getByLabel(/^State/).fill("Tamil Nadu");
  await page.getByLabel(/^Pincode/).fill("600040");
  await page
    .getByRole("button", { name: "Save & Continue to Bank & IDs" })
    .click();

  // Step 3 — bank & statutory IDs
  await page.getByLabel(/^Account holder's full name/).fill("New Hire");
  await page.getByLabel(/^Bank account number/).fill("123456789012");
  await page.getByLabel(/^IFSC code/).fill("HDFC0001234");
  await page.getByLabel(/^Bank name/).fill("HDFC Bank");
  await page.getByLabel(/^Aadhaar number/).fill("234567890123");
  await page.getByLabel(/^PAN number/).fill("ABCDE1234F");
  await page
    .getByRole("button", { name: "Save & Continue to Family & Experience" })
    .click();

  // Steps 4–5 — optional family/experience and documents
  await page
    .getByRole("button", { name: "Continue to Document Uploads" })
    .click();
  await page.getByRole("button", { name: "Continue to Final Review" }).click();

  await page.getByRole("button", { name: "Submit Profile to HR" }).click();
}

test("an HR Manager hire lands in the HR workspace after submitting onboarding", async ({
  page,
}) => {
  await signInAsNewHire(page, HR_PERMS, "hr");
  await completeWizard(page);

  await expect(page).toHaveURL(/\/hr$/);
  await expect(page.getByRole("main", { name: "HR dashboard" })).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "My Portal Navigation" }),
  ).toHaveCount(0);
});

test("a plain employee hire lands in the portal, with no HR Workspace link", async ({
  page,
}) => {
  await signInAsNewHire(page, EMPLOYEE_PERMS, "portal");
  await completeWizard(page);

  await expect(page).toHaveURL(/\/portal$/);
  await expect(
    page.getByRole("navigation", { name: "My Portal Navigation" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "HR Workspace" })).toHaveCount(0);
});
