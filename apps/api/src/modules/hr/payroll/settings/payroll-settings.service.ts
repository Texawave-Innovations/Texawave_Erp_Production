import { Injectable } from "@nestjs/common";
import { BusinessRuleViolationException } from "../../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../../platform/tenancy/tenant-context.service.js";
import type { UpdatePayrollSettingsDto } from "./dto/payroll-settings.dto.js";
import { PayrollSettingsRepository } from "./payroll-settings.repository.js";
import {
  DEFAULT_PAYROLL_RULES,
  type PayrollRules,
  splitGross,
  toRules,
} from "./payroll-settings.rules.js";

/** Organization-wide payroll rules. Exported so the salary service can
 * auto-split a gross amount with the organization's percentages. */
@Injectable()
export class PayrollSettingsService {
  constructor(
    private readonly repository: PayrollSettingsRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async get() {
    const row = await this.repository.find(this.tenantContext.getOrgScope());
    return {
      ...toRules(row),
      /** True until the first save: the values are the built-in defaults. */
      isDefault: row === null,
      version: row?.version ?? 0,
      updatedAt: row?.updatedAt ?? null,
    };
  }

  async rules(): Promise<PayrollRules> {
    return toRules(
      await this.repository.find(this.tenantContext.getOrgScope()),
    );
  }

  async update(dto: UpdatePayrollSettingsDto) {
    const current = await this.rules();
    const next: PayrollRules = { ...current };
    for (const key of Object.keys(DEFAULT_PAYROLL_RULES) as Array<
      keyof PayrollRules
    >) {
      const value = dto[key];
      if (value !== undefined) next[key] = value;
    }
    if (next.basicPercent + next.hraPercent + next.conveyancePercent > 100) {
      throw new BusinessRuleViolationException(
        "Basic, HRA and conveyance together cannot exceed 100% of the gross salary",
        "SALARY_SPLIT_OVER_100",
      );
    }
    await this.repository.save(
      this.tenantContext.getOrgScope(),
      dto.version,
      next,
      this.tenantContext.getUserId(),
    );
    return this.get();
  }

  /** What a gross monthly salary splits into under the current settings. */
  async previewSplit(grossMonthly: number) {
    return { grossMonthly, ...splitGross(grossMonthly, await this.rules()) };
  }
}
