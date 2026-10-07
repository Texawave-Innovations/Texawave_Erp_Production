import { Injectable } from "@nestjs/common";
import { PaginatedResponseDto } from "../../../../common/dto/paginated-response.dto.js";
import { ResourceNotFoundException } from "../../../../common/exceptions/business.exception.js";
import { TeamContextService } from "../../../../platform/tenancy/team-context.service.js";
import { TenantContextService } from "../../../../platform/tenancy/tenant-context.service.js";
import { EmployeeQueryService } from "../../employees/employee-query.service.js";
import { requireOrgWideScope } from "../shared/payroll-scope.js";
import { maskEmployeeBankDetails } from "../shared/sensitive-data.js";
import type { QueryPayslipDto } from "./dto/payslip.dto.js";
import { PayslipsRepository } from "./payslips.repository.js";

const READ = "hr.payslip.read";
const GENERATE = "hr.payroll.write";

@Injectable()
export class PayslipsService {
  constructor(
    private readonly repository: PayslipsRepository,
    private readonly tenantContext: TenantContextService,
    private readonly teamContext: TeamContextService,
    private readonly employeeQuery: EmployeeQueryService,
  ) {}

  async findMany(query: QueryPayslipDto) {
    const scope = await this.teamContext.resolveScope(READ);
    const { items, total } = await this.repository.findMany(
      scope,
      query,
      query,
    );
    return new PaginatedResponseDto(
      items.map(maskEmployeeBankDetails),
      total,
      query.page,
      query.limit,
    );
  }

  async findById(id: number) {
    const scope = await this.teamContext.resolveScope(READ);
    const row = await this.repository.findById(scope, id);
    if (!row) {
      throw new ResourceNotFoundException("Payslip", id);
    }
    return maskEmployeeBankDetails(row);
  }

  async generateForPeriod(payrollPeriodId: number) {
    const scope = await this.teamContext.resolveScope(GENERATE);
    requireOrgWideScope(scope, "generate payslips");
    const orgScope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();
    const rows = await this.repository.generateForPeriod(
      orgScope,
      payrollPeriodId,
      userId,
    );
    if (!rows) {
      throw new ResourceNotFoundException("Payroll period", payrollPeriodId);
    }
    return rows.map(maskEmployeeBankDetails);
  }

  async findMine(query: QueryPayslipDto) {
    const employee = await this.employeeQuery.getCurrentEmployee();
    const orgScope = this.tenantContext.getOrgScope();
    const { items, total } = await this.repository.findMine(
      orgScope,
      employee.id,
      query,
      query,
    );
    return new PaginatedResponseDto(
      items.map(maskEmployeeBankDetails),
      total,
      query.page,
      query.limit,
    );
  }

  async findMineById(id: number) {
    const employee = await this.employeeQuery.getCurrentEmployee();
    const orgScope = this.tenantContext.getOrgScope();
    const row = await this.repository.findMineById(orgScope, employee.id, id);
    if (!row) {
      throw new ResourceNotFoundException("Payslip", id);
    }
    return maskEmployeeBankDetails(row);
  }
}
