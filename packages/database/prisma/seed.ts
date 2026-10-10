// Local-dev seed only — NOT run in CI, NOT a migration. Creates the single
// "Texawave Innovations" organization, its three teams (Docs/ARCHITECTURE.md
// §5.5), the starter permission catalog (reference-feature + settings/roles
// permissions — no HR permissions here; the HR module defines its own
// catalog, including the `.own`/`.team`/`.all` scope variants per
// Docs/CODING_STANDARDS.md §10a, when it's actually built), a "Super Admin"
// role granted every permission, and one Super Admin user with no team
// assignment (Super Admin uses `.all`-scoped permissions where they exist,
// bypassing team filtering entirely).
import bcrypt from "bcrypt";
import { PrismaClient, type Team } from "../generated/prisma/client.js";

const prisma = new PrismaClient();

const SUPER_ADMIN_EMAIL = "admin@texawave.com";
const SUPER_ADMIN_PASSWORD = "ChangeMe123!";

const TEAMS = [
  { name: "Software", code: "SW" },
  { name: "Mechanical", code: "ME" },
  { name: "Electrical", code: "EL" },
] as const;

const REFERENCE_PERMISSIONS = [
  { code: "reference.tags.read", description: "View reference tags" },
  {
    code: "reference.tags.write",
    description: "Create/update/delete reference tags",
  },
];

const SETTINGS_PERMISSIONS = [
  {
    code: "settings.role.read",
    description: "View roles and their permissions",
  },
  {
    code: "settings.role.write",
    description: "Create/rename roles and assign/revoke their permissions",
  },
];

const DEPARTMENTS_PERMISSIONS = [
  {
    code: "departments.department.read",
    description: "View departments",
  },
  {
    code: "departments.department.write",
    description: "Create/update/delete departments",
  },
];

const USERS_PERMISSIONS = [
  {
    code: "users.user.read",
    description: "View users and their assignments",
  },
  {
    code: "users.user.write",
    description: "Create/update users and assign roles or teams",
  },
];

const MENU_PERMISSIONS = [
  {
    code: "menu.item.read",
    description: "View navigation menu items",
  },
  {
    code: "menu.item.write",
    description: "Create/update/delete navigation menu items",
  },
];

async function main() {
  const org = await prisma.organization.upsert({
    where: { slug: "texawave-innovations" },
    update: {},
    create: { name: "Texawave Innovations", slug: "texawave-innovations" },
  });

  const teams = new Map<string, Team>();
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

  const allPermissionDefs = [
    ...REFERENCE_PERMISSIONS,
    ...SETTINGS_PERMISSIONS,
    ...DEPARTMENTS_PERMISSIONS,
    ...USERS_PERMISSIONS,
    ...MENU_PERMISSIONS,
  ];
  for (const permission of allPermissionDefs) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      update: { description: permission.description },
      create: permission,
    });
  }

  // Seed default menu items
  const defaultMenuItems = [
    // HR Module
    {
      code: "hr-dashboard",
      label: "Dashboard",
      path: "/hr",
      order: 1,
      parentId: null,
      permission: null,
    },
    {
      code: "hr-employees",
      label: "Employees",
      path: "/hr/employees",
      order: 2,
      parentId: null,
      permission: "users.user.read",
    },
    {
      code: "hr-departments",
      label: "Departments",
      path: "/hr/departments",
      order: 3,
      parentId: null,
      permission: "departments.department.read",
    },
    {
      code: "hr-teams",
      label: "Teams",
      path: "/hr/teams",
      order: 4,
      parentId: null,
      permission: null,
    },
    {
      code: "hr-attendance",
      label: "Attendance",
      path: "/hr/attendance",
      order: 5,
      parentId: null,
      permission: null,
    },
    {
      code: "hr-leaves",
      label: "Leaves",
      path: "/hr/leaves",
      order: 6,
      parentId: null,
      permission: null,
    },
    {
      code: "hr-payroll",
      label: "Payroll",
      path: "/hr/payroll",
      order: 7,
      parentId: null,
      permission: null,
    },

    // Settings Module
    {
      code: "settings-roles",
      label: "Roles & Permissions",
      path: "/settings/roles",
      order: 10,
      parentId: null,
      permission: "settings.role.read",
    },
    {
      code: "settings-menu",
      label: "Navigation Menu",
      path: "/admin/menu",
      order: 11,
      parentId: null,
      permission: "menu.item.read",
    },
    {
      code: "reference-tags",
      label: "Reference Tags",
      path: "/reference/tags",
      order: 12,
      parentId: null,
      permission: "reference.tags.read",
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

  const adminDesignation = await prisma.designation.upsert({
    where: {
      organizationId_code: {
        organizationId: org.id,
        code: "EXEC_01",
      },
    },
    update: {},
    create: {
      organizationId: org.id,
      code: "EXEC_01",
      name: "Managing Director",
    },
  });

  const swTeam = teams.get("SW");
  const permanentType = await prisma.employmentType.findFirst({
    where: { organizationId: org.id, code: "PERMANENT" },
  });

  if (swTeam && permanentType) {
    await prisma.employee.upsert({
      where: {
        userId: superAdminUser.id,
      },
      update: {
        fullName: "Super Admin",
        status: "ACTIVE",
        onboardingStatus: "COMPLETE",
      },
      create: {
        organizationId: org.id,
        employeeCode: "EMP-000001",
        userId: superAdminUser.id,
        fullName: "Super Admin",
        workEmail: SUPER_ADMIN_EMAIL,
        teamId: swTeam.id,
        departmentId: swTeam.departmentId,
        designationId: adminDesignation.id,
        employmentTypeId: permanentType.id,
        status: "ACTIVE",
        onboardingStatus: "COMPLETE",
        dateOfJoining: new Date("2026-01-01"),
      },
    });

    await prisma.documentSequence.upsert({
      where: {
        organizationId_docType: { organizationId: org.id, docType: "employee" },
      },
      update: {
        nextNumber: 2,
      },
      create: {
        organizationId: org.id,
        docType: "employee",
        prefix: "EMP-",
        padding: 6,
        nextNumber: 2,
      },
    });
  }

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
