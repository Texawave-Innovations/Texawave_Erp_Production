// Public surface of @texawave-erp/database. Only this file may be imported
// from outside this package — never reach into `generated/` or `prisma/`
// directly (see Docs/CODING_STANDARDS.md §3 and the ESLint boundary rules
// that enforce it for every package except this one).
export {
  PrismaClient,
  Prisma,
  type Organization,
  type User,
  type Permission,
  type Role,
  type RolePermission,
  type UserRole,
  type Tag,
} from "../generated/prisma/client.js";
