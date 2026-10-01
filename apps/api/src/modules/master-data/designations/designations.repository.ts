import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { AuditWriter } from "../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import { MasterDataRepository } from "../shared/master-data.repository.js";
import type { CreateDesignationDto } from "./dto/create-designation.dto.js";
import type { UpdateDesignationDto } from "./dto/update-designation.dto.js";

export type DesignationRow = Prisma.DesignationGetPayload<object>;

/** Queries, transactions and audit rows come from `MasterDataRepository`. */
@Injectable()
export class DesignationsRepository extends MasterDataRepository<
  DesignationRow,
  CreateDesignationDto,
  UpdateDesignationDto
> {
  protected readonly entityType = "designation";
  protected readonly noun = "designation";

  constructor(prisma: PrismaService, audit: AuditWriter) {
    super(prisma, audit);
  }

  protected delegate(client: PrismaService | Prisma.TransactionClient) {
    return client.designation;
  }

  protected snapshot(row: DesignationRow) {
    return {
      code: row.code,
      name: row.name,
      description: row.description,
      isActive: row.isActive,
    };
  }
}
