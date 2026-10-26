import { Injectable } from "@nestjs/common";
import { ResourceNotFoundException } from "../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../platform/tenancy/tenant-context.service.js";
import type { CreateExpenseDto } from "./dto/create-expense.dto.js";
import type { UpdateExpenseDto } from "./dto/update-expense.dto.js";
import { ProjectsRepository } from "./projects.repository.js";

@Injectable()
export class ExpensesService {
  constructor(
    private readonly repository: ProjectsRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async findExpenses(projectId?: number) {
    const scope = this.tenantContext.getOrgScope();
    if (projectId) {
      const project = await this.repository.findOne(scope, projectId);
      if (!project) {
        throw new ResourceNotFoundException("Project", projectId);
      }
    }
    return this.repository.findExpenses(scope, projectId);
  }

  async findExpenseById(expenseId: number) {
    const scope = this.tenantContext.getOrgScope();
    const expense = await this.repository.findExpenseById(scope, expenseId);
    if (!expense) {
      throw new ResourceNotFoundException("Expense", expenseId);
    }
    return expense;
  }

  async createExpense(projectId: number, dto: CreateExpenseDto) {
    const scope = this.tenantContext.getOrgScope();
    const project = await this.repository.findOne(scope, projectId);
    if (!project) {
      throw new ResourceNotFoundException("Project", projectId);
    }

    const userId = this.tenantContext.getUserId();
    return this.repository.createExpense(scope, projectId, dto, userId);
  }

  async updateExpense(expenseId: number, dto: UpdateExpenseDto) {
    const scope = this.tenantContext.getOrgScope();
    const existing = await this.repository.findExpenseById(scope, expenseId);
    if (!existing) {
      throw new ResourceNotFoundException("Expense", expenseId);
    }

    const updated = await this.repository.updateExpense(scope, expenseId, dto);
    if (!updated) {
      throw new ResourceNotFoundException("Expense", expenseId);
    }
    return updated;
  }
}
