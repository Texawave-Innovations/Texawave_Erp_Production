import { Injectable } from "@nestjs/common";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { AuditWriter } from "../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";

export type DocumentEntity =
  "sales_quotation" | "sales_invoice" | "sales_delivery_challan";

/** Audit rows for documents leaving the system (email, WhatsApp share). */
@Injectable()
export class DocumentDeliveryRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

  @OrgScoped()
  async record(
    _scope: OrgScope,
    entityType: DocumentEntity,
    entityId: number,
    action: "send_email" | "share_whatsapp",
    details: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.$transaction((tx) =>
      this.audit.write(tx, { entityType, entityId, action, after: details }),
    );
  }
}
