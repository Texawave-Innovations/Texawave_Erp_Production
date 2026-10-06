import { Injectable } from "@nestjs/common";
import { ResourceNotFoundException } from "../../../../common/exceptions/business.exception.js";
import { TeamContextService } from "../../../../platform/tenancy/team-context.service.js";
import { TenantContextService } from "../../../../platform/tenancy/tenant-context.service.js";
import { PrismaService } from "../../../../shared/prisma/prisma.service.js";
import { BankDetailsRepository } from "./bank-details.repository.js";
import type { UpsertBankDetailsDto } from "./dto/bank-details.dto.js";

const READ = "hr.salary.read";
const WRITE = "hr.salary.write";

@Injectable()
export class BankDetailsService {
  constructor(
    private readonly repository: BankDetailsRepository,
    private readonly tenantContext: TenantContextService,
    private readonly teamContext: TeamContextService,
    private readonly prisma: PrismaService,
  ) {}

  async findByEmployeeId(employeeId: number) {
    const scope = await this.teamContext.resolveScope(READ);
    const row = await this.repository.findByEmployeeId(scope, employeeId);
    if (!row) {
      throw new ResourceNotFoundException("Employee bank details", employeeId);
    }
    return row;
  }

  async upsert(employeeId: number, dto: UpsertBankDetailsDto) {
    const orgScope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();
    await this.teamContext.resolveScope(WRITE);

    const employee = await this.prisma.employee.findFirst({
      where: {
        id: employeeId,
        organizationId: orgScope.organizationId,
        deletedAt: null,
      },
    });

    if (!employee) {
      throw new ResourceNotFoundException("Employee", employeeId);
    }

    return this.repository.upsert(orgScope, employeeId, dto, userId);
  }
}
