import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Paginate } from "../../../common/decorators/paginate.decorator.js";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator.js";
import {
  CreateGoodsReceiptDto,
  QueryGoodsReceiptDto,
} from "./dto/procurement.dto.js";
import { GoodsReceiptsService } from "./goods-receipts.service.js";

/** Legacy `ScmGrn`. A GRN is posted atomically with its stock effects. */
@ApiTags("scm-goods-receipts")
@Controller("scm/procurement/goods-receipts")
export class GoodsReceiptsController {
  constructor(private readonly receipts: GoodsReceiptsService) {}

  @Get()
  @RequirePermission("scm.procurement.read")
  findAll(@Paginate(QueryGoodsReceiptDto) query: QueryGoodsReceiptDto) {
    return this.receipts.findAll(query);
  }

  @Get(":id")
  @RequirePermission("scm.procurement.read")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.receipts.findOne(id);
  }

  @Post()
  @RequirePermission("scm.procurement.write")
  create(@Body() dto: CreateGoodsReceiptDto) {
    return this.receipts.create(dto);
  }
}
