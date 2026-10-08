import { Injectable } from "@nestjs/common";
import { PaginatedResponseDto } from "../../../../common/dto/paginated-response.dto.js";
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from "../../../../common/exceptions/business.exception.js";
import { TeamContextService } from "../../../../platform/tenancy/team-context.service.js";
import { TenantContextService } from "../../../../platform/tenancy/tenant-context.service.js";
import { PrismaService } from "../../../../shared/prisma/prisma.service.js";
import { BonusesRepository } from "./bonuses.repository.js";
import {
  assertEmployeeInWriteScope,
  assertNotSelfApproval,
} from "../shared/payroll-scope.js";
import type {
  CreateBonusDto,
  DecideBonusDto,
  QueryBonusDto,
} from "./dto/bonus.dto.js";

const READ = "hr.bonus.read";
const WRITE = "hr.bonus.write";
const APPROVE = "hr.bonus.approve";

@Injectable()
export class BonusesService {
  constructor(
    private readonly repository: BonusesRepository,
    private readonly tenantContext: TenantContextService,
    private readonly teamContext: TeamContextService,
    private readonly prisma: PrismaService,
  ) {}

  async create(dto: CreateBonusDto) {
    const orgScope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();
    const teamScope = await this.teamContext.resolveScope(WRITE);

    const employee = await this.prisma.employee.findFirst({
      where: {
        id: dto.employeeId,
        organizationId: orgScope.organizationId,
        deletedAt: null,
      },
    });
    if (!employee) {
      throw new ResourceNotFoundException("Employee", dto.employeeId);
    }

    assertEmployeeInWriteScope(teamScope, employee);

    if (dto.payrollPeriodId) {
      const period = await this.prisma.payrollPeriod.findFirst({
        where: {
          id: dto.payrollPeriodId,
          organizationId: orgScope.organizationId,
          deletedAt: null,
        },
      });
      if (!period) {
        throw new ResourceNotFoundException(
          "Payroll period",
          dto.payrollPeriodId,
        );
      }
      if (period.status === "FINALIZED") {
        throw new BusinessRuleViolationException(
          "Cannot assign bonus to a finalized payroll period",
          "PERIOD_FINALIZED",
        );
      }
    }

    return this.repository.create(orgScope, dto, userId);
  }

  async findAll(query: QueryBonusDto) {
    const scope = await this.teamContext.resolveScope(READ);
    const { items, total } = await this.repository.findMany(
      scope,
      query,
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  async findOne(id: number) {
    const scope = await this.teamContext.resolveScope(READ);
    const row = await this.repository.findById(scope, id);
    if (!row) throw new ResourceNotFoundException("Employee bonus", id);
    return row;
  }

  async decide(id: number, dto: DecideBonusDto) {
    const orgScope = this.tenantContext.getOrgScope();
    const scope = await this.teamContext.resolveScope(APPROVE);
    const userId = this.tenantContext.getUserId();

    const bonus = await this.repository.findById(scope, id);
    if (!bonus) throw new ResourceNotFoundException("Employee bonus", id);
    // Maker-checker: not the person who raised it, and never the recipient.
    assertNotSelfApproval(bonus.createdBy, userId, "bonus");
    assertNotSelfApproval(bonus.employee.userId, userId, "bonus");

    if (bonus.status !== "PENDING") {
      throw new BusinessRuleViolationException(
        `Bonus is already decided: ${bonus.status}`,
        "ALREADY_DECIDED",
      );
    }

    const decided = await this.repository.decide(
      orgScope,
      id,
      dto.decision,
      userId,
    );
    if (!decided) {
      throw new BusinessRuleViolationException(
        "Bonus was decided concurrently",
        "ALREADY_DECIDED",
      );
    }
    return decided;
  }
}
