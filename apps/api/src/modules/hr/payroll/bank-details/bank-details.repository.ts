import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../../common/decorators/org-scoped.decorator.js";
import { TeamScoped } from "../../../../common/decorators/team-scoped.decorator.js";
import type { OrgScope } from "../../../../common/tenancy/org-scope.js";
import type { TeamScope } from "../../../../common/tenancy/team-scope.js";
import { teamWhere } from "../../../../common/tenancy/team-where.js";
import { PrismaService } from "../../../../shared/prisma/prisma.service.js";
import type { UpsertBankDetailsDto } from "./dto/bank-details.dto.js";

const VIA_EMPLOYEE = {
  teamField: "employee.teamId",
  ownerField: "employee.userId",
};

@Injectable()
export class BankDetailsRepository {
  constructor(private readonly prisma: PrismaService) {}

  @TeamScoped()
  async findByEmployeeId(scope: TeamScope, employeeId: number) {
    const where = teamWhere(
      scope,
      { employeeId, deletedAt: null },
      VIA_EMPLOYEE,
    ) as Prisma.EmployeeBankDetailsWhereInput;

    return this.prisma.employeeBankDetails.findFirst({
      where,
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            fullName: true,
            teamId: true,
            userId: true,
          },
        },
      },
    });
  }

  @OrgScoped()
  async upsert(
    scope: OrgScope,
    employeeId: number,
    dto: UpsertBankDetailsDto,
    userId: number,
  ) {
    return this.prisma.employeeBankDetails.upsert({
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
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            fullName: true,
            teamId: true,
            userId: true,
          },
        },
      },
    });
  }
}
