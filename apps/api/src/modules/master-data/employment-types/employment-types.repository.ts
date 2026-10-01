import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { AuditWriter } from "../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import { MasterDataRepository } from "../shared/master-data.repository.js";
import type { CreateEmploymentTypeDto } from "./dto/create-employment-type.dto.js";
import type { UpdateEmploymentTypeDto } from "./dto/update-employment-type.dto.js";

export type EmploymentTypeRow = Prisma.EmploymentTypeGetPayload<object>;

/** Queries, transactions and audit rows come from `MasterDataRepository`. */
@Injectable()
export class EmploymentTypesRepository extends MasterDataRepository<
  EmploymentTypeRow,
  CreateEmploymentTypeDto,
  UpdateEmploymentTypeDto
> {
  protected readonly entityType = "employment_type";
  protected readonly noun = "employment type";

  constructor(prisma: PrismaService, audit: AuditWriter) {
    super(prisma, audit);
  }

  protected delegate(client: PrismaService | Prisma.TransactionClient) {
    return client.employmentType;
  }

  protected snapshot(row: EmploymentTypeRow) {
    return {
      code: row.code,
      name: row.name,
      description: row.description,
      isActive: row.isActive,
      probationDays: row.probationDays,
      noticeDays: row.noticeDays,
    };
  }
}
