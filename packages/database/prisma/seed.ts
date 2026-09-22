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
import { PrismaClient } from "../generated/prisma/client.js";

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

// Gates apps/api/src/modules/settings/roles/ — no `.scope` suffix, not
// team-scoped data (Docs/CODING_STANDARDS.md §2a).
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

  const allPermissionDefs = [...REFERENCE_PERMISSIONS, ...SETTINGS_PERMISSIONS];
  for (const permission of allPermissionDefs) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      update: { description: permission.description },
      create: permission,
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
