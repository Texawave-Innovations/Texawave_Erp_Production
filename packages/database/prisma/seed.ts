// Local-dev seed only — NOT run in CI, NOT a migration. Creates the single
// "Texawave Innovations" organization, its three teams (Docs/ARCHITECTURE.md
// §5.5), the permission catalogue (prisma/permissions/catalog.ts — synced by
// the same code every environment uses, so this seed can't drift from
// staging/production), a "Super Admin"
// role granted every permission, and one Super Admin user with no team
// assignment (Super Admin uses `.all`-scoped permissions where they exist,
// bypassing team filtering entirely).
import bcrypt from "bcrypt";
import { PrismaClient } from "../generated/prisma/client.js";
import { DEFAULT_ROLES } from "./permissions/default-roles.js";
import { syncPermissions } from "./permissions/sync.js";

const prisma = new PrismaClient();

const SUPER_ADMIN_EMAIL = "admin@texawave.com";
const SUPER_ADMIN_PASSWORD = "ChangeMe123!";

const TEAMS = [
  { name: "Software", code: "SW" },
  { name: "Mechanical", code: "ME" },
  { name: "Electrical", code: "EL" },
] as const;

async function main() {
  const org = await prisma.organization.upsert({
    where: { slug: "texawave-innovations" },
    update: {},
    create: { name: "Texawave Innovations", slug: "texawave-innovations" },
  });

  const teams = new Map<string, { id: number }>();
  for (const team of TEAMS) {
    // One Department per Team, 1:1 — a placeholder so local dev data stays
    // coherent now that `teams.department_id` exists (Docs/ARCHITECTURE.md
    // §11 changelog, 2026-09-22), NOT the intended final shape: a real
    // Department will eventually own multiple Teams (e.g. one "Engineering"
    // department over Software + Electrical). Don't build against this
    // being permanently 1:1.
    const department = await prisma.department.upsert({
      where: {
        organizationId_name: { organizationId: org.id, name: team.name },
      },
      update: {},
      create: { organizationId: org.id, name: team.name },
    });

    const row = await prisma.team.upsert({
      where: {
        organizationId_code: { organizationId: org.id, code: team.code },
      },
      update: { name: team.name, departmentId: department.id },
      create: {
        organizationId: org.id,
        name: team.name,
        code: team.code,
        departmentId: department.id,
      },
    });
    teams.set(team.code, row);
  }

  // The permission catalogue lives in prisma/permissions/catalog.ts and is
  // what every environment (not just this local seed) is synced to via
  // `pnpm --filter @texawave-erp/database permissions:sync`.
  await syncPermissions(prisma);

  // Seed default menu items
  const adminParent = await prisma.menuItem.upsert({
    where: {
      organizationId_code: { organizationId: org.id, code: "admin" },
    },
    update: { label: "Admin", order: 10 },
    create: {
      organizationId: org.id,
      code: "admin",
      label: "Admin",
      order: 10,
    },
  });

  // `hr.employee.read`/`hr.interview.read`/etc. are `.own`/`.team`/`.all`
  // scoped triplets (or role-specific codes) — there is no single catalog
  // code that means "can see this HR screen", and MenuItem.permission only
  // stores one exact code (menu.service.ts matches it verbatim, no
  // prefix/any-of support). So, like "Dashboard" above, these items are left
  // ungated (permission: null) and the pages themselves do the real,
  // multi-permission check per section/tab (HrDashboardView, EmployeesView,
  // RecruitmentView) — the API remains the authoritative enforcement point.
  const hrParent = await prisma.menuItem.upsert({
    where: {
      organizationId_code: { organizationId: org.id, code: "hr" },
    },
    update: { label: "HR", order: 3 },
    create: {
      organizationId: org.id,
      code: "hr",
      label: "HR",
      order: 3,
    },
  });

  const defaultMenuItems = [
    {
      code: "dashboard",
      label: "Dashboard",
      path: "/",
      order: 1,
      parentId: null,
      permission: null,
    },
    {
      code: "reference-tags",
      label: "Reference Tags",
      path: "/reference/tags",
      order: 2,
      parentId: null,
      permission: "reference.tags.read",
    },
    {
      code: "hr-dashboard",
      label: "Dashboard",
      path: "/hr/dashboard",
      order: 1,
      parentId: hrParent.id,
      permission: null,
    },
    {
      code: "hr-employees",
      label: "Employees",
      path: "/hr/employees",
      order: 2,
      parentId: hrParent.id,
      permission: null,
    },
    {
      code: "hr-profiles",
      label: "Profiles",
      path: "/hr/profiles",
      order: 3,
      parentId: hrParent.id,
      permission: "hr.employee_profile.read",
    },
    {
      code: "hr-org-chart",
      label: "Org Chart",
      path: "/hr/org-chart",
      order: 4,
      parentId: hrParent.id,
      permission: "hr.employee.read",
    },
    {
      code: "hr-recruitment",
      label: "Recruitment",
      path: "/hr/recruitment",
      order: 5,
      parentId: hrParent.id,
      permission: null,
    },
    {
      code: "hr-work-logs",
      label: "Work Logs",
      path: "/hr/work-logs",
      order: 6,
      parentId: hrParent.id,
      permission: null,
    },
    {
      code: "hr-attendance",
      label: "Attendance",
      path: "/hr/attendance",
      order: 7,
      parentId: hrParent.id,
      permission: null,
    },
    {
      code: "hr-regularization",
      label: "Regularization",
      path: "/hr/regularization",
      order: 8,
      parentId: hrParent.id,
      permission: null,
    },
    {
      code: "hr-location-privilege",
      label: "Location Privilege",
      path: "/hr/location-privilege",
      order: 9,
      parentId: hrParent.id,
      permission: "hr.location_privilege.read",
    },
    {
      code: "hr-tasks",
      label: "Task Assignment",
      path: "/hr/tasks",
      order: 10,
      parentId: hrParent.id,
      permission: null,
    },
    {
      code: "hr-leaves",
      label: "Leaves",
      path: "/hr/leaves",
      order: 11,
      parentId: hrParent.id,
      permission: null,
    },
    {
      code: "hr-full-month-present",
      label: "Full Month Present",
      path: "/hr/full-month-present",
      order: 12,
      parentId: hrParent.id,
      permission: "hr.attendance_report.read",
    },
    {
      code: "hr-expense-approvals",
      label: "Expense Approvals",
      path: "/hr/expense-approvals",
      order: 13,
      parentId: hrParent.id,
      permission: null,
    },
    {
      code: "hr-tickets",
      label: "Employee Tickets",
      path: "/hr/tickets",
      order: 14,
      parentId: hrParent.id,
      permission: "hr.ticket.read",
    },
    {
      code: "hr-exit-requests",
      label: "Exit Requests",
      path: "/hr/exit-requests",
      order: 15,
      parentId: hrParent.id,
      permission: null,
    },
    {
      code: "hr-payroll",
      label: "Payroll",
      path: "/hr/payroll",
      order: 16,
      parentId: hrParent.id,
      permission: null,
    },
    {
      code: "hr-compliance",
      label: "Compliance",
      path: "/hr/compliance",
      order: 17,
      parentId: hrParent.id,
      permission: null,
    },
    {
      code: "admin-departments",
      label: "Departments",
      path: "/admin/departments",
      order: 1,
      parentId: adminParent.id,
      permission: "departments.department.read",
    },
    {
      code: "admin-roles",
      label: "Roles",
      path: "/admin/roles",
      order: 3,
      parentId: adminParent.id,
      permission: "settings.role.read",
    },
    {
      code: "admin-users",
      label: "Users",
      path: "/admin/users",
      order: 4,
      parentId: adminParent.id,
      permission: "users.user.read",
    },
    {
      code: "admin-menu",
      label: "Navigation Menu",
      path: "/admin/menu",
      order: 5,
      parentId: adminParent.id,
      permission: "menu.item.read",
    },
  ];

  for (const item of defaultMenuItems) {
    await prisma.menuItem.upsert({
      where: {
        organizationId_code: { organizationId: org.id, code: item.code },
      },
      update: {
        label: item.label,
        path: item.path,
        order: item.order,
        parentId: item.parentId,
        permission: item.permission,
      },
      create: {
        organizationId: org.id,
        code: item.code,
        label: item.label,
        path: item.path,
        order: item.order,
        parentId: item.parentId,
        permission: item.permission,
      },
    });
  }

  const superAdminRole = await prisma.role.upsert({
    where: {
      organizationId_name: { organizationId: org.id, name: "Super Admin" },
    },
    update: {},
    create: { organizationId: org.id, name: "Super Admin" },
  });

  const allPermissions = await prisma.permission.findMany();
  await prisma.rolePermission.deleteMany({
    where: { roleId: superAdminRole.id },
  });
  await prisma.rolePermission.createMany({
    data: allPermissions.map((permission) => ({
      roleId: superAdminRole.id,
      permissionId: permission.id,
    })),
  });

  // The approved employment types. (The HR migration inserts them for
  // organizations that already exist; this covers an organization created
  // afterwards, e.g. a fresh dev database.) Insert-only: never overwrites an
  // edited row. Probation/notice stay NULL — those rules are not approved.
  for (const type of [
    { code: "PERMANENT", name: "Permanent" },
    { code: "CONTRACT", name: "Contract" },
    { code: "TEMPORARY", name: "Temporary" },
    { code: "INTERN", name: "Intern" },
  ]) {
    await prisma.employmentType.upsert({
      where: {
        organizationId_code: { organizationId: org.id, code: type.code },
      },
      update: {},
      create: { organizationId: org.id, ...type },
    });
  }

  // Starter HR roles for local dev (prisma/permissions/default-roles.ts).
  // ADDITIVE: grants what is listed, never removes a grant an administrator
  // added, and `update: {}` means a grant an administrator REVOKED stays
  // revoked. Team Lead is read-only by default (pinned by a test).
  for (const definition of DEFAULT_ROLES) {
    const role = await prisma.role.upsert({
      where: {
        organizationId_name: { organizationId: org.id, name: definition.name },
      },
      update: {},
      create: { organizationId: org.id, name: definition.name },
    });
    const permissions = await prisma.permission.findMany({
      where: { code: { in: [...definition.permissions] } },
      select: { id: true },
    });
    for (const permission of permissions) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: role.id, permissionId: permission.id },
        },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }

  const passwordHash = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 10);
  const superAdminUser = await prisma.user.upsert({
    where: {
      organizationId_email: {
        organizationId: org.id,
        email: SUPER_ADMIN_EMAIL,
      },
    },
    update: {},
    create: {
      organizationId: org.id,
      email: SUPER_ADMIN_EMAIL,
      passwordHash,
      fullName: "Super Admin",
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: { userId: superAdminUser.id, roleId: superAdminRole.id },
    },
    update: {},
    create: { userId: superAdminUser.id, roleId: superAdminRole.id },
  });
  // Deliberately no UserTeamAccess row for the Super Admin — `.all`-scoped
  // permissions bypass team filtering entirely (Docs/ARCHITECTURE.md §5.5).

  console.log(
    `Seeded organization "Texawave Innovations" (slug: texawave-innovations) with teams ${TEAMS.map((t) => t.code).join(", ")} ` +
      `and Super Admin ${SUPER_ADMIN_EMAIL} / ${SUPER_ADMIN_PASSWORD} — local dev only, never use this in a real environment.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
