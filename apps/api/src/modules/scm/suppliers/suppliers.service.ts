import { Injectable } from "@nestjs/common";
import { classifyDbError } from "../../../common/database/db-errors.js";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import {
  ResourceConflictException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import { MasterListValueGuard } from "../master-list-items/master-list-value.guard.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import type {
  CreateSupplierDto,
  QuerySupplierDto,
  UpdateSupplierDto,
} from "./dto/supplier.dto.js";
import { SuppliersRepository } from "./suppliers.repository.js";

const CODE_ALLOCATION_ATTEMPTS = 10;

@Injectable()
export class SuppliersService {
  constructor(
    private readonly repository: SuppliersRepository,
    private readonly tenantContext: TenantContextService,
    private readonly masterListGuard: MasterListValueGuard,
  ) {}

  async findAll(query: QuerySupplierDto) {
    const { items, total } = await this.repository.findMany(
      this.tenantContext.getOrgScope(),
      { q: query.q, status: query.status, type: query.type },
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  findTypes() {
    return this.repository.findDistinctTypes(this.tenantContext.getOrgScope());
  }

  async nextCode() {
    return {
      supplierCode: await this.repository.nextCode(
        this.tenantContext.getOrgScope(),
      ),
    };
  }

  async findOne(id: number) {
    const row = await this.repository.findOne(
      this.tenantContext.getOrgScope(),
      id,
    );
    if (!row) throw new ResourceNotFoundException("Supplier", id);
    return row;
  }

  async findActivity(id: number) {
    const scope = this.tenantContext.getOrgScope();
    await this.findOne(id);
    return this.repository.findActivity(scope, id);
  }

  async findProcurementSummary(id: number) {
    const scope = this.tenantContext.getOrgScope();
    await this.findOne(id);
    return this.repository.findProcurementSummary(scope, id);
  }

  async create(dto: CreateSupplierDto) {
    const scope = this.tenantContext.getOrgScope();
    const actorId = this.tenantContext.getUserId();
    await this.assertGstinFree(dto.gstin);
    await this.masterListGuard.assertValid(
      scope,
      "supplier_type",
      dto.type,
      "Supplier type",
    );

    if (dto.supplierCode) {
      await this.assertCodeFree(dto.supplierCode);
      try {
        return await this.repository.create(
          scope,
          dto.supplierCode,
          dto,
          actorId,
        );
      } catch (error) {
        throw this.mapUniqueViolation(error, dto.supplierCode);
      }
    }

    // Server-allocated code: two near-concurrent creations can compute the
    // same next code; the unique index decides the winner and the loser
    // retries with a fresh number.
    for (let attempt = 0; attempt < CODE_ALLOCATION_ATTEMPTS; attempt += 1) {
      const code = await this.repository.nextCode(scope);
      try {
        return await this.repository.create(scope, code, dto, actorId);
      } catch (error) {
        if (classifyDbError(error)?.kind !== "unique") throw error;
      }
    }
    throw new ResourceConflictException(
      "Could not allocate a unique supplier code. Please try again.",
    );
  }

  async update(id: number, dto: UpdateSupplierDto) {
    const scope = this.tenantContext.getOrgScope();
    const current = await this.findOne(id);

    if (
      dto.supplierCode !== undefined &&
      dto.supplierCode.toLowerCase() !== current.supplierCode.toLowerCase()
    ) {
      await this.assertCodeFree(dto.supplierCode, id);
    }
    if (dto.gstin) await this.assertGstinFree(dto.gstin, id);
    await this.masterListGuard.assertValid(
      scope,
      "supplier_type",
      dto.type,
      "Supplier type",
    );

    try {
      const row = await this.repository.update(
        scope,
        id,
        dto,
        this.tenantContext.getUserId(),
      );
      if (!row) throw new ResourceNotFoundException("Supplier", id);
      return row;
    } catch (error) {
      throw this.mapUniqueViolation(error, dto.supplierCode);
    }
  }

  private async assertCodeFree(code: string, exceptId?: number) {
    const clash = await this.repository.findByCode(
      this.tenantContext.getOrgScope(),
      code,
    );
    if (clash && clash.id !== exceptId) {
      throw new ResourceConflictException(
        `Supplier code "${code}" is already used by ${clash.companyName}`,
      );
    }
  }

  private async assertGstinFree(gstin: string | undefined, exceptId?: number) {
    if (!gstin) return;
    const clash = await this.repository.findByGstin(
      this.tenantContext.getOrgScope(),
      gstin,
    );
    if (clash && clash.id !== exceptId) {
      throw new ResourceConflictException(
        `GSTIN is already used by ${clash.companyName}`,
      );
    }
  }

  private mapUniqueViolation(error: unknown, code: string | undefined) {
    if (classifyDbError(error)?.kind === "unique") {
      return new ResourceConflictException(
        `Supplier code "${code ?? ""}" is already in use. Choose a different code and try again.`,
      );
    }
    return error;
  }

  async remove(id: number) {
    const ok = await this.repository.remove(
      this.tenantContext.getOrgScope(),
      id,
      this.tenantContext.getUserId(),
    );
    if (!ok) throw new ResourceNotFoundException("Supplier", id);
  }
}
