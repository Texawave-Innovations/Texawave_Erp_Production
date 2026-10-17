import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Paginate } from "../../../common/decorators/paginate.decorator.js";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator.js";
import {
  CreateCrmQuotaDto,
  QueryCrmQuotaDto,
  QuotaLiveSummaryDto,
  UpdateCrmQuotaDto,
} from "./dto/quota.dto.js";
import { CrmQuotasService } from "./quotas.service.js";

/** Three tiers, as legacy Quotas.tsx: `.read` = view every rep's targets
 * (canViewAll), `.write` = Set/Edit target (canManagePipelineConfig),
 * `.delete` = admin only (isCrmAdmin). */
@ApiTags("crm-quotas")
@Controller("crm/quotas")
export class CrmQuotasController {
  constructor(private readonly quotas: CrmQuotasService) {}

  @Get()
  @RequirePermission("crm.quota.read")
  findAll(@Paginate(QueryCrmQuotaDto) query: QueryCrmQuotaDto) {
    return this.quotas.findAll(query);
  }

  @Post("live-summary")
  @HttpCode(HttpStatus.OK)
  @RequirePermission("crm.quota.write")
  liveSummary(@Body() dto: QuotaLiveSummaryDto) {
    return this.quotas.liveSummary(dto);
  }

  @Get(":id")
  @RequirePermission("crm.quota.read")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.quotas.findOne(id);
  }

  @Post()
  @RequirePermission("crm.quota.write")
  create(@Body() dto: CreateCrmQuotaDto) {
    return this.quotas.create(dto);
  }

  @Patch(":id")
  @RequirePermission("crm.quota.write")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateCrmQuotaDto,
  ) {
    return this.quotas.update(id, dto);
  }

  @Delete(":id")
  @RequirePermission("crm.quota.delete")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.quotas.remove(id);
  }
}
