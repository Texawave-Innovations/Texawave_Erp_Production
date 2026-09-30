import { Global, Module } from "@nestjs/common";
import { AuditController } from "./audit.controller.js";
import { AuditQueryService } from "./audit-query.service.js";
import { AuditRepository } from "./audit.repository.js";
import { AuditWriter } from "./audit-writer.js";

/** Global so any module's repository can inject `AuditWriter` without
 * importing this module (same as Prisma/Tenancy). Only the writer and the
 * query service are exported — never the repository. */
@Global()
@Module({
  controllers: [AuditController],
  providers: [AuditRepository, AuditQueryService, AuditWriter],
  exports: [AuditWriter, AuditQueryService],
})
export class AuditModule {}
