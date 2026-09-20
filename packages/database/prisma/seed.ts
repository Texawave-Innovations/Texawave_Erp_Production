// Local-dev seed only — NOT run in CI, NOT a migration. Creates one demo
// organization, an admin user, and the permission catalog needed by the
// reference feature (Docs/ARCHITECTURE.md §5.2/§6, apps/api/src/modules/_reference/tags/).
import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import { PrismaClient } from "../generated/prisma/client.js";

const prisma = new PrismaClient();

const REFERENCE_PERMISSIONS = [
  { code: "reference.tags.read", description: "View reference tags" },
  {
    code: "reference.tags.write",
    description: "Create/update/delete reference tags",
  },
];

async function main() {
  const org = await prisma.organization.upsert({
    where: { slug: "demo" },
    update: {},
    create: { id: randomUUID(), name: "Demo Organization", slug: "demo" },
  });

  for (const permission of REFERENCE_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      update: { description: permission.description },
      create: { id: randomUUID(), ...permission },
    });
  }

  const adminRole = await prisma.role.upsert({
    where: { organizationId_name: { organizationId: org.id, name: "Admin" } },
    update: {},
    create: { id: randomUUID(), organizationId: org.id, name: "Admin" },
  });

  const allPermissions = await prisma.permission.findMany();
  await prisma.rolePermission.deleteMany({ where: { roleId: adminRole.id } });
  await prisma.rolePermission.createMany({
    data: allPermissions.map((permission) => ({
      roleId: adminRole.id,
      permissionId: permission.id,
    })),
  });

  const passwordHash = await bcrypt.hash("ChangeMe123!", 10);
  const adminUser = await prisma.user.upsert({
    where: {
      organizationId_email: {
        organizationId: org.id,
        email: "admin@demo.local",
      },
    },
    update: {},
    create: {
      id: randomUUID(),
      organizationId: org.id,
      email: "admin@demo.local",
      passwordHash,
      fullName: "Demo Admin",
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: adminUser.id, roleId: adminRole.id } },
    update: {},
    create: { userId: adminUser.id, roleId: adminRole.id },
  });

  console.log(
    `Seeded organization "demo" (slug: demo) with admin@demo.local / ChangeMe123! — local dev only, never use this in a real environment.`,
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
