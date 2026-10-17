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
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Paginate } from "../../common/decorators/paginate.decorator.js";
import { RequirePermission } from "../../common/decorators/require-permission.decorator.js";
import { CreateMasterListItemDto } from "./dto/create-master-list-item.dto.js";
import { QueryMasterListItemDto } from "./dto/query-master-list-item.dto.js";
import { UpdateMasterListItemDto } from "./dto/update-master-list-item.dto.js";
import { MasterListItemsService } from "./master-list-items.service.js";

/** Finance Master page — one generic resource behind `?category=` for both
 * cards (expense_type/payment_mode — see `FINANCE_MASTER_LIST_CATEGORIES`).
 * A future Finance module (expenses, payments) should reference a row here
 * by `id`, never copy `value`. */
@ApiTags("finance-settings-master-list-items")
@Controller("finance-settings/master-list-items")
export class MasterListItemsController {
  constructor(private readonly items: MasterListItemsService) {}

  @Get()
  @RequirePermission("finance_settings.master_list_item.read")
  @ApiOperation({ summary: "List one Finance Master category's items" })
  findAll(@Paginate(QueryMasterListItemDto) query: QueryMasterListItemDto) {
    return this.items.findAll(query);
  }

  @Get(":id")
  @RequirePermission("finance_settings.master_list_item.read")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.items.findOne(id);
  }

  @Post()
  @RequirePermission("finance_settings.master_list_item.write")
  create(@Body() dto: CreateMasterListItemDto) {
    return this.items.create(dto);
  }

  @Patch(":id")
  @RequirePermission("finance_settings.master_list_item.write")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateMasterListItemDto,
  ) {
    return this.items.update(id, dto);
  }

  @Delete(":id")
  @RequirePermission("finance_settings.master_list_item.write")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.items.remove(id);
  }
}
