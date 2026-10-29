import { Injectable } from "@nestjs/common";
import { isValidIanaTimezone } from "../common/formatting-utils.js";
import { BusinessRuleViolationException } from "../../../common/exceptions/business.exception.js";
import { AuditWriter } from "../../../platform/audit/audit-writer.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import type { UpdateOrganizationSettingsDto } from "./dto/update-organization-settings.dto.js";
import { OrganizationSettingsRepository } from "./organization-settings.repository.js";

@Injectable()
export class OrganizationSettingsService {
  constructor(
    private readonly repository: OrganizationSettingsRepository,
    private readonly tenantContext: TenantContextService,
    private readonly auditWriter: AuditWriter,
    private readonly prisma: PrismaService,
  ) {}

  async getSettings() {
    const scope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();
    return this.repository.findOrCreateDefault(scope, userId);
  }

  async updateSettings(dto: UpdateOrganizationSettingsDto) {
    const scope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();

    if (dto.timezone && !isValidIanaTimezone(dto.timezone)) {
      throw new BusinessRuleViolationException(
        `Invalid IANA timezone identifier: ${dto.timezone}`,
        "INVALID_TIMEZONE",
      );
    }

    const before = await this.repository.findOrCreateDefault(scope, userId);

    return this.prisma.$transaction(async (tx) => {
      const updated = await this.repository.update(scope, dto, userId, tx);
      await this.auditWriter.write(tx, {
        entityType: "organization_setting",
        entityId: updated.id,
        action: "update",
        before,
        after: updated,
      });
      return updated;
    });
  }
}
