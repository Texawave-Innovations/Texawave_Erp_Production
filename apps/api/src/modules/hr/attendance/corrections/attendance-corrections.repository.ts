import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import {
  formatDateOnly,
  parseDateOnly,
} from "../../../../common/dates/date-only.js";
import { OrgScoped } from "../../../../common/decorators/org-scoped.decorator.js";
import { TeamScoped } from "../../../../common/decorators/team-scoped.decorator.js";
import type { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import {
  InvalidStateTransitionException,
  ResourceNotFoundException,
} from "../../../../common/exceptions/business.exception.js";
import type { OrgScope } from "../../../../common/tenancy/org-scope.js";
import type { TeamScope } from "../../../../common/tenancy/team-scope.js";
import { teamWhere } from "../../../../common/tenancy/team-where.js";
import { AuditWriter } from "../../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../../shared/prisma/prisma.service.js";
import { AttendanceRepository } from "../attendance.repository.js";
import type {
  CorrectionStatus,
  CorrectionType,
  QueryAttendanceCorrectionDto,
  SubmitAttendanceCorrectionDto,
} from "../dto/attendance-correction.dto.js";

const ENTITY_TYPE = "attendance_correction";
const VIA_EMPLOYEE = {
  teamField: "employee.teamId",
  ownerField: "employee.userId",
};

const INCLUDE = {
  employee: {
    select: {
      id: true,
      employeeCode: true,
      fullName: true,
      userId: true,
      teamId: true,
      workLocationId: true,
    },
  },
  decider: { select: { id: true, fullName: true } },
} satisfies Prisma.AttendanceCorrectionInclude;

export type CorrectionRow = Prisma.AttendanceCorrectionGetPayload<{
  include: typeof INCLUDE;
}>;

export interface CorrectionView {
  id: number;
  employee: {
    id: number;
    employeeCode: string;
    fullName: string;
    userId: number | null;
  };
  attendanceDate: string;
  correctionType: CorrectionType;
  requestedCheckInAt: Date | null;
  requestedCheckOutAt: Date | null;
  reason: string;
  status: CorrectionStatus;
  requestedBy: number;
  decidedBy: { id: number; fullName: string } | null;
  decidedAt: Date | null;
  decisionNote: string | null;
  createdAt: Date;
}

export function toCorrectionView(row: CorrectionRow): CorrectionView {
  return {
    id: row.id,
    employee: {
      id: row.employee.id,
      employeeCode: row.employee.employeeCode,
      fullName: row.employee.fullName,
      userId: row.employee.userId,
    },
    attendanceDate: formatDateOnly(row.attendanceDate),
    correctionType: row.correctionType as CorrectionType,
    requestedCheckInAt: row.requestedCheckInAt,
    requestedCheckOutAt: row.requestedCheckOutAt,
    reason: row.reason,
    status: row.status as CorrectionStatus,
    requestedBy: row.requestedBy,
    decidedBy: row.decider,
    decidedAt: row.decidedAt,
    decisionNote: row.decisionNote,
    createdAt: row.createdAt,
  };
}

/** Audit snapshot: the facts of the request, never the free-text reason or
 * the decision note (the same choice leave requests make). */
function snapshot(row: CorrectionRow) {
  return {
    employeeId: row.employee.id,
    attendanceDate: formatDateOnly(row.attendanceDate),
    correctionType: row.correctionType,
    requestedCheckInAt: row.requestedCheckInAt?.toISOString() ?? null,
    requestedCheckOutAt: row.requestedCheckOutAt?.toISOString() ?? null,
    status: row.status,
    decidedBy: row.decider?.id ?? null,
  };
}

export interface NewCorrection extends SubmitAttendanceCorrectionDto {
  employeeId: number;
}

export interface Decision {
  status: "APPROVED" | "REJECTED";
  decidedBy: number;
  note: string | undefined;
}

/** Only place PrismaService is used for correction requests. A decision is a
 * conditional update (status = SUBMITTED), so exactly one decision can ever be
 * written, even under concurrent approvals. The punch change of an approval
 * runs in the same transaction as the decision and its audit row. */
@Injectable()
export class AttendanceCorrectionsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
    private readonly attendance: AttendanceRepository,
  ) {}

  @OrgScoped()
  async create(
    scope: OrgScope,
    input: NewCorrection,
    userId: number,
  ): Promise<CorrectionView> {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.attendanceCorrection.create({
        data: {
          organizationId: scope.organizationId,
          employeeId: input.employeeId,
          attendanceDate: parseDateOnly(input.attendanceDate),
          correctionType: input.correctionType,
          requestedCheckInAt: input.requestedCheckInAt
            ? new Date(input.requestedCheckInAt)
            : null,
          requestedCheckOutAt: input.requestedCheckOutAt
            ? new Date(input.requestedCheckOutAt)
            : null,
          reason: input.reason,
          requestedBy: userId,
          createdBy: userId,
          updatedBy: userId,
        },
        include: INCLUDE,
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: row.id,
        action: "submit",
        after: snapshot(row),
      });
      return toCorrectionView(row);
    });
  }

  @TeamScoped()
  async findMany(
    scope: TeamScope,
    filter: QueryAttendanceCorrectionDto,
    pagination: PaginationDto,
  ) {
    const where = teamWhere(
      scope,
      {
        deletedAt: null,
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.employeeId !== undefined
          ? { employeeId: filter.employeeId }
          : {}),
      },
      VIA_EMPLOYEE,
    );
    const [rows, total] = await Promise.all([
      this.prisma.attendanceCorrection.findMany({
        where: where as Prisma.AttendanceCorrectionWhereInput,
        include: INCLUDE,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [{ createdAt: pagination.order ?? "desc" }, { id: "desc" }],
      }),
      this.prisma.attendanceCorrection.count({
        where: where as Prisma.AttendanceCorrectionWhereInput,
      }),
    ]);
    return { items: rows.map(toCorrectionView), total };
  }

  @TeamScoped()
  async findOne(scope: TeamScope, id: number): Promise<CorrectionView | null> {
    const row = await this.prisma.attendanceCorrection.findFirst({
      where: teamWhere(scope, { id, deletedAt: null }, VIA_EMPLOYEE),
      include: INCLUDE,
    });
    return row ? toCorrectionView(row) : null;
  }

  /** Records the decision. For an approval, the punch change is applied in the
   * same transaction, through the attendance repository. Throws if the request
   * is no longer SUBMITTED (approved or rejected by someone else first). */
  @OrgScoped()
  async decide(
    scope: OrgScope,
    id: number,
    decision: Decision,
  ): Promise<CorrectionView> {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.attendanceCorrection.findFirst({
        where: { id, organizationId: scope.organizationId, deletedAt: null },
        include: INCLUDE,
      });
      if (!before)
        throw new ResourceNotFoundException("Attendance correction", id);

      const { count } = await tx.attendanceCorrection.updateMany({
        where: {
          id,
          organizationId: scope.organizationId,
          status: "SUBMITTED",
        },
        data: {
          status: decision.status,
          decidedBy: decision.decidedBy,
          decidedAt: new Date(),
          decisionNote: decision.note ?? null,
          updatedBy: decision.decidedBy,
        },
      });
      if (count !== 1) {
        throw new InvalidStateTransitionException(
          "Attendance correction",
          before.status,
          decision.status,
          "it has already been decided",
        );
      }

      if (decision.status === "APPROVED") {
        const applied = await this.attendance.applyCorrection(
          scope,
          tx,
          {
            employeeId: before.employeeId,
            attendanceDate: formatDateOnly(before.attendanceDate),
            correctionType: before.correctionType,
            requestedCheckInAt: before.requestedCheckInAt,
            requestedCheckOutAt: before.requestedCheckOutAt,
          },
          decision.decidedBy,
        );
        await this.audit.write(tx, {
          entityType: ENTITY_TYPE,
          entityId: id,
          action: "approve",
          before: snapshot(before),
          after: {
            ...snapshot({ ...before, status: "APPROVED" } as CorrectionRow),
            punches: applied.after,
          },
        });
      } else {
        await this.audit.write(tx, {
          entityType: ENTITY_TYPE,
          entityId: id,
          action: "reject",
          before: snapshot(before),
          after: snapshot({ ...before, status: "REJECTED" } as CorrectionRow),
        });
      }

      const after = await tx.attendanceCorrection.findUniqueOrThrow({
        where: { id },
        include: INCLUDE,
      });
      return toCorrectionView(after);
    });
  }
}
