import { Injectable } from "@nestjs/common";
import type { Prisma } from "@texawave-erp/database";
import { parseDateOnly } from "../../../../common/dates/date-only.js";
import { TeamScoped } from "../../../../common/decorators/team-scoped.decorator.js";
import type { PaginationDto } from "../../../../common/dto/pagination.dto.js";
import type { TeamScope } from "../../../../common/tenancy/team-scope.js";
import { teamWhere } from "../../../../common/tenancy/team-where.js";
import { PrismaService } from "../../../../shared/prisma/prisma.service.js";

export interface ReportEmployee {
  id: number;
  employeeCode: string;
  fullName: string;
  teamId: number;
  workLocationId: number | null;
}

/** Employees in the caller's team scope employed at any point in `from`..`to`
 * (joined on or before `to`, and not exited before `from`). Employment dates
 * are data already on the employee record; nothing here is assumed. */
@Injectable()
export class AttendanceReportsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** `employeeId` and `teamId` narrow WITHIN the caller's scope: they are ANDed
   * into the scope filter, so they can never widen it. */
  @TeamScoped()
  async findEmployeesEmployedBetween(
    scope: TeamScope,
    from: string,
    to: string,
    pagination: PaginationDto,
    narrow: {
      employeeId?: number | undefined;
      teamId?: number | undefined;
    } = {},
  ): Promise<{ items: ReportEmployee[]; total: number }> {
    const where = teamWhere(
      scope,
      {
        deletedAt: null,
        dateOfJoining: { lte: parseDateOnly(to) },
        AND: [
          {
            OR: [
              { dateOfExit: null },
              { dateOfExit: { gte: parseDateOnly(from) } },
            ],
          },
        ],
        ...(narrow.employeeId !== undefined ? { id: narrow.employeeId } : {}),
        ...(narrow.teamId !== undefined ? { teamId: narrow.teamId } : {}),
      },
      { teamField: "teamId", ownerField: "userId" },
    ) as Prisma.EmployeeWhereInput;
    const [rows, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        select: {
          id: true,
          employeeCode: true,
          fullName: true,
          teamId: true,
          workLocationId: true,
        },
        orderBy: [{ employeeCode: "asc" }, { id: "asc" }],
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.employee.count({ where }),
    ]);
    return { items: rows, total };
  }
}
