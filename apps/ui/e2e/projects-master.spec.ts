import { expect, type Page, test } from "@playwright/test";
import {
  type MockAnswer,
  type MockRequest,
  navigateToMasterTab,
  page1,
  signInWithMockedApi,
} from "./helpers/mock-api";

/**
 * Projects Master Lists screen (Docs/PROJECTS_MASTER.md): the Masters tab
 * bar renders with Projects Master active, the three sub-tabs (Project
 * Master / Project Code Master / Task Running Number Master) each render
 * their seeded data, add+edit+delete on the Project Master tab round-trips
 * through the mocked API, saving the two format tabs round-trips through
 * PUT, and a reader without write permission sees no write affordances.
 * API fully mocked — the backend's own rules are proven by
 * apps/api/test/projects-master.e2e-spec.ts.
 */

let projects: {
  id: number;
  organizationId: number;
  code: string;
  name: string;
  description: string | null;
  createdBy: number;
  updatedBy: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}[] = [
  {
    id: 1,
    organizationId: 1,
    code: "ME",
    name: "Mechanical Engineering",
    description: null,
    createdBy: 1,
    updatedBy: 1,
    createdAt: "2026-10-01T10:00:00.000Z",
    updatedAt: "2026-10-01T10:00:00.000Z",
    deletedAt: null,
  },
];

let codeMaster = {
  id: 1,
  organizationId: 1,
  companyPrefix: "TW",
  moduleIdentifier: "PRJ",
  defaultProjectCode: "ME",
  financialYear: "26-27",
  sequenceDigits: 4,
  updatedBy: 1,
  createdAt: "2026-10-01T10:00:00.000Z",
  updatedAt: "2026-10-01T10:00:00.000Z",
};

let taskNumberMaster = {
  id: 1,
  organizationId: 1,
  taskPrefix: "T",
  separator: "-",
  sequenceDigits: 3,
  updatedBy: 1,
  createdAt: "2026-10-01T10:00:00.000Z",
  updatedAt: "2026-10-01T10:00:00.000Z",
};

function handler(req: MockRequest): MockAnswer | undefined {
  const { method, pathname, body } = req;

  if (pathname === "/projects-master/projects" && method === "GET")
    return { body: page1(projects) };

  if (pathname === "/projects-master/projects" && method === "POST") {
    const input = body as { code: string; name: string; description?: string };
    const created = {
      id: 2,
      organizationId: 1,
      code: input.code,
      name: input.name,
      description: input.description ?? null,
      createdBy: 1,
      updatedBy: 1,
      createdAt: "2026-10-01T10:00:00.000Z",
      updatedAt: "2026-10-01T10:00:00.000Z",
      deletedAt: null,
    };
    projects = [...projects, created];
    return { status: 201, body: { data: created } };
  }

  if (pathname.startsWith("/projects-master/projects/") && method === "PATCH") {
    const id = Number(pathname.split("/")[3]);
    const input = body as {
      code?: string;
      name?: string;
      description?: string;
    };
    projects = projects.map((p) => (p.id === id ? { ...p, ...input } : p));
    return { body: { data: projects.find((p) => p.id === id) } };
  }

  if (
    pathname.startsWith("/projects-master/projects/") &&
    method === "DELETE"
  ) {
    const id = Number(pathname.split("/")[3]);
    projects = projects.filter((p) => p.id !== id);
    return { status: 204, body: {} };
  }

  if (pathname === "/projects-master/code-master" && method === "GET")
    return { body: { data: codeMaster } };
  if (pathname === "/projects-master/code-master" && method === "PUT") {
    codeMaster = { ...codeMaster, ...(body as object) };
    return { body: { data: codeMaster } };
  }

  if (
    pathname === "/projects-master/task-running-number-master" &&
    method === "GET"
  )
    return { body: { data: taskNumberMaster } };
  if (
    pathname === "/projects-master/task-running-number-master" &&
    method === "PUT"
  ) {
    taskNumberMaster = { ...taskNumberMaster, ...(body as object) };
    return { body: { data: taskNumberMaster } };
  }

  return undefined;
}

const READ = [
  "projects_master.project.read",
  "projects_master.project_code_master.read",
  "projects_master.task_running_number_master.read",
];
const WRITE = [
  "projects_master.project.write",
  "projects_master.project_code_master.write",
  "projects_master.task_running_number_master.write",
];

async function openProjectsMaster(page: Page, extraPermissions: string[] = []) {
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
  await navigateToMasterTab(page, "Projects Master");
  return session;
}

test("shows the Masters tab bar with Projects Master active", async ({
  page,
}) => {
  await openProjectsMaster(page);

  await expect(
    page.getByRole("link", { name: "Projects Master" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Projects Master Lists" }),
  ).toBeVisible();
});

test("renders the Project Master tab with its seeded row", async ({ page }) => {
  await openProjectsMaster(page);

  await expect(
    page.getByRole("heading", { name: "Projects Master List", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Mechanical Engineering")).toBeVisible();
  await expect(page.getByText("ME", { exact: true })).toBeVisible();
});

test("adds, edits and deletes a project on the Project Master tab", async ({
  page,
}) => {
  const { calls } = await openProjectsMaster(page, WRITE);

  // The ui-kit Dialog keeps both the create and edit dialogs mounted in the
  // DOM at all times (only the native <dialog>'s `open` attribute toggles),
  // so a bare page.getByLabel(...) matches fields in both. Scope every
  // locator to the currently open dialog (`dialog[open]`) to avoid strict
  // mode violations.
  const openDialog = () => page.locator("dialog[open]");

  await page.getByRole("button", { name: "Add New Project" }).click();
  await openDialog().getByLabel("Project Code").fill("SW");
  await openDialog().getByLabel("Project Name").fill("Software Engineering");
  await openDialog().getByRole("button", { name: "Add", exact: true }).click();

  await expect(page.getByText("Project created")).toBeVisible();
  await expect(page.getByText("Software Engineering")).toBeVisible();
  expect(
    calls.some(
      (c) =>
        c.startsWith("POST /projects-master/projects") &&
        c.includes("Software Engineering"),
    ),
  ).toBe(true);

  await page
    .getByRole("button", { name: "Edit Mechanical Engineering" })
    .click();
  await openDialog()
    .getByLabel("Project Name")
    .fill("Mechanical Engineering Dept");
  await openDialog().getByRole("button", { name: "Save changes" }).click();

  await expect(page.getByText("Project updated")).toBeVisible();
  await expect(page.getByText("Mechanical Engineering Dept")).toBeVisible();

  page.once("dialog", (dialog) => void dialog.accept());
  await page
    .getByRole("button", { name: "Delete Mechanical Engineering Dept" })
    .click();

  await expect(
    page.getByText('Deleted "Mechanical Engineering Dept"'),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "Mechanical Engineering Dept" }),
  ).toHaveCount(0);
});

test("a reader without write permission sees no write affordances on the Project Master tab", async ({
  page,
}) => {
  await openProjectsMaster(page);

  await expect(
    page.getByRole("button", { name: "Add New Project" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Edit Mechanical Engineering" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Delete Mechanical Engineering" }),
  ).toHaveCount(0);
});

test("renders and saves the Project Code Master tab", async ({ page }) => {
  const { calls } = await openProjectsMaster(page, WRITE);

  await page.getByRole("tab", { name: "2. Project Code Master" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Project Code Generation Pattern & Standard",
    }),
  ).toBeVisible();
  await expect(page.getByLabel("Company Prefix")).toHaveValue("TW");

  await page.getByLabel("Module Identifier").fill("PROJ");
  await page.getByRole("button", { name: "Save Code Master" }).click();

  await expect(page.getByText("Project code format saved")).toBeVisible();
  expect(
    calls.some(
      (c) =>
        c.startsWith("PUT /projects-master/code-master") && c.includes("PROJ"),
    ),
  ).toBe(true);
});

test("renders and saves the Task Running Number Master tab", async ({
  page,
}) => {
  const { calls } = await openProjectsMaster(page, WRITE);

  await page
    .getByRole("tab", { name: "3. Task Running Number Master" })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Task Code & Running Number Generation Standard",
    }),
  ).toBeVisible();
  await expect(page.getByLabel("Task Prefix / Tag")).toHaveValue("T");

  await page.getByLabel("Separator").fill("/");
  await page.getByRole("button", { name: "Save Task Code Master" }).click();

  await expect(page.getByText("Task code format saved")).toBeVisible();
  expect(
    calls.some(
      (c) =>
        c.startsWith("PUT /projects-master/task-running-number-master") &&
        c.includes('"separator":"/"'),
    ),
  ).toBe(true);
});

test("a reader without write permission sees no Save button on the format tabs", async ({
  page,
}) => {
  await openProjectsMaster(page);

  await page.getByRole("tab", { name: "2. Project Code Master" }).click();
  await expect(
    page.getByRole("button", { name: "Save Code Master" }),
  ).toHaveCount(0);

  await page
    .getByRole("tab", { name: "3. Task Running Number Master" })
    .click();
  await expect(
    page.getByRole("button", { name: "Save Task Code Master" }),
  ).toHaveCount(0);
});
