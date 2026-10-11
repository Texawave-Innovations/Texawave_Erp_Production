import { Injectable } from "@nestjs/common";
import { OrgScoped } from "../../../../common/decorators/org-scoped.decorator.js";
import { VersionConflictException } from "../../../../common/exceptions/business.exception.js";
import type { OrgScope } from "../../../../common/tenancy/org-scope.js";
import { AuditWriter } from "../../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../../shared/prisma/prisma.service.js";
import { type PayrollRules, toRules } from "./payroll-settings.rules.js";

const ENTITY_TYPE = "payroll_settings";

/** The organization's single settings row. Every write is one transaction
 * holding the version check, the change and its before/after audit row. */
@Injectable()
export class PayrollSettingsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

  @OrgScoped()
  find(scope: OrgScope) {
    return this.prisma.payrollSetting.findUnique({
      where: { organizationId: scope.organizationId },
    });
  }

  /** `version` 0 means "no row yet" — the first save creates it. */
  @OrgScoped()
  async save(
    scope: OrgScope,
    version: number,
    next: PayrollRules,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.payrollSetting.findUnique({
        where: { organizationId: scope.organizationId },
      });
      if ((current?.version ?? 0) !== version) {
        throw new VersionConflictException("Payroll settings");
      }
      const saved = current
        ? await tx.payrollSetting.update({
            where: { id: current.id },
            data: { ...next, version: { increment: 1 }, updatedBy: actorId },
          })
        : await tx.payrollSetting.create({
            data: {
              organizationId: scope.organizationId,
              ...next,
              createdBy: actorId,
              updatedBy: actorId,
            },
          });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: saved.id,
        action: current ? "update" : "create",
        before: toRules(current),
        after: toRules(saved),
      });
      return saved;
    });
  }
}
