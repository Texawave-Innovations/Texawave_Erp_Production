import { Injectable } from "@nestjs/common";
import type { Prisma } from "@texawave-erp/database";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import {
  BusinessRuleViolationException,
  ResourceConflictException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import type {
  CreateCrmQuotaDto,
  QueryCrmQuotaDto,
  QuotaLiveSummaryDto,
  UpdateCrmQuotaDto,
} from "./dto/quota.dto.js";
import {
  computeQuotaLiveSummary,
  getPeriodBounds,
  type OpportunityForAttainment,
  type QuotaMetric,
  type QuotaPeriod,
} from "./quota-attainment.js";
import {
  CrmQuotasRepository,
  type QuotaWriteData,
} from "./quotas.repository.js";

const norm = (s: string) => s.trim().toLowerCase();

type CrmQuota = Prisma.CrmQuotaGetPayload<object>;

function toView(row: CrmQuota, opportunities: OpportunityForAttainment[]) {
  const targetAmount = Number(row.targetAmount);
  return {
    ...row,
    targetAmount,
    live: computeQuotaLiveSummary(
      {
        repName: row.repName,
        period: row.period as QuotaPeriod,
        periodKey: row.periodKey,
        targetAmount,
        metric: row.metric as QuotaMetric,
      },
      opportunities,
    ),
  };
}

@Injectable()
export class CrmQuotasService {
  constructor(
    private readonly repository: CrmQuotasRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async findAll(query: QueryCrmQuotaDto) {
    const scope = this.tenantContext.getOrgScope();
    const [all, opportunities] = await Promise.all([
      this.repository.findAllLive(scope),
      this.repository.findWonOpportunities(scope),
    ]);
    const filtered = all.filter(
      (q) =>
        (!query.repName || norm(q.repName) === norm(query.repName)) &&
        (!query.period || q.period === query.period) &&
        (!query.periodKey || q.periodKey === query.periodKey),
    );
    if (query.order === "asc") filtered.reverse();
    const page = filtered.slice(query.skip, query.skip + query.limit);
    return new PaginatedResponseDto(
      page.map((q) => toView(q, opportunities)),
      filtered.length,
      query.page,
      query.limit,
    );
  }

  async findOne(id: number) {
    const scope = this.tenantContext.getOrgScope();
    const row = await this.repository.findOne(scope, id);
    if (!row) throw new ResourceNotFoundException("CrmQuota", id);
    return toView(row, await this.repository.findWonOpportunities(scope));
  }

  /** Live summary for an unsaved draft (Set-Target form panel). */
  async liveSummary(dto: QuotaLiveSummaryDto) {
    this.assertPeriodKey(dto.period, dto.periodKey);
    const opportunities = await this.repository.findWonOpportunities(
      this.tenantContext.getOrgScope(),
    );
    return computeQuotaLiveSummary(
      {
        repName: dto.repName,
        period: dto.period,
        periodKey: dto.periodKey,
        targetAmount: dto.targetAmount,
        metric: dto.metric ?? "closedWonValue",
      },
      opportunities,
    );
  }

  async create(dto: CreateCrmQuotaDto) {
    const scope = this.tenantContext.getOrgScope();
    this.assertPeriodKey(dto.period, dto.periodKey);
    await this.assertNoDuplicate(
      dto.repName,
      dto.period,
      dto.periodKey,
      undefined,
    );
    const row = await this.repository.create(
      scope,
      {
        repName: dto.repName,
        team: dto.team || null,
        managerName: dto.managerName || null,
        targetOwner: dto.targetOwner || null,
        period: dto.period,
        periodKey: dto.periodKey,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        targetAmount: dto.targetAmount,
        metric: dto.metric ?? "closedWonValue",
        currency: dto.currency || "INR",
        notes: dto.notes || null,
      },
      this.tenantContext.getUserId(),
    );
    return toView(row, await this.repository.findWonOpportunities(scope));
  }

  async update(id: number, dto: UpdateCrmQuotaDto) {
    const scope = this.tenantContext.getOrgScope();
    const existing = await this.repository.findOne(scope, id);
    if (!existing) throw new ResourceNotFoundException("CrmQuota", id);
    const repName = dto.repName ?? existing.repName;
    const period = dto.period ?? (existing.period as QuotaPeriod);
    const periodKey = dto.periodKey ?? existing.periodKey;
    this.assertPeriodKey(period, periodKey);
    await this.assertNoDuplicate(repName, period, periodKey, id);

    const data: Partial<QuotaWriteData> = { repName, period, periodKey };
    if (dto.team !== undefined) data.team = dto.team || null;
    if (dto.managerName !== undefined)
      data.managerName = dto.managerName || null;
    if (dto.targetOwner !== undefined)
      data.targetOwner = dto.targetOwner || null;
    if (dto.startDate !== undefined)
      data.startDate = dto.startDate ? new Date(dto.startDate) : null;
    if (dto.endDate !== undefined)
      data.endDate = dto.endDate ? new Date(dto.endDate) : null;
    if (dto.targetAmount !== undefined) data.targetAmount = dto.targetAmount;
    if (dto.metric !== undefined) data.metric = dto.metric;
    if (dto.currency !== undefined) data.currency = dto.currency || "INR";
    if (dto.notes !== undefined) data.notes = dto.notes || null;

    const row = await this.repository.update(
      scope,
      id,
      data,
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("CrmQuota", id);
    return toView(row, await this.repository.findWonOpportunities(scope));
  }

  async remove(id: number) {
    const row = await this.repository.softDelete(
      this.tenantContext.getOrgScope(),
      id,
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("CrmQuota", id);
    return row;
  }

  private assertPeriodKey(period: QuotaPeriod, periodKey: string) {
    if (!getPeriodBounds(period, periodKey)) {
      throw new BusinessRuleViolationException(
        period === "monthly"
          ? "Period Key must be in YYYY-MM format."
          : "Period Key must be in YYYY-Q# format.",
        "INVALID_PERIOD_KEY",
      );
    }
  }

  /** Legacy `validateForm`: one target per rep + period + periodKey,
   * rep compared trim + case-insensitive. */
  private async assertNoDuplicate(
    repName: string,
    period: string,
    periodKey: string,
    excludeId: number | undefined,
  ) {
    const all = await this.repository.findAllLive(
      this.tenantContext.getOrgScope(),
    );
    const dup = all.some(
      (q) =>
        q.id !== excludeId &&
        norm(q.repName) === norm(repName) &&
        q.period === period &&
        q.periodKey === periodKey,
    );
    if (dup) {
      throw new ResourceConflictException(
        `A ${period} target already exists for ${repName.trim()} in ${periodKey}. Edit that target instead of creating a duplicate.`,
      );
    }
  }
}
