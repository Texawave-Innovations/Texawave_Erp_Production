import { Injectable } from "@nestjs/common";
import { parseDateOnly } from "../../../../common/dates/date-only.js";
import {
  BusinessRuleConflictException,
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from "../../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../../platform/tenancy/tenant-context.service.js";
import type {
  CreatePtSlabDto,
  TaxSlabDto,
  UpdatePtSlabDto,
  UpsertTaxRegimeDto,
} from "./dto/tax.dto.js";
import { TaxSetupRepository } from "./tax-setup.repository.js";

/**
 * Income-tax slabs per financial year and regime, and Professional Tax
 * slabs per state (Docs/PAYROLL_AND_COMPLIANCE.md §4.12). The law is data:
 * HR enters it; the engine only applies it.
 */
@Injectable()
export class TaxSetupService {
  constructor(
    private readonly repository: TaxSetupRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  private get scope() {
    return this.tenantContext.getOrgScope();
  }

  listRegimes(financialYear?: string) {
    return this.repository.findRegimes(this.scope, financialYear);
  }

  async upsertRegime(dto: UpsertTaxRegimeDto) {
    const start = Number(dto.financialYear.slice(0, 4));
    if (Number(dto.financialYear.slice(5)) !== (start + 1) % 100) {
      throw new BusinessRuleViolationException(
        "A financial year is written like 2026-27",
        "FINANCIAL_YEAR_INVALID",
      );
    }
    assertSlabsContiguous(dto.slabs);
    return this.repository.upsertRegime(
      this.scope,
      dto,
      this.tenantContext.getUserId(),
    );
  }

  listPtSlabs(stateCode?: string) {
    return this.repository.findPtSlabs(this.scope, stateCode);
  }

  /** A state's active slabs in force at the same time must not overlap in
   * wage range (an employee would match two). */
  async createPtSlab(dto: CreatePtSlabDto) {
    const from = parseDateOnly(dto.effectiveFrom);
    const to = dto.effectiveTo ? parseDateOnly(dto.effectiveTo) : null;
    if (to && to < from) {
      throw new BusinessRuleViolationException(
        "Effective to date cannot precede effective from date",
        "PT_SLAB_DATES_INVALID",
      );
    }
    const max = dto.maxMonthlyWage ?? null;
    if (max !== null && max < dto.minMonthlyWage) {
      throw new BusinessRuleViolationException(
        "The wage range ends before it starts",
        "PT_SLAB_RANGE_INVALID",
      );
    }
    if (
      (dto.specialMonth === undefined) !==
      (dto.specialAmount === undefined)
    ) {
      throw new BusinessRuleViolationException(
        "Give the special month and its amount together",
        "PT_SLAB_SPECIAL_INCOMPLETE",
      );
    }
    const others = await this.repository.findPtSlabsOverlapping(
      this.scope,
      dto.stateCode,
      from,
      to,
    );
    const clash = others.find((o) => {
      const oMax =
        o.maxMonthlyWage === null ? Infinity : Number(o.maxMonthlyWage);
      return (
        dto.minMonthlyWage <= oMax &&
        Number(o.minMonthlyWage) <= (max ?? Infinity)
      );
    });
    if (clash) {
      throw new BusinessRuleConflictException(
        `This wage range overlaps slab #${clash.id} of ${dto.stateCode} in force at the same time`,
        "PT_SLAB_OVERLAP",
      );
    }
    return this.repository.createPtSlab(
      this.scope,
      {
        stateCode: dto.stateCode,
        minMonthlyWage: dto.minMonthlyWage,
        maxMonthlyWage: max,
        monthlyAmount: dto.monthlyAmount,
        specialMonth: dto.specialMonth ?? null,
        specialAmount: dto.specialAmount ?? null,
        applicableMonths: [...new Set(dto.applicableMonths ?? [])].sort(
          (a, b) => a - b,
        ),
        effectiveFrom: from,
        effectiveTo: to,
      },
      this.tenantContext.getUserId(),
    );
  }

  async updatePtSlab(id: number, dto: UpdatePtSlabDto) {
    const current = await this.repository.findPtSlabById(this.scope, id);
    if (!current) throw new ResourceNotFoundException("PT slab", id);
    const to =
      dto.effectiveTo !== undefined
        ? parseDateOnly(dto.effectiveTo)
        : undefined;
    if (to && to < current.effectiveFrom) {
      throw new BusinessRuleViolationException(
        "Effective to date cannot precede effective from date",
        "PT_SLAB_DATES_INVALID",
      );
    }
    return this.repository.updatePtSlab(
      this.scope,
      id,
      {
        ...(to !== undefined ? { effectiveTo: to } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      this.tenantContext.getUserId(),
    );
  }

  listPtLocationStates() {
    return this.repository.findPtLocationStates(this.scope);
  }

  async setPtLocationState(workLocationId: number, stateCode: string) {
    const location = await this.repository.findWorkLocation(
      this.scope,
      workLocationId,
    );
    if (!location)
      throw new ResourceNotFoundException("Work location", workLocationId);
    return this.repository.setPtLocationState(
      this.scope,
      workLocationId,
      stateCode,
      this.tenantContext.getUserId(),
    );
  }
}

/** Slabs start at 0, follow on without gaps or overlaps, and only the last
 * may be open-ended. */
export function assertSlabsContiguous(slabs: readonly TaxSlabDto[]): void {
  const sorted = [...slabs].sort((a, b) => a.fromIncome - b.fromIncome);
  const fail = (msg: string) => {
    throw new BusinessRuleViolationException(msg, "TAX_SLABS_INVALID");
  };
  if (sorted[0]?.fromIncome !== 0) fail("The first slab must start at 0");
  sorted.forEach((s, i) => {
    const next = sorted[i + 1];
    const to = s.toIncome ?? null;
    if (to !== null && to <= s.fromIncome) {
      fail(`The slab from ${s.fromIncome} ends before it starts`);
    }
    if (next) {
      if (to === null) fail("Only the last slab may have no upper limit");
      else if (next.fromIncome !== to) {
        fail(`Slabs must follow on: ${to} is followed by ${next.fromIncome}`);
      }
    }
  });
}
