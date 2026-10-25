import { Injectable } from "@nestjs/common";
import { ResourceNotFoundException } from "../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../platform/tenancy/tenant-context.service.js";
import type { CreateExpenseDto } from "./dto/create-expense.dto.js";
import type { UpdateExpenseDto } from "./dto/update-expense.dto.js";
import { ProjectsRepository } from "./projects.repository.js";
import { SuppliersService } from "../scm/suppliers/suppliers.service.js";
import { QuerySupplierDto } from "../scm/suppliers/dto/supplier.dto.js";

@Injectable()
export class ExpensesService {
  constructor(
    private readonly repository: ProjectsRepository,
    private readonly tenantContext: TenantContextService,
    private readonly suppliers: SuppliersService,
  ) {}

  /** Vendor picker for the Expenses page — active suppliers from the SCM
   * supplier master (synchronous read through SCM's public service,
   * Docs/CODING_STANDARDS.md §11), so Projects users don't need SCM
   * permissions just to pick a vendor. */
  async findVendors(search?: string) {
    const query = Object.assign(new QuerySupplierDto(), {
      page: 1,
      limit: 100,
      status: "Active",
      ...(search?.trim() ? { q: search.trim() } : {}),
    });
    const page = await this.suppliers.findAll(query);
    return page.items.map((s) => ({
      id: s.id,
      supplierCode: s.supplierCode,
      companyName: s.companyName,
    }));
  }

  /** Validates a supplier link (404 outside the org) and returns the vendor
   * display name to store alongside it. */
  private async resolveSupplier(
    supplierId: number | undefined,
    vendor: string | undefined,
  ): Promise<{ supplierId?: number; vendor?: string }> {
    if (supplierId === undefined) return vendor !== undefined ? { vendor } : {};
    const supplier = await this.suppliers.findOne(supplierId);
    return { supplierId: supplier.id, vendor: supplier.companyName };
  }

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
    const vendor = await this.resolveSupplier(dto.supplierId, dto.vendor);
    return this.repository.createExpense(
      scope,
      projectId,
      { ...dto, ...vendor },
      userId,
    );
  }

  async updateExpense(expenseId: number, dto: UpdateExpenseDto) {
    const scope = this.tenantContext.getOrgScope();
    const existing = await this.repository.findExpenseById(scope, expenseId);
    if (!existing) {
      throw new ResourceNotFoundException("Expense", expenseId);
    }

    // Editing the free-text vendor alone unlinks the supplier.
    const vendor =
      dto.supplierId !== undefined
        ? await this.resolveSupplier(dto.supplierId, dto.vendor)
        : dto.vendor !== undefined
          ? { vendor: dto.vendor }
          : {};
    const updated = await this.repository.updateExpense(scope, expenseId, {
      ...dto,
      ...vendor,
    });
    if (
      dto.supplierId === undefined &&
      dto.vendor !== undefined &&
      existing.supplierId
    ) {
      await this.repository.unlinkExpenseSupplier(scope, expenseId);
    }
    if (!updated) {
      throw new ResourceNotFoundException("Expense", expenseId);
    }
    return updated;
  }

  async deleteExpense(expenseId: number) {
    const scope = this.tenantContext.getOrgScope();
    const removed = await this.repository.deleteExpense(scope, expenseId);
    if (!removed) {
      throw new ResourceNotFoundException("Expense", expenseId);
    }
    return { success: true };
  }
}
