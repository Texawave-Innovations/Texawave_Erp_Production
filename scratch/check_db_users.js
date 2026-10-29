async function inspectDb() {
  const { PrismaClient } =
    await import("../packages/database/generated/prisma/client.js");
  const prisma = new PrismaClient();
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      userRoles: {
        include: {
          role: {
            include: {
              rolePermissions: {
                include: { permission: true },
              },
            },
          },
        },
      },
    },
  });
  users.forEach((u) => {
    console.log(`User: ${u.email} (ID: ${u.id})`);
    u.userRoles.forEach((ur) => {
      console.log(
        `  Role: ${ur.role.name} (${ur.role.rolePermissions.length} perms)`,
      );
    });
  });
  await prisma.$disconnect();
}
inspectDb().catch((e) => {
  console.error("Error:", e);
});
