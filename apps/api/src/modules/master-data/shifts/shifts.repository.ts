import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { ResourceConflictException } from "../../../common/exceptions/business.exception.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { AuditWriter } from "../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import { MasterDataRepository } from "../shared/master-data.repository.js";
import type { CreateShiftDto } from "./dto/create-shift.dto.js";
import type { UpdateShiftDto } from "./dto/update-shift.dto.js";
import { assertShiftTimes } from "./shift-time.js";

export type ShiftRow = Prisma.ShiftGetPayload<object>;

/** Queries, transactions and audit rows come from `MasterDataRepository`. */
@Injectable()
export class ShiftsRepository extends MasterDataRepository<
  ShiftRow,
  CreateShiftDto,
  UpdateShiftDto
> {
  protected readonly entityType = "shift";
  protected readonly noun = "shift";

  constructor(prisma: PrismaService, audit: AuditWriter) {
    super(prisma, audit);
  }

  protected delegate(client: PrismaService | Prisma.TransactionClient) {
    return client.shift;
  }

  protected snapshot(row: ShiftRow) {
    return {
      code: row.code,
      name: row.name,
      description: row.description,
      isActive: row.isActive,
      startTime: row.startTime,
      endTime: row.endTime,
      isOvernight: row.isOvernight,
      workingMinutes: row.workingMinutes,
    };
  }

  protected override prepareCreate(dto: CreateShiftDto) {
    // Validate (and derive isOvernight) before the transaction opens.
    return { isOvernight: assertShiftTimes(dto).isOvernight };
  }

  protected override prepareUpdate(
    before: ShiftRow,
    changed: Record<string, unknown>,
  ) {
    // Re-validate the WHOLE resulting shift, not just the changed field:
    // moving only the end time can make the stored working duration
    // impossible. isOvernight follows the times, never the client.
    if (
      "startTime" in changed ||
      "endTime" in changed ||
      "workingMinutes" in changed
    ) {
      const merged = {
        startTime:
          (changed.startTime as string | undefined) ?? before.startTime,
        endTime: (changed.endTime as string | undefined) ?? before.endTime,
        workingMinutes:
          (changed.workingMinutes as number | undefined) ??
          before.workingMinutes,
      };
      changed.isOvernight = assertShiftTimes(merged).isOvernight;
    }
  }

  protected override async assertCanDeactivate(
    tx: Prisma.TransactionClient,
    scope: OrgScope,
    row: ShiftRow,
  ) {
    // A shift still assigned to someone (or a team) from today onwards
    // cannot be switched off: attendance would resolve an inactive shift.
    // End or void those assignments first. "Today" is the UTC date; the
    // business time zone is an open attendance decision.
    const today = new Date(
      new Date().toISOString().slice(0, 10) + "T00:00:00.000Z",
    );
    const inUse = await tx.shiftAssignment.count({
      where: {
        shiftId: row.id,
        organizationId: scope.organizationId,
        isActive: true,
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: today } }],
      },
    });
    if (inUse > 0) {
      throw new ResourceConflictException(
        `Shift is still assigned (${inUse} current or future assignment(s)) — end or void them first`,
      );
    }
  }
}
