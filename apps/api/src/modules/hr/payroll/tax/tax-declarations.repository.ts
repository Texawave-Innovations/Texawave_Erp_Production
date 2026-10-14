import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../../common/decorators/org-scoped.decorator.js";
import { TeamScoped } from "../../../../common/decorators/team-scoped.decorator.js";
import type { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import {
  BusinessRuleConflictException,
  ResourceNotFoundException,
  VersionConflictException,
} from "../../../../common/exceptions/business.exception.js";
import type { OrgScope } from "../../../../common/tenancy/org-scope.js";
import type { TeamScope } from "../../../../common/tenancy/team-scope.js";
import { teamWhere } from "../../../../common/tenancy/team-where.js";
import { AuditWriter } from "../../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../../shared/prisma/prisma.service.js";
import { findEmployeeInWriteScope } from "../shared/payroll-scope.js";
import type {
  QueryTaxDeclarationDto,
  SaveTaxDeclarationDto,
  VerifyTaxDeclarationDto,
} from "./dto/tax.dto.js";

const VIA_EMPLOYEE = {
  teamField: "employee.teamId",
  ownerField: "employee.userId",
};

const INCLUDE = {
  employee: {
    select: {
      id: true,
      employeeCode: true,
      fullName: true,
      teamId: true,
      userId: true,
    },
  },
  verifier: { select: { id: true, fullName: true } },
} satisfies Prisma.EmployeeTaxDeclarationInclude;

export type TaxDeclarationRow = Prisma.EmployeeTaxDeclarationGetPayload<{
  include: typeof INCLUDE;
}>;

/** Statuses the declarer may still change. */
const EDITABLE = ["DRAFT", "REJECTED"];

function amounts(dto: SaveTaxDeclarationDto) {
  return {
    regime: dto.regime,
    section80c: dto.section80c ?? 0,
    section80d: dto.section80d ?? 0,
    hraExemption: dto.hraExemption ?? 0,
    homeLoanInterest: dto.homeLoanInterest ?? 0,
    otherDeductions: dto.otherDeductions ?? 0,
    otherIncome: dto.otherIncome ?? 0,
    previousEmployerIncome: dto.previousEmployerIncome ?? 0,
    previousEmployerTds: dto.previousEmployerTds ?? 0,
  };
}

/**
 * Income-tax declarations (Docs/PAYROLL_AND_COMPLIANCE.md §4.13). HR reads
 * and verifies through `@TeamScoped()` methods; an employee saves only
 * their own (the service passes their employee id). Every write is audited.
 */
@Injectable()
export class TaxDeclarationsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

  @TeamScoped()
  async findMany(
    scope: TeamScope,
    query: QueryTaxDeclarationDto,
    pagination: PaginationDto,
  ) {
    const where = teamWhere(
      scope,
      {
        ...(query.financialYear ? { financialYear: query.financialYear } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      },
      VIA_EMPLOYEE,
    ) as Prisma.EmployeeTaxDeclarationWhereInput;
    const [items, total] = await Promise.all([
      this.prisma.employeeTaxDeclaration.findMany({
        where,
        include: INCLUDE,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [{ financialYear: "desc" }, { id: "desc" }],
      }),
      this.prisma.employeeTaxDeclaration.count({ where }),
    ]);
    return { items, total };
  }

  @TeamScoped()
  findById(scope: TeamScope, id: number) {
    return this.prisma.employeeTaxDeclaration.findFirst({
      where: teamWhere(
        scope,
        { id },
        VIA_EMPLOYEE,
      ) as Prisma.EmployeeTaxDeclarationWhereInput,
      include: INCLUDE,
    });
  }

  @OrgScoped()
  findMine(scope: OrgScope, employeeId: number, financialYear?: string) {
    return this.prisma.employeeTaxDeclaration.findMany({
      where: {
        organizationId: scope.organizationId,
        employeeId,
        ...(financialYear ? { financialYear } : {}),
      },
      include: INCLUDE,
      orderBy: { financialYear: "desc" },
    });
  }

  /**
   * Saves a DRAFT (or REJECTED) declaration, or creates one (`version` 0);
   * `submit` sends it for verification. A SUBMITTED or VERIFIED one is
   * locked. Shared by self-service (own employee) and HR on behalf (the
   * employee is then re-read through HR's write scope).
   */
  async save(
    organizationId: number,
    employeeId: number,
    financialYear: string,
    dto: SaveTaxDeclarationDto,
    userId: number,
    hrScope?: TeamScope,
  ): Promise<TaxDeclarationRow> {
    return this.prisma.$transaction(async (tx) => {
      if (hrScope) await findEmployeeInWriteScope(tx, hrScope, employeeId);
      const current = await tx.employeeTaxDeclaration.findUnique({
        where: { employeeId_financialYear: { employeeId, financialYear } },
      });
      if (current && current.organizationId !== organizationId) {
        throw new ResourceNotFoundException("Tax declaration", financialYear);
      }
      if ((current?.version ?? 0) !== dto.version) {
        throw new VersionConflictException("Tax declaration");
      }
      if (current && !EDITABLE.includes(current.status)) {
        throw new BusinessRuleConflictException(
          `The declaration is ${current.status.toLowerCase()} and can no longer be changed`,
          "TAX_DECLARATION_LOCKED",
        );
      }
      const status = dto.submit ? "SUBMITTED" : "DRAFT";
      const data = {
        ...amounts(dto),
        status,
        submittedAt: dto.submit ? new Date() : null,
        // A resubmission starts a fresh verification.
        verifiedById: null,
        verifiedAt: null,
        verificationNote: null,
        verifiedSection80c: null,
        verifiedSection80d: null,
        verifiedHraExemption: null,
        verifiedHomeLoanInterest: null,
        verifiedOtherDeductions: null,
        updatedBy: userId,
      };
      const saved = current
        ? await tx.employeeTaxDeclaration.update({
            where: { id: current.id },
            data: { ...data, version: { increment: 1 } },
            include: INCLUDE,
          })
        : await tx.employeeTaxDeclaration.create({
            data: {
              ...data,
              organizationId,
              employeeId,
              financialYear,
              createdBy: userId,
            },
            include: INCLUDE,
          });
      await this.audit.write(tx, {
        entityType: "tax_declaration",
        entityId: saved.id,
        action: dto.submit ? "submit" : current ? "update" : "create",
        before: current ?? undefined,
        after: { ...amounts(dto), status, onBehalf: Boolean(hrScope) },
      });
      return saved;
    });
  }

  /** SUBMITTED → VERIFIED | REJECTED, exactly once (conditional update). */
  @TeamScoped()
  async verify(
    scope: TeamScope,
    id: number,
    dto: VerifyTaxDeclarationDto,
    userId: number,
  ): Promise<TaxDeclarationRow | null> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.employeeTaxDeclaration.findFirst({
        where: teamWhere(
          scope,
          { id },
          VIA_EMPLOYEE,
        ) as Prisma.EmployeeTaxDeclarationWhereInput,
      });
      if (!current) throw new ResourceNotFoundException("Tax declaration", id);
      await findEmployeeInWriteScope(tx, scope, current.employeeId);
      const verified = dto.decision === "VERIFIED";
      const { count } = await tx.employeeTaxDeclaration.updateMany({
        where: { id, status: "SUBMITTED" },
        data: {
          status: dto.decision,
          verifiedById: userId,
          verifiedAt: new Date(),
          verificationNote: dto.note ?? null,
          ...(verified
            ? {
                verifiedSection80c:
                  dto.verifiedSection80c ?? current.section80c,
                verifiedSection80d:
                  dto.verifiedSection80d ?? current.section80d,
                verifiedHraExemption:
                  dto.verifiedHraExemption ?? current.hraExemption,
                verifiedHomeLoanInterest:
                  dto.verifiedHomeLoanInterest ?? current.homeLoanInterest,
                verifiedOtherDeductions:
                  dto.verifiedOtherDeductions ?? current.otherDeductions,
              }
            : {}),
          version: { increment: 1 },
          updatedBy: userId,
        },
      });
      if (count === 0) return null;
      const after = await tx.employeeTaxDeclaration.findUniqueOrThrow({
        where: { id },
        include: INCLUDE,
      });
      await this.audit.write(tx, {
        entityType: "tax_declaration",
        entityId: id,
        action: verified ? "verify" : "reject",
        before: { status: "SUBMITTED" },
        after: {
          status: after.status,
          verifiedSection80c: after.verifiedSection80c?.toString() ?? null,
          verifiedSection80d: after.verifiedSection80d?.toString() ?? null,
          verifiedHraExemption: after.verifiedHraExemption?.toString() ?? null,
          verifiedHomeLoanInterest:
            after.verifiedHomeLoanInterest?.toString() ?? null,
          verifiedOtherDeductions:
            after.verifiedOtherDeductions?.toString() ?? null,
        },
        reason: dto.note,
      });
      return after;
    });
  }
}
