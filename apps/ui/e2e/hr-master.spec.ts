import { expect, type Page, test } from "@playwright/test";
import {
  type MockAnswer,
  type MockRequest,
  page1,
  signInWithMockedApi,
} from "./helpers/mock-api";

/**
 * HR Master screen: the shared Masters tab bar renders with HR Master
 * active and the still-paused tabs (Stores/Projects) non-interactive, all
 * five resource cards render, add+delete on the Departments card round-trips
 * through the mocked API and shows a success toast, and a reader without
 * write permission sees no Add button. API fully mocked — the backend's own
 * rules are proven by the modules' own apps/api e2e suites.
 */

let departments = [
  {
    id: 1,
    organizationId: 1,
    name: "Engineering",
    isActive: true,
    customFields: {},
    createdBy: 1,
    updatedBy: 1,
    createdAt: "2026-10-01T10:00:00.000Z",
    updatedAt: "2026-10-01T10:00:00.000Z",
    deletedAt: null,
  },
];

const DESIGNATIONS = [
  {
    id: 1,
    organizationId: 1,
    code: "ENGINEER",
    name: "Engineer",
    description: null,
    isActive: true,
    customFields: {},
    createdBy: 1,
    updatedBy: 1,
    createdAt: "2026-10-01T10:00:00.000Z",
    updatedAt: "2026-10-01T10:00:00.000Z",
    deletedAt: null,
  },
];

const WORK_LOCATIONS = [
  {
    id: 1,
    organizationId: 1,
    code: "HQ",
    name: "Head Office",
    description: null,
    isActive: true,
    customFields: {},
    createdBy: 1,
    updatedBy: 1,
    createdAt: "2026-10-01T10:00:00.000Z",
    updatedAt: "2026-10-01T10:00:00.000Z",
    deletedAt: null,
  },
];

const LEAVE_TYPES = [
  {
    id: 1,
    organizationId: 1,
    code: "CASUAL",
    name: "Casual leave",
    description: null,
    isPaid: true,
    annualEntitlement: 12,
    carryForwardLimit: 0,
    approvalLevels: 1,
    isActive: true,
    customFields: {},
    createdBy: 1,
    updatedBy: 1,
    createdAt: "2026-10-01T10:00:00.000Z",
    updatedAt: "2026-10-01T10:00:00.000Z",
    deletedAt: null,
  },
];

const SHIFTS = [
  {
    id: 1,
    organizationId: 1,
    code: "GENERAL",
    name: "General shift",
    description: null,
    startTime: "09:00",
    endTime: "18:00",
    workingMinutes: 480,
    isActive: true,
    customFields: {},
    createdBy: 1,
    updatedBy: 1,
    createdAt: "2026-10-01T10:00:00.000Z",
    updatedAt: "2026-10-01T10:00:00.000Z",
    deletedAt: null,
  },
];

function handler(req: MockRequest): MockAnswer | undefined {
  const { method, pathname, body } = req;

  if (pathname === "/departments" && method === "GET")
    return { body: page1(departments) };
  if (pathname === "/departments" && method === "POST") {
    const created = {
      id: 2,
      organizationId: 1,
      name: (body as { name: string }).name,
      isActive: true,
      customFields: {},
      createdBy: 1,
      updatedBy: 1,
      createdAt: "2026-10-01T10:00:00.000Z",
      updatedAt: "2026-10-01T10:00:00.000Z",
      deletedAt: null,
    };
    departments = [...departments, created];
    return { status: 201, body: { data: created } };
  }
  if (pathname.startsWith("/departments/") && method === "DELETE") {
    const id = Number(pathname.split("/")[2]);
    departments = departments.filter((d) => d.id !== id);
    return { status: 204, body: {} };
  }

  if (pathname === "/master-data/designations" && method === "GET")
    return { body: page1(DESIGNATIONS) };
  if (pathname === "/master-data/work-locations" && method === "GET")
    return { body: page1(WORK_LOCATIONS) };
  if (pathname === "/hr/leave-types" && method === "GET")
    return { body: page1(LEAVE_TYPES) };
  if (pathname === "/master-data/shifts" && method === "GET")
    return { body: page1(SHIFTS) };

  return undefined;
}

const READ = [
  "departments.department.read",
  "master.designation.read",
  "master.work_location.read",
  "hr.leave_type.read",
  "master.shift.read",
];
const WRITE = [
  "departments.department.write",
  "master.designation.write",
  "master.work_location.write",
  "hr.leave_type.write",
  "master.shift.write",
];

async function openHrMaster(page: Page, extraPermissions: string[] = []) {
  const session = await signInWithMockedApi(page, {
    workspace: "hr",
    permissions: ["hr.workspace.access", ...READ, ...extraPermissions],
    menu: [
      {
        code: "sales-settings",
        label: "Sales Settings",
        path: "/settings/sales-settings",
      },
    ],
    handler,
  });
  await page.goto("/settings/masters/hr");
  return session;
}

test("shows the Masters tab bar with HR Master active and the paused tabs disabled", async ({
  page,
}) => {
  await openHrMaster(page);

  const hrTab = page.getByRole("link", { name: "HR Master" });
  await expect(hrTab).toBeVisible();

  for (const label of ["Stores Master", "Projects Master"]) {
    await expect(page.getByRole("link", { name: label })).toHaveCount(0);
    await expect(page.getByText(label)).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  }

  await expect(
    page.getByRole("link", { name: "Sales & Document Masters" }),
  ).toHaveAttribute("href", "/settings/sales-settings");
});

test("renders all five HR Master cards", async ({ page }) => {
  await openHrMaster(page);

  await expect(
    page.getByRole("heading", { name: "Departments" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Designations" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Office Locations" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Leave Types" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Shifts" })).toBeVisible();

  await expect(page.getByText("Engineering")).toBeVisible();
});

test("adds and deletes a department chip, showing success toasts", async ({
  page,
}) => {
  await openHrMaster(page, WRITE);

  await page.getByLabel("New Departments value").fill("Finance");
  await page.getByLabel("New Departments value").press("Enter");

  await expect(page.getByText("Department added")).toBeVisible();
  await expect(page.getByText("Finance")).toBeVisible();

  await page.getByRole("button", { name: "Remove Engineering" }).click();
  await expect(page.getByText("Department removed")).toBeVisible();
});

test("a reader without write permission sees no Add button", async ({
  page,
}) => {
  await openHrMaster(page);

  await expect(page.getByLabel("New Departments value")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Remove Engineering" }),
  ).toHaveCount(0);
});
