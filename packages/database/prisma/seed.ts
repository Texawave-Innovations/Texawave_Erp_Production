// Local-dev seed only — NOT run in CI, NOT a migration. Creates the single
// "Texawave Innovations" organization, its three teams (Docs/ARCHITECTURE.md
// §5.5), the HR permission catalog (.own/.team/.all variants —
// Docs/CODING_STANDARDS.md §10a) plus the reference-feature permissions, a
// "Super Admin" role granted every permission, and one Super Admin user with
// no team assignment (Super Admin uses `.all` scope, bypassing team
// filtering entirely).
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

// Starter HR permission catalog — real entities/actions get filled in as
// the HR module itself is built; this seeds the `.own`/`.team`/`.all`
// pattern (Docs/CODING_STANDARDS.md §10a PR checklist: all three variants
// get seeded up front, even if only one is used today).
const HR_SCOPED_PERMISSIONS = [
  { entity: "employee", action: "read" },
  { entity: "employee", action: "write" },
  { entity: "attendance", action: "read" },
  { entity: "attendance", action: "write" },
  { entity: "leave", action: "approve" },
  { entity: "payroll", action: "read" },
] as const;
const SCOPES = ["own", "team", "all"] as const;

const REFERENCE_PERMISSIONS = [
  { code: "reference.tags.read", description: "View reference tags" },
  {
    code: "reference.tags.write",
    description: "Create/update/delete reference tags",
  },
];

function hrPermissions(): Array<{ code: string; description: string }> {
  return HR_SCOPED_PERMISSIONS.flatMap(({ entity, action }) =>
    SCOPES.map((scope) => ({
      code: `hr.${entity}.${action}.${scope}`,
      description: `${scope === "all" ? "Any" : scope === "team" ? "Own team's" : "Own"} ${entity} ${action}`,
    })),
  );
}

async function main() {
  const org = await prisma.organization.upsert({
    where: { slug: "texawave-innovations" },
    update: {},
    create: { name: "Texawave Innovations", slug: "texawave-innovations" },
  });

  const teams = new Map<string, { id: number }>();
  for (const team of TEAMS) {
    const row = await prisma.team.upsert({
      where: {
        organizationId_code: { organizationId: org.id, code: team.code },
      },
      update: { name: team.name },
      create: { organizationId: org.id, name: team.name, code: team.code },
    });
    teams.set(team.code, row);
  }

  const allPermissionDefs = [...REFERENCE_PERMISSIONS, ...hrPermissions()];
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
