import { Injectable } from "@nestjs/common";
import { TenantContextService } from "../../../../platform/tenancy/tenant-context.service.js";
import type { UpdateAttendanceSettingsDto } from "./dto/attendance-settings.dto.js";
import { AttendanceSettingsRepository } from "./attendance-settings.repository.js";
import {
  type AttendanceRules,
  RULE_KEYS,
  toRules,
} from "./attendance-settings.rules.js";

/** Organization-wide attendance policy (HR master). */
@Injectable()
export class AttendanceSettingsService {
  constructor(
    private readonly repository: AttendanceSettingsRepository,
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

  /** The rules for the signed-in user's organization. */
  async rules(): Promise<AttendanceRules> {
    return toRules(
      await this.repository.find(this.tenantContext.getOrgScope()),
    );
  }

  async update(dto: UpdateAttendanceSettingsDto) {
    const current = await this.rules();
    const next = { ...current } as Record<keyof AttendanceRules, unknown>;
    for (const key of RULE_KEYS) {
      const value = dto[key];
      if (value !== undefined) next[key] = value;
    }
    await this.repository.save(
      this.tenantContext.getOrgScope(),
      dto.version,
      next as AttendanceRules,
      this.tenantContext.getUserId(),
    );
    return this.get();
  }
}
