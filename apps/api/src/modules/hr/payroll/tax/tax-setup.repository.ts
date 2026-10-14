import { Injectable } from "@nestjs/common";
import { OrgScoped } from "../../../../common/decorators/org-scoped.decorator.js";
import { VersionConflictException } from "../../../../common/exceptions/business.exception.js";
import type { OrgScope } from "../../../../common/tenancy/org-scope.js";
import { AuditWriter } from "../../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../../shared/prisma/prisma.service.js";
import type { UpsertTaxRegimeDto } from "./dto/tax.dto.js";

const REGIME_INCLUDE = {
  slabs: { orderBy: { fromIncome: "asc" as const } },
};

/**
 * Income-tax regimes and Professional Tax masters — organization-wide
 * configuration (`@OrgScoped()`, like payroll settings; Docs/CODING_STANDARDS.md
 * §10a). Every write carries its audit row.
 */
@Injectable()
export class TaxSetupRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

  @OrgScoped()
  findRegimes(scope: OrgScope, financialYear?: string) {
    return this.prisma.incomeTaxRegime.findMany({
      where: {
        organizationId: scope.organizationId,
        ...(financialYear ? { financialYear } : {}),
      },
      include: REGIME_INCLUDE,
      orderBy: [{ financialYear: "desc" }, { regime: "asc" }],
    });
  }

  /** Creates (version 0) or replaces a regime with its slabs under an
   * optimistic version check. */
  @OrgScoped()
  async upsertRegime(scope: OrgScope, dto: UpsertTaxRegimeDto, userId: number) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.incomeTaxRegime.findUnique({
        where: {
          organizationId_financialYear_regime: {
            organizationId: scope.organizationId,
            financialYear: dto.financialYear,
            regime: dto.regime,
          },
        },
        include: REGIME_INCLUDE,
      });
      if ((current?.version ?? 0) !== dto.version) {
        throw new VersionConflictException("Income-tax regime");
      }
      const values = {
        standardDeduction: dto.standardDeduction,
        rebateIncomeLimit: dto.rebateIncomeLimit,
        rebateMaxAmount: dto.rebateMaxAmount,
        cessPercent: dto.cessPercent,
        section80cLimit: dto.section80cLimit ?? 150000,
        homeLoanInterestLimit: dto.homeLoanInterestLimit ?? 200000,
      };
      const slabs = dto.slabs.map((s) => ({
        fromIncome: s.fromIncome,
        toIncome: s.toIncome ?? null,
        ratePercent: s.ratePercent,
      }));
      let id: number;
      if (current) {
        await tx.incomeTaxSlab.deleteMany({ where: { regimeId: current.id } });
        await tx.incomeTaxRegime.update({
          where: { id: current.id },
          data: {
            ...values,
            version: { increment: 1 },
            updatedBy: userId,
            slabs: { create: slabs },
          },
        });
        id = current.id;
      } else {
        id = (
          await tx.incomeTaxRegime.create({
            data: {
              organizationId: scope.organizationId,
              financialYear: dto.financialYear,
              regime: dto.regime,
              ...values,
              createdBy: userId,
              updatedBy: userId,
              slabs: { create: slabs },
            },
          })
        ).id;
      }
      const saved = await tx.incomeTaxRegime.findUniqueOrThrow({
        where: { id },
        include: REGIME_INCLUDE,
      });
      await this.audit.write(tx, {
        entityType: "income_tax_regime",
        entityId: id,
        action: current ? "update" : "create",
        before: current ?? undefined,
        after: saved,
      });
      return saved;
    });
  }

  @OrgScoped()
  findPtSlabs(scope: OrgScope, stateCode?: string) {
    return this.prisma.professionalTaxSlab.findMany({
      where: {
        organizationId: scope.organizationId,
        deletedAt: null,
        ...(stateCode ? { stateCode } : {}),
      },
      orderBy: [
        { stateCode: "asc" },
        { effectiveFrom: "desc" },
        { minMonthlyWage: "asc" },
      ],
    });
  }

  @OrgScoped()
  findPtSlabById(scope: OrgScope, id: number) {
    return this.prisma.professionalTaxSlab.findFirst({
      where: { id, organizationId: scope.organizationId, deletedAt: null },
    });
  }

  /** Active slabs of a state overlapping [from, to] — for the overlap check. */
  @OrgScoped()
  findPtSlabsOverlapping(
    scope: OrgScope,
    stateCode: string,
    from: Date,
    to: Date | null,
  ) {
    return this.prisma.professionalTaxSlab.findMany({
      where: {
        organizationId: scope.organizationId,
        stateCode,
        isActive: true,
        deletedAt: null,
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: from } }],
        ...(to ? { effectiveFrom: { lte: to } } : {}),
      },
    });
  }

  @OrgScoped()
  async createPtSlab(
    scope: OrgScope,
    data: {
      stateCode: string;
      minMonthlyWage: number;
      maxMonthlyWage: number | null;
      monthlyAmount: number;
      specialMonth: number | null;
      specialAmount: number | null;
      applicableMonths: number[];
      effectiveFrom: Date;
      effectiveTo: Date | null;
    },
    userId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.professionalTaxSlab.create({
        data: {
          organizationId: scope.organizationId,
          ...data,
          createdBy: userId,
          updatedBy: userId,
        },
      });
      await this.audit.write(tx, {
        entityType: "professional_tax_slab",
        entityId: created.id,
        action: "create",
        after: created,
      });
      return created;
    });
  }

  @OrgScoped()
  async updatePtSlab(
    scope: OrgScope,
    id: number,
    data: { effectiveTo?: Date | null; isActive?: boolean },
    userId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.professionalTaxSlab.findFirstOrThrow({
        where: { id, organizationId: scope.organizationId },
      });
      const after = await tx.professionalTaxSlab.update({
        where: { id },
        data: { ...data, updatedBy: userId },
      });
      await this.audit.write(tx, {
        entityType: "professional_tax_slab",
        entityId: id,
        action: "update",
        before,
        after,
      });
      return after;
    });
  }

  @OrgScoped()
  findPtLocationStates(scope: OrgScope) {
    return this.prisma.ptLocationState.findMany({
      where: { organizationId: scope.organizationId },
      include: {
        workLocation: { select: { id: true, code: true, name: true } },
      },
      orderBy: { workLocationId: "asc" },
    });
  }

  @OrgScoped()
  findWorkLocation(scope: OrgScope, id: number) {
    return this.prisma.workLocation.findFirst({
      where: { id, organizationId: scope.organizationId, deletedAt: null },
      select: { id: true },
    });
  }

  @OrgScoped()
  async setPtLocationState(
    scope: OrgScope,
    workLocationId: number,
    stateCode: string,
    userId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.ptLocationState.findUnique({
        where: { workLocationId },
      });
      const saved = await tx.ptLocationState.upsert({
        where: { workLocationId },
        create: {
          organizationId: scope.organizationId,
          workLocationId,
          stateCode,
          createdBy: userId,
          updatedBy: userId,
        },
        update: { stateCode, updatedBy: userId },
      });
      await this.audit.write(tx, {
        entityType: "pt_location_state",
        entityId: saved.id,
        action: before ? "update" : "create",
        before: before ? { stateCode: before.stateCode } : undefined,
        after: { workLocationId, stateCode },
      });
      return saved;
    });
  }
}
