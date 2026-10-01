import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { AuditWriter } from "../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import { MasterDataRepository } from "../shared/master-data.repository.js";
import type { CreateWorkLocationDto } from "./dto/create-work-location.dto.js";
import type { UpdateWorkLocationDto } from "./dto/update-work-location.dto.js";

export type WorkLocationRow = Prisma.WorkLocationGetPayload<object>;

/** Queries, transactions and audit rows come from `MasterDataRepository`. */
@Injectable()
export class WorkLocationsRepository extends MasterDataRepository<
  WorkLocationRow,
  CreateWorkLocationDto,
  UpdateWorkLocationDto
> {
  protected readonly entityType = "work_location";
  protected readonly noun = "work location";

  constructor(prisma: PrismaService, audit: AuditWriter) {
    super(prisma, audit);
  }

  protected delegate(client: PrismaService | Prisma.TransactionClient) {
    return client.workLocation;
  }

  protected snapshot(row: WorkLocationRow) {
    return {
      code: row.code,
      name: row.name,
      description: row.description,
      isActive: row.isActive,
    };
  }
}
