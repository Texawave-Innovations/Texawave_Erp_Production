import { Injectable } from "@nestjs/common";
import { OrgScoped } from "../../../../common/decorators/org-scoped.decorator.js";
import { VersionConflictException } from "../../../../common/exceptions/business.exception.js";
import type { OrgScope } from "../../../../common/tenancy/org-scope.js";
import { AuditWriter } from "../../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../../shared/prisma/prisma.service.js";
import { type AttendanceRules, toRules } from "./attendance-settings.rules.js";

const ENTITY_TYPE = "attendance_settings";

/** The organization's single attendance settings row. Every write is one
 * transaction holding the version check, the change and its before/after
 * audit row. */
@Injectable()
export class AttendanceSettingsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

  @OrgScoped()
  find(scope: OrgScope) {
    return this.prisma.attendanceSetting.findUnique({
      where: { organizationId: scope.organizationId },
    });
  }

  /** `version` 0 means "no row yet" — the first save creates it. */
  @OrgScoped()
  async save(
    scope: OrgScope,
    version: number,
    next: AttendanceRules,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.attendanceSetting.findUnique({
        where: { organizationId: scope.organizationId },
      });
      if ((current?.version ?? 0) !== version) {
        throw new VersionConflictException("Attendance settings");
      }
      const saved = current
        ? await tx.attendanceSetting.update({
            where: { id: current.id },
            data: { ...next, version: { increment: 1 }, updatedBy: actorId },
          })
        : await tx.attendanceSetting.create({
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
