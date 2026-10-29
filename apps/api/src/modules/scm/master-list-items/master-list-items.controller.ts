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
import { Paginate } from "../../../common/decorators/paginate.decorator.js";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator.js";
import { CreateMasterListItemDto } from "./dto/create-master-list-item.dto.js";
import { QueryMasterListItemDto } from "./dto/query-master-list-item.dto.js";
import { UpdateMasterListItemDto } from "./dto/update-master-list-item.dto.js";
import { MasterListItemsService } from "./master-list-items.service.js";

/** SCM Master page — one generic resource behind `?category=` for all four
 * cards (supplier_type/package_type/warehouse_type/stock_adjustment_reason —
 * see `SCM_MASTER_LIST_CATEGORIES`). A future consumer (Supplier, Warehouse,
 * ScmPackingPackage, ScmStockAdjustment forms) should reference a row here
 * by `id`, never copy `value`. */
@ApiTags("scm-master-list-items")
@Controller("scm/master-list-items")
export class MasterListItemsController {
  constructor(private readonly items: MasterListItemsService) {}

  @Get()
  @RequirePermission("scm.master_list_item.read")
  @ApiOperation({ summary: "List one SCM Master category's items" })
  findAll(@Paginate(QueryMasterListItemDto) query: QueryMasterListItemDto) {
    return this.items.findAll(query);
  }

  @Get(":id")
  @RequirePermission("scm.master_list_item.read")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.items.findOne(id);
  }

  @Post()
  @RequirePermission("scm.master_list_item.write")
  create(@Body() dto: CreateMasterListItemDto) {
    return this.items.create(dto);
  }

  @Patch(":id")
  @RequirePermission("scm.master_list_item.write")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateMasterListItemDto,
  ) {
    return this.items.update(id, dto);
  }

  @Delete(":id")
  @RequirePermission("scm.master_list_item.write")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.items.remove(id);
  }
}
