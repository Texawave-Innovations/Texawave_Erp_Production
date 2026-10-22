import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Paginate } from "../../../common/decorators/paginate.decorator.js";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator.js";
import {
  QueryRequisitionDto,
  RejectRequisitionDto,
  RequisitionPayloadDto,
} from "./dto/procurement.dto.js";
import { PurchaseRequisitionsService } from "./purchase-requisitions.service.js";

/** Legacy `ScmPurchaseRequisitions`. Submit/cancel need `.write`; approving
 * or rejecting needs `.approve` (legacy let any SCM user approve their own
 * requisition). */
@ApiTags("scm-purchase-requisitions")
@Controller("scm/procurement/requisitions")
export class PurchaseRequisitionsController {
  constructor(private readonly requisitions: PurchaseRequisitionsService) {}

  @Get()
  @RequirePermission("scm.procurement.read")
  findAll(@Paginate(QueryRequisitionDto) query: QueryRequisitionDto) {
    return this.requisitions.findAll(query);
  }

  @Get(":id")
  @RequirePermission("scm.procurement.read")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.requisitions.findOne(id);
  }

  @Post()
  @RequirePermission("scm.procurement.write")
  create(@Body() dto: RequisitionPayloadDto) {
    return this.requisitions.create(dto);
  }

  @Put(":id")
  @RequirePermission("scm.procurement.write")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: RequisitionPayloadDto,
  ) {
    return this.requisitions.update(id, dto);
  }

  @Post(":id/submit")
  @RequirePermission("scm.procurement.write")
  submit(@Param("id", ParseIntPipe) id: number) {
    return this.requisitions.submit(id);
  }

  @Post(":id/approve")
  @RequirePermission("scm.procurement.approve")
  approve(@Param("id", ParseIntPipe) id: number) {
    return this.requisitions.approve(id);
  }

  @Post(":id/reject")
  @RequirePermission("scm.procurement.approve")
  reject(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: RejectRequisitionDto,
  ) {
    return this.requisitions.reject(id, dto);
  }

  @Post(":id/cancel")
  @RequirePermission("scm.procurement.write")
  cancel(@Param("id", ParseIntPipe) id: number) {
    return this.requisitions.cancel(id);
  }
}
