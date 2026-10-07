import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../../common/decorators/org-scoped.decorator.js";
import { TeamScoped } from "../../../../common/decorators/team-scoped.decorator.js";
import type { OrgScope } from "../../../../common/tenancy/org-scope.js";
import type { TeamScope } from "../../../../common/tenancy/team-scope.js";
import { teamWhere } from "../../../../common/tenancy/team-where.js";
import { AuditWriter } from "../../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../../shared/prisma/prisma.service.js";
import { maskTail } from "../shared/sensitive-data.js";
import type { UpsertBankDetailsDto } from "./dto/bank-details.dto.js";

const VIA_EMPLOYEE = {
  teamField: "employee.teamId",
  ownerField: "employee.userId",
};

const INCLUDE_EMPLOYEE = {
  employee: {
    select: {
      id: true,
      employeeCode: true,
      fullName: true,
      teamId: true,
      userId: true,
    },
  },
} satisfies Prisma.EmployeeBankDetailsInclude;

/** Allow-listed, masked audit snapshot — full numbers never reach the log. */
function snapshot(
  row: {
    employeeId: number;
    bankName: string;
    accountNumber: string;
    ifscCode: string;
    panNumber: string | null;
    aadhaarNumber: string | null;
  } | null,
) {
  if (!row) return null;
  return {
    employeeId: row.employeeId,
    bankName: row.bankName,
    accountNumber: maskTail(row.accountNumber),
    ifscCode: row.ifscCode,
    panNumber: maskTail(row.panNumber),
    aadhaarNumber: maskTail(row.aadhaarNumber),
  };
}

@Injectable()
export class BankDetailsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

  @TeamScoped()
  async findByEmployeeId(scope: TeamScope, employeeId: number) {
    const where = teamWhere(
      scope,
      { employeeId, deletedAt: null },
      VIA_EMPLOYEE,
    ) as Prisma.EmployeeBankDetailsWhereInput;

    return this.prisma.employeeBankDetails.findFirst({
      where,
      include: INCLUDE_EMPLOYEE,
    });
  }

  /** Upserts and records the change (before/after, masked) in the audit
   * trail in the same transaction — a bank-account change is exactly the
   * kind of edit that must be traceable to a person. */
  @OrgScoped()
  async upsert(
    scope: OrgScope,
    employeeId: number,
    dto: UpsertBankDetailsDto,
    userId: number,
  ) {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const before = await tx.employeeBankDetails.findFirst({
        where: { employeeId, organizationId: scope.organizationId },
      });

      const row = await tx.employeeBankDetails.upsert({
        where: { employeeId },
        create: {
          organizationId: scope.organizationId,
          employeeId,
          bankName: dto.bankName,
          accountNumber: dto.accountNumber,
          ifscCode: dto.ifscCode,
          panNumber: dto.panNumber ?? null,
          aadhaarNumber: dto.aadhaarNumber ?? null,
          createdBy: userId,
          updatedBy: userId,
        },
        update: {
          bankName: dto.bankName,
          accountNumber: dto.accountNumber,
          ifscCode: dto.ifscCode,
          panNumber: dto.panNumber ?? null,
          aadhaarNumber: dto.aadhaarNumber ?? null,
          updatedBy: userId,
        },
        include: INCLUDE_EMPLOYEE,
      });

      await this.audit.write(tx, {
        entityType: "employee_bank_details",
        entityId: row.id,
        action: before ? "update" : "create",
        before: snapshot(before),
        after: snapshot(row),
      });

      return row;
    });
  }
}
