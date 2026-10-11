/**
 * One-off: moves bank details HR entered through the old Profiles screen
 * (`hr.employee_sensitive_info`, account number in PLAIN TEXT) into
 * `hr.employee_bank_details`, where the account number is encrypted
 * (AES-256-GCM, FIELD_ENCRYPTION_KEY) — the table payroll payments and
 * payslips actually read. Run once per environment after migration
 * 20261011090000_hr_employee_gaps, which copied everything else.
 *
 *   cd apps/api
 *   pnpm exec tsx --env-file=.env scripts/backfill-hr-bank-details.ts --dry-run
 *   pnpm exec tsx --env-file=.env scripts/backfill-hr-bank-details.ts
 *
 * Per legacy row that still holds an account number:
 *   - the employee already has bank details (entered during onboarding):
 *     those win; the legacy plain-text number is cleared;
 *   - otherwise, with bank name and IFSC present: an encrypted row is created
 *     (account holder = the employee's name) and the plain text is cleared;
 *   - otherwise (incomplete): left untouched and listed, for HR to re-enter
 *     through PATCH /hr/employees/:id/sensitive.
 * Idempotent: a second run finds nothing left to move.
 */
import { createCipheriv, randomBytes } from "node:crypto";
import { PrismaClient } from "@texawave-erp/database";

const dryRun = process.argv.includes("--dry-run");

const keyHex = process.env.FIELD_ENCRYPTION_KEY;
if (!keyHex || !/^[0-9a-f]{64}$/i.test(keyHex)) {
  console.error("FIELD_ENCRYPTION_KEY must be set (64 hex characters)");
  process.exit(1);
}
const key = Buffer.from(keyHex, "hex");

/** Same format as FieldEncryptionService.encrypt: iv:authTag:ciphertext (hex). */
function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ]);
  return `${iv.toString("hex")}:${cipher.getAuthTag().toString("hex")}:${ciphertext.toString("hex")}`;
}

/** Same as FieldEncryptionService.mask: last 4 digits only. */
function mask(plain: string): string {
  return `${"X".repeat(Math.max(plain.length - 4, 0))}${plain.slice(-4)}`;
}

async function main() {
  const prisma = new PrismaClient();
  const counts = { kept: 0, created: 0, incomplete: 0 };
  try {
    const legacy = await prisma.employeeSensitiveInfo.findMany({
      where: { bankAccountNo: { not: null } },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            fullName: true,
            teamId: true,
            bankDetail: { select: { id: true, deletedAt: true } },
          },
        },
      },
      orderBy: { id: "asc" },
    });

    for (const row of legacy) {
      const account = row.bankAccountNo as string;
      const hasCurrent =
        row.employee.bankDetail !== null &&
        row.employee.bankDetail.deletedAt === null;

      if (!hasCurrent && (!row.bankName || !row.bankIfsc)) {
        counts.incomplete += 1;
        console.log(
          `${row.employee.employeeCode}: bank name or IFSC missing — re-enter through HR Profiles`,
        );
        continue;
      }
      if (dryRun) {
        counts[hasCurrent ? "kept" : "created"] += 1;
        continue;
      }

      await prisma.$transaction(async (tx) => {
        if (!hasCurrent) {
          const data = {
            accountHolderName: row.employee.fullName,
            accountNumberEncrypted: encrypt(account),
            accountNumberMasked: mask(account),
            ifsc: row.bankIfsc as string,
            bankName: row.bankName as string,
            branchName: row.bankBranch,
            deletedAt: null,
            updatedBy: row.updatedBy,
          };
          await tx.employeeBankDetail.upsert({
            where: { employeeId: row.employeeId },
            create: {
              ...data,
              organizationId: row.organizationId,
              teamId: row.employee.teamId,
              employeeId: row.employeeId,
              createdBy: row.createdBy,
            },
            update: data,
          });
        }
        await tx.employeeSensitiveInfo.update({
          where: { id: row.id },
          data: { bankAccountNo: null },
        });
      });
      counts[hasCurrent ? "kept" : "created"] += 1;
    }
  } finally {
    await prisma.$disconnect();
  }

  console.log(
    `${dryRun ? "[dry run] " : ""}moved: ${counts.created}, already had onboarding bank details: ${counts.kept}, incomplete (left as is): ${counts.incomplete}`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
