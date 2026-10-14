import { Injectable } from "@nestjs/common";
import { PaginatedResponseDto } from "../../../../common/dto/paginated-response.dto.js";
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from "../../../../common/exceptions/business.exception.js";
import { TeamContextService } from "../../../../platform/tenancy/team-context.service.js";
import { TenantContextService } from "../../../../platform/tenancy/tenant-context.service.js";
import { EmployeeQueryService } from "../../employees/employee-query.service.js";
import { assertNotSelfApproval } from "../shared/payroll-scope.js";
import type {
  QueryTaxDeclarationDto,
  SaveTaxDeclarationDto,
  VerifyTaxDeclarationDto,
} from "./dto/tax.dto.js";
import { TaxDeclarationsRepository } from "./tax-declarations.repository.js";

const READ = "hr.tax_declaration.read";
const WRITE = "hr.tax_declaration.write";
const APPROVE = "hr.tax_declaration.approve";

export function assertFinancialYear(fy: string): void {
  const start = Number(fy.slice(0, 4));
  if (
    !/^[0-9]{4}-[0-9]{2}$/.test(fy) ||
    Number(fy.slice(5)) !== (start + 1) % 100
  ) {
    throw new BusinessRuleViolationException(
      "A financial year is written like 2026-27",
      "FINANCIAL_YEAR_INVALID",
    );
  }
}

/**
 * Tax declarations (Docs/PAYROLL_AND_COMPLIANCE.md §4.13): the employee
 * declares and submits; HR (or the employee's HR on their behalf) may enter
 * one; HR verifies against proofs — never the employee themselves.
 */
@Injectable()
export class TaxDeclarationsService {
  constructor(
    private readonly repository: TaxDeclarationsRepository,
    private readonly tenantContext: TenantContextService,
    private readonly teamContext: TeamContextService,
    private readonly employeeQuery: EmployeeQueryService,
  ) {}

  async findAll(query: QueryTaxDeclarationDto) {
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
    if (!row) throw new ResourceNotFoundException("Tax declaration", id);
    return row;
  }

  /** HR enters or corrects a declaration on an employee's behalf. */
  async saveForEmployee(
    employeeId: number,
    financialYear: string,
    dto: SaveTaxDeclarationDto,
  ) {
    assertFinancialYear(financialYear);
    const scope = await this.teamContext.resolveScope(WRITE);
    return this.repository.save(
      this.tenantContext.getOrgScope().organizationId,
      employeeId,
      financialYear,
      dto,
      this.tenantContext.getUserId(),
      scope,
    );
  }

  async verify(id: number, dto: VerifyTaxDeclarationDto) {
    const scope = await this.teamContext.resolveScope(APPROVE);
    const userId = this.tenantContext.getUserId();
    const current = await this.repository.findById(scope, id);
    if (!current) throw new ResourceNotFoundException("Tax declaration", id);
    assertNotSelfApproval(current.employee.userId, userId, "tax declaration");
    if (current.status !== "SUBMITTED") {
      throw new BusinessRuleViolationException(
        `Only a submitted declaration can be verified (this one is ${current.status.toLowerCase()})`,
        "INVALID_STATE_TRANSITION",
      );
    }
    if (dto.decision === "REJECTED" && !dto.note) {
      throw new BusinessRuleViolationException(
        "Give a note when rejecting a declaration",
        "DECISION_NOTE_REQUIRED",
      );
    }
    const row = await this.repository.verify(scope, id, dto, userId);
    if (!row) {
      throw new BusinessRuleViolationException(
        "The declaration was decided concurrently",
        "ALREADY_DECIDED",
      );
    }
    return row;
  }

  // ---- self-service ------------------------------------------------------------

  async findMine(financialYear?: string) {
    const employee = await this.employeeQuery.getCurrentEmployee();
    return this.repository.findMine(
      this.tenantContext.getOrgScope(),
      employee.id,
      financialYear,
    );
  }

  async saveMine(financialYear: string, dto: SaveTaxDeclarationDto) {
    assertFinancialYear(financialYear);
    const employee = await this.employeeQuery.getCurrentEmployee();
    return this.repository.save(
      this.tenantContext.getOrgScope().organizationId,
      employee.id,
      financialYear,
      dto,
      this.tenantContext.getUserId(),
    );
  }
}
