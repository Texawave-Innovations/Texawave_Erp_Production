import { Injectable } from "@nestjs/common";
import { ResourceNotFoundException } from "../../../../common/exceptions/business.exception.js";
import { TeamContextService } from "../../../../platform/tenancy/team-context.service.js";
import { TenantContextService } from "../../../../platform/tenancy/tenant-context.service.js";
import { PrismaService } from "../../../../shared/prisma/prisma.service.js";
import { assertEmployeeInWriteScope } from "../shared/payroll-scope.js";
import { maskBankDetails } from "../shared/sensitive-data.js";
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
    return maskBankDetails(row);
  }

  async upsert(employeeId: number, dto: UpsertBankDetailsDto) {
    const orgScope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();
    // Changing where someone's salary is paid is the fraud vector here, so the
    // write is held to the same team boundary as the read: `.team` only for
    // employees in the caller's teams, `.own` not at all.
    const scope = await this.teamContext.resolveScope(WRITE);

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
    assertEmployeeInWriteScope(scope, employee);

    return maskBankDetails(
      await this.repository.upsert(orgScope, employeeId, dto, userId),
    );
  }
}
