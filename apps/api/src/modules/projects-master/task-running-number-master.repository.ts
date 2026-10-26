import { Injectable } from "@nestjs/common";
import { translateDbError } from "../../common/database/db-errors.js";
import { OrgScoped } from "../../common/decorators/org-scoped.decorator.js";
import { ResourceConflictException } from "../../common/exceptions/business.exception.js";
import type { OrgScope } from "../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../common/tenancy/tenant-where.js";
import { PrismaService } from "../../shared/prisma/prisma.service.js";
import type { UpdateTaskRunningNumberMasterDto } from "./dto/update-task-running-number-master.dto.js";

/** The only place `PrismaService` is called for this resource. One row per
 * org — the UI edits a fixed set of fields, never creates/deletes a row, so
 * a save always upserts. Uses Prisma's native `upsert` on the unique
 * `organizationId` (a single atomic INSERT ... ON CONFLICT), not a
 * find-then-create/update pair, so two concurrent first-saves for the same
 * org can't race past each other. */
@Injectable()
export class TaskRunningNumberMasterRepository {
  constructor(private readonly prisma: PrismaService) {}

  @OrgScoped()
  findOne(scope: OrgScope) {
    return this.prisma.taskRunningNumberMaster.findFirst({
      where: tenantWhere(scope, {}),
    });
  }

  @OrgScoped()
  async upsert(
    scope: OrgScope,
    dto: UpdateTaskRunningNumberMasterDto,
    actorId: number,
  ) {
    try {
      return await this.prisma.taskRunningNumberMaster.upsert({
        where: { organizationId: scope.organizationId },
        create: {
          ...dto,
          organizationId: scope.organizationId,
          updatedBy: actorId,
        },
        update: { ...dto, updatedBy: actorId },
      });
    } catch (error) {
      throw translateDbError(error, {
        organization_id: new ResourceConflictException(
          "Task running number master already exists for this organization",
        ),
      });
    }
  }
}
