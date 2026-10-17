import { Injectable } from "@nestjs/common";
import type { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { AuditWriter } from "../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import {
  normalizeLabel,
  type CustomFieldModule,
} from "./bulk-import.fields.js";

export type CustomFieldTarget =
  "lead" | "account" | "meeting" | "coldCalling" | "miningRow";

export interface CustomFieldDefInput {
  key: string;
  label: string;
  sourceHeader: string;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

@Injectable()
export class BulkImportRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

  @OrgScoped()
  listDefs(scope: OrgScope, module?: CustomFieldModule) {
    return this.prisma.crmCustomFieldDef.findMany({
      where: tenantWhere(scope, module ? { module } : {}),
      orderBy: [{ module: "asc" }, { id: "asc" }],
    });
  }

  /** Idempotent: a def already present for the same key or the same
   * normalised label is reused; only genuinely new ones are inserted
   * (`createMany skipDuplicates` makes concurrent imports race-safe on the
   * `(organization, module, key)` unique index). Returns every def of the
   * module afterwards. */
  @OrgScoped()
  async ensureDefs(
    scope: OrgScope,
    module: CustomFieldModule,
    defs: CustomFieldDefInput[],
    actorId: number,
  ) {
    const existing = await this.listDefs(scope, module);
    const knownKeys = new Set(existing.map((d) => d.key));
    const knownLabels = new Set(existing.map((d) => normalizeLabel(d.label)));
    const fresh = defs.filter(
      (d) => !knownKeys.has(d.key) && !knownLabels.has(normalizeLabel(d.label)),
    );
    if (fresh.length === 0) return existing;
    await this.prisma.$transaction(async (tx) => {
      const created = await tx.crmCustomFieldDef.createManyAndReturn({
        data: fresh.map((d) => ({
          organizationId: scope.organizationId,
          module,
          key: d.key,
          label: d.label,
          sourceHeader: d.sourceHeader,
          createdBy: actorId,
        })),
        skipDuplicates: true,
      });
      for (const row of created) {
        await this.audit.write(tx, {
          entityType: "crm_custom_field_def",
          entityId: row.id,
          action: "create",
          after: { module: row.module, key: row.key, label: row.label },
        });
      }
    });
    return this.listDefs(scope, module);
  }

  /** Merges custom values into the row's `customFields` JSON (never
   * clobbers sibling keys). No-op for other tenants' / missing rows. */
  @OrgScoped()
  async mergeCustomFields(
    scope: OrgScope,
    target: CustomFieldTarget,
    id: number,
    values: Record<string, string>,
  ): Promise<void> {
    const where = tenantWhere(scope, { id });
    const merge = (current: unknown): Prisma.InputJsonObject => ({
      ...(isRecord(current) ? (current as Prisma.InputJsonObject) : {}),
      ...values,
    });
    switch (target) {
      case "lead": {
        const row = await this.prisma.lead.findFirst({ where });
        if (row)
          await this.prisma.lead.updateMany({
            where,
            data: { customFields: merge(row.customFields) },
          });
        return;
      }
      case "account": {
        const row = await this.prisma.account.findFirst({ where });
        if (row)
          await this.prisma.account.updateMany({
            where,
            data: { customFields: merge(row.customFields) },
          });
        return;
      }
      case "meeting": {
        const row = await this.prisma.crmMeeting.findFirst({ where });
        if (row)
          await this.prisma.crmMeeting.updateMany({
            where,
            data: { customFields: merge(row.customFields) },
          });
        return;
      }
      case "coldCalling": {
        const row = await this.prisma.crmColdCallingEntry.findFirst({ where });
        if (row)
          await this.prisma.crmColdCallingEntry.updateMany({
            where,
            data: { customFields: merge(row.customFields) },
          });
        return;
      }
      case "miningRow": {
        const row = await this.prisma.crmMiningRow.findFirst({ where });
        if (row)
          await this.prisma.crmMiningRow.updateMany({
            where,
            data: { customFields: merge(row.customFields) },
          });
        return;
      }
    }
  }
}
