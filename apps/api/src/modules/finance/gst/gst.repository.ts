import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import type { FinanceGstEntryType } from "../finance.constants.js";
import type { QueryGstEntriesDto } from "./dto/query-gst-entries.dto.js";

@Injectable()
export class GstRepository {
  constructor(private readonly prisma: PrismaService) {}

  @OrgScoped()
  async create(
    scope: OrgScope,
    data: Omit<Prisma.FinanceGstEntryUncheckedCreateInput, "organizationId">,
  ) {
    return this.prisma.financeGstEntry.create({
      data: {
        ...data,
        organizationId: scope.organizationId,
      },
    });
  }

  @OrgScoped()
  async findById(scope: OrgScope, id: number) {
    return this.prisma.financeGstEntry.findFirst({
      where: tenantWhere<Prisma.FinanceGstEntryWhereInput>(scope, { id }),
    });
  }

  @OrgScoped()
  async findByReference(
    scope: OrgScope,
    period: string,
    sourceReference: string,
    gstin: string,
    entryType?: FinanceGstEntryType,
  ) {
    const where: Prisma.FinanceGstEntryWhereInput = {
      period,
      sourceReference,
      gstin,
      ...(entryType ? { entryType } : {}),
      status: { not: "CANCELLED" },
    };

    return this.prisma.financeGstEntry.findFirst({
      where: tenantWhere<Prisma.FinanceGstEntryWhereInput>(scope, where),
    });
  }

  @OrgScoped()
  async findMany(scope: OrgScope, query: QueryGstEntriesDto) {
    const where: Prisma.FinanceGstEntryWhereInput = {};

    if (query.period) {
      where.period = query.period;
    }
    if (query.entryType) {
      where.entryType = query.entryType;
    }
    if (query.sourceType) {
      where.sourceType = query.sourceType;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.hsnSacCode) {
      where.hsnSacCode = query.hsnSacCode;
    }
    if (query.gstin) {
      where.gstin = { contains: query.gstin, mode: "insensitive" };
    }
    if (query.search) {
      where.OR = [
        { sourceReference: { contains: query.search, mode: "insensitive" } },
        { gstin: { contains: query.search, mode: "insensitive" } },
      ];
    }

    const scopedWhere = tenantWhere<Prisma.FinanceGstEntryWhereInput>(
      scope,
      where,
    );

    const [items, total] = await Promise.all([
      this.prisma.financeGstEntry.findMany({
        where: scopedWhere,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        ...(query.skip !== undefined ? { skip: query.skip } : {}),
        ...(query.limit !== undefined ? { take: query.limit } : {}),
      }),
      this.prisma.financeGstEntry.count({ where: scopedWhere }),
    ]);

    return { items, total };
  }

  @OrgScoped()
  async getPeriodEntries(
    scope: OrgScope,
    period: string,
    entryType?: FinanceGstEntryType,
  ) {
    const where: Prisma.FinanceGstEntryWhereInput = {
      period,
      ...(entryType ? { entryType } : {}),
      status: { not: "CANCELLED" },
    };

    return this.prisma.financeGstEntry.findMany({
      where: tenantWhere<Prisma.FinanceGstEntryWhereInput>(scope, where),
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
  }

  @OrgScoped()
  async getEntriesByDateRange(
    scope: OrgScope,
    startDate: Date,
    endDate: Date,
    entryType?: FinanceGstEntryType,
  ) {
    const where: Prisma.FinanceGstEntryWhereInput = {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
      ...(entryType ? { entryType } : {}),
      status: { not: "CANCELLED" },
    };

    return this.prisma.financeGstEntry.findMany({
      where: tenantWhere<Prisma.FinanceGstEntryWhereInput>(scope, where),
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
  }

  @OrgScoped()
  async updateStatus(scope: OrgScope, id: number, status: string) {
    const result = await this.prisma.financeGstEntry.updateMany({
      where: tenantWhere<Prisma.FinanceGstEntryWhereInput>(scope, { id }),
      data: { status },
    });
    return result.count > 0;
  }

  @OrgScoped()
  async markReconciled(scope: OrgScope, ids: number[]) {
    if (ids.length === 0) return 0;
    const result = await this.prisma.financeGstEntry.updateMany({
      where: tenantWhere<Prisma.FinanceGstEntryWhereInput>(scope, {
        id: { in: ids },
      }),
      data: { status: "RECONCILED" },
    });
    return result.count;
  }
}
