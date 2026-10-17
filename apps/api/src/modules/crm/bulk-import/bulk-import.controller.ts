import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator.js";
import { BulkImportService } from "./bulk-import.service.js";
import { isImportEntity, type ImportEntity } from "./bulk-import.fields.js";
import {
  CommitImportDto,
  MatchHeadersDto,
  QueryCustomFieldsDto,
  QueryExportDto,
} from "./dto/bulk-import.dto.js";

function entityOf(raw: string): ImportEntity {
  if (!isImportEntity(raw))
    throw new NotFoundException(`Unknown import entity "${raw}"`);
  return raw;
}

/** Client parses the workbook (xlsx) and posts mapped rows as JSON; every
 * row is re-validated here and committed through the owning module's own
 * service. The target entity's own write permission is checked in the
 * service in addition to `crm.import.write`. */
@ApiTags("crm-bulk-import")
@Controller("crm/import")
export class BulkImportController {
  constructor(private readonly bulkImport: BulkImportService) {}

  @Get(":entity/fields")
  @RequirePermission("crm.import.write")
  fields(@Param("entity") entity: string) {
    return this.bulkImport.fields(entityOf(entity));
  }

  @Post(":entity/match-headers")
  @HttpCode(HttpStatus.OK)
  @RequirePermission("crm.import.write")
  matchHeaders(@Param("entity") entity: string, @Body() dto: MatchHeadersDto) {
    return this.bulkImport.matchHeaders(entityOf(entity), dto.headers);
  }

  @Post(":entity/commit")
  @HttpCode(HttpStatus.OK)
  @RequirePermission("crm.import.write")
  commit(@Param("entity") entity: string, @Body() dto: CommitImportDto) {
    return this.bulkImport.commit(entityOf(entity), dto);
  }

  @Get(":entity/export")
  @RequirePermission("crm.export.read")
  export(@Param("entity") entity: string, @Query() query: QueryExportDto) {
    return this.bulkImport.export(entity, query);
  }
}

/** Defs are only column labels for `customFields` JSON, so any
 * authenticated user of the organisation may read them (list pages need
 * them to label the columns). Org-scoped in the repository. */
@ApiTags("crm-bulk-import")
@Controller("crm/custom-fields")
export class CrmCustomFieldsController {
  constructor(private readonly bulkImport: BulkImportService) {}

  @Get()
  list(@Query() query: QueryCustomFieldsDto) {
    return this.bulkImport.listCustomFields(query.module);
  }
}
