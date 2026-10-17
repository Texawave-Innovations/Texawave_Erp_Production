import { Injectable } from "@nestjs/common";
import { BusinessRuleViolationException } from "../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import type {
  QueryOverallDataDto,
  QueryOverallDataRecordsDto,
} from "./dto/overall-data.dto.js";
import {
  OVERALL_ROWS,
  countsFromRecords,
  deriveOverallData,
  monthDayKeys,
  monthQueryWindow,
} from "./overall-data.derive.js";
import { CrmOverallDataRepository } from "./overall-data.repository.js";

@Injectable()
export class CrmOverallDataService {
  constructor(
    private readonly repository: CrmOverallDataRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  private async derive(year: number, month: number) {
    const { from, to } = monthQueryWindow(year, month);
    const sources = await this.repository.loadSources(
      this.tenantContext.getOrgScope(),
      from,
      to,
    );
    return deriveOverallData(sources, year, month);
  }

  /** Month grid: per-row, per-day counts + month totals. Every count is
   * `records.length` of the same derivation the drill-down returns, so the
   * grid and the drill-down can never disagree. */
  async getMonth(query: QueryOverallDataDto) {
    const records = await this.derive(query.year, query.month);
    const { daily, monthTotals } = countsFromRecords(records);
    return {
      year: query.year,
      month: query.month,
      rows: OVERALL_ROWS,
      days: monthDayKeys(query.year, query.month),
      daily,
      monthTotals,
    };
  }

  async getRecords(query: QueryOverallDataRecordsDto) {
    if (
      !query.day.startsWith(
        `${query.year}-${String(query.month).padStart(2, "0")}-`,
      )
    ) {
      throw new BusinessRuleViolationException(
        "day must fall inside the requested year/month",
        "DAY_OUT_OF_MONTH",
      );
    }
    const records = await this.derive(query.year, query.month);
    return records[query.row][query.day] ?? [];
  }
}
