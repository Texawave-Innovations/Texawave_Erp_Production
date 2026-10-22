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
  CreateQuotationDto,
  QueryQuotationDto,
  SaveComparisonDto,
} from "./dto/procurement.dto.js";
import { SupplierQuotationsService } from "./supplier-quotations.service.js";

/** Legacy `ScmSupplierQuotations`. */
@ApiTags("scm-supplier-quotations")
@Controller("scm/procurement/quotations")
export class SupplierQuotationsController {
  constructor(private readonly quotations: SupplierQuotationsService) {}

  @Get()
  @RequirePermission("scm.procurement.read")
  findAll(@Paginate(QueryQuotationDto) query: QueryQuotationDto) {
    return this.quotations.findAll(query);
  }

  @Get(":id")
  @RequirePermission("scm.procurement.read")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.quotations.findOne(id);
  }

  @Post()
  @RequirePermission("scm.procurement.write")
  create(@Body() dto: CreateQuotationDto) {
    return this.quotations.create(dto);
  }

  @Post(":id/reject")
  @RequirePermission("scm.procurement.write")
  reject(@Param("id", ParseIntPipe) id: number) {
    return this.quotations.reject(id);
  }

  @Post(":id/cancel")
  @RequirePermission("scm.procurement.write")
  cancel(@Param("id", ParseIntPipe) id: number) {
    return this.quotations.cancel(id);
  }
}

/** Legacy `ScmQuotationComparison`. Saving a comparison can select the
 * winning quotation and reject the rest, so it needs `.approve` (legacy
 * claimed selection is "by an authorized user" but never checked). */
@ApiTags("scm-quotation-comparison")
@Controller("scm/procurement/comparison")
export class QuotationComparisonController {
  constructor(private readonly quotations: SupplierQuotationsService) {}

  @Get(":rfqId")
  @RequirePermission("scm.procurement.read")
  data(@Param("rfqId", ParseIntPipe) rfqId: number) {
    return this.quotations.comparisonData(rfqId);
  }

  @Get(":rfqId/history")
  @RequirePermission("scm.procurement.read")
  history(@Param("rfqId", ParseIntPipe) rfqId: number) {
    return this.quotations.comparisonHistory(rfqId);
  }

  @Post()
  @RequirePermission("scm.procurement.approve")
  save(@Body() dto: SaveComparisonDto) {
    return this.quotations.saveComparison(dto);
  }
}
