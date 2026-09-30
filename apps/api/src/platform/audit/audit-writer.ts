import { Injectable } from "@nestjs/common";
import type { Prisma } from "@texawave-erp/database";
import { ClsService } from "nestjs-cls";
import { toAuditSnapshot } from "./audit-redaction.js";

export interface AuditEntry {
  /** lower_snake, e.g. `employee`, `shift_assignment`, `leave_request`. */
  entityType: string;
  entityId: number | bigint;
  /** Closed list per entity, defined by the owning module: `create`,
   * `update`, `status_change`, `approve`, … */
  action: string;
  /** Allow-listed snapshots — never raw Prisma rows. Secrets are stripped
   * regardless (audit-redaction.ts). */
  before?: unknown;
  after?: unknown;
  reason?: string | undefined;
  /** For background jobs, which have no authenticated user. A request-bound
   * write must NOT pass this — the actor always comes from the JWT. */
  system?: { organizationId: number; label: string };
}

const ENTITY_TYPE = /^[a-z][a-z0-9_]*$/;
const ACTION = /^[a-z][a-z0-9_]*$/;

/**
 * The only writer of `audit_logs`. It takes a Prisma TRANSACTION client, so
 * the audit row commits or rolls back with the business change it describes —
 * it can never commit on its own connection, and a failed audit insert aborts
 * the change (fail-closed: an unlogged HR change must not exist).
 *
 * Who did it is never a parameter: organization, actor and IP are read from
 * the request context that `TenancyInterceptor` populated from the verified
 * JWT, so a caller cannot forge them. Only a background job may pass
 * `system`, and then there is no user.
 */
@Injectable()
export class AuditWriter {
  constructor(private readonly cls: ClsService) {}

  async write(tx: Prisma.TransactionClient, entry: AuditEntry): Promise<void> {
    if (!ENTITY_TYPE.test(entry.entityType) || !ACTION.test(entry.action)) {
      throw new Error(
        `AuditWriter: entityType/action must be lower_snake (got "${entry.entityType}"/"${entry.action}")`,
      );
    }

    let organizationId: number | undefined;
    let actorUserId: number | undefined;
    let actorType: "user" | "system";
    let reason = entry.reason;
    let ip: string | undefined;
    let correlationId: string | undefined;

    if (entry.system) {
      actorType = "system";
      organizationId = entry.system.organizationId;
      reason = reason ?? `system job: ${entry.system.label}`;
    } else {
      actorType = "user";
      organizationId = this.cls.isActive()
        ? this.cls.get<number>("organizationId")
        : undefined;
      actorUserId = this.cls.isActive()
        ? this.cls.get<number>("userId")
        : undefined;
      if (organizationId === undefined || actorUserId === undefined) {
        throw new Error(
          "AuditWriter.write() called with no authenticated user in context — " +
            "a background job must pass `system`.",
        );
      }
    }
    if (this.cls.isActive()) {
      ip = this.cls.get<string | undefined>("ip");
      correlationId = this.cls.get<string | undefined>("correlationId");
    }

    const before = toAuditSnapshot(entry.before);
    const after = toAuditSnapshot(entry.after);

    await tx.auditLog.create({
      data: {
        organizationId,
        actorUserId: actorUserId ?? null,
        actorType,
        entityType: entry.entityType,
        entityId: BigInt(entry.entityId),
        action: entry.action,
        ...(before !== undefined ? { before } : {}),
        ...(after !== undefined ? { after } : {}),
        reason: reason ?? null,
        ip: ip ?? null,
        correlationId: correlationId ?? null,
      },
    });
  }
}
