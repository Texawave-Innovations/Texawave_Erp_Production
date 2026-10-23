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
  CreateCrmMiningRowDto,
  QueryCrmMiningRowDto,
  UpdateCrmMiningRowDto,
} from "./dto/mining-row.dto.js";
import { CrmMiningRowsService } from "./mining-rows.service.js";

@ApiTags("crm-mining-rows")
@Controller("crm/mining-rows")
export class CrmMiningRowsController {
  constructor(private readonly miningRows: CrmMiningRowsService) {}

  @Get()
  @RequirePermission("crm.miningrow.read")
  findAll(@Paginate(QueryCrmMiningRowDto) query: QueryCrmMiningRowDto) {
    return this.miningRows.findAll(query);
  }

  @Get(":id")
  @RequirePermission("crm.miningrow.read")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.miningRows.findOne(id);
  }

  @Post()
  @RequirePermission("crm.miningrow.write")
  create(@Body() dto: CreateCrmMiningRowDto) {
    return this.miningRows.create(dto);
  }

  @Patch(":id")
  @RequirePermission("crm.miningrow.write")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateCrmMiningRowDto,
  ) {
    return this.miningRows.update(id, dto);
  }

  @Post(":id/promote-to-lead")
  @RequirePermission("crm.miningrow.write")
  promote(@Param("id", ParseIntPipe) id: number) {
    return this.miningRows.promote(id);
  }

  @Delete(":id")
  @RequirePermission("crm.miningrow.delete")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.miningRows.remove(id);
  }
}
