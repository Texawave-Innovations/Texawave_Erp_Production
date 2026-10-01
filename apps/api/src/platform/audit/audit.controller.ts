import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Paginate } from "../../common/decorators/paginate.decorator.js";
import { RequirePermission } from "../../common/decorators/require-permission.decorator.js";
import { AuditQueryService } from "./audit-query.service.js";
import { QueryAuditLogDto } from "./dto/query-audit-log.dto.js";

/** Read-only by construction — there is no create/update/delete route. */
@ApiTags("audit")
@Controller("audit")
export class AuditController {
  constructor(private readonly audit: AuditQueryService) {}

  @Get("logs")
  @RequirePermission("audit.log.read")
  @ApiOperation({
    summary: "Browse the audit trail of the current organization",
  })
  findAll(@Paginate(QueryAuditLogDto) query: QueryAuditLogDto) {
    return this.audit.findAll(query);
  }
}
