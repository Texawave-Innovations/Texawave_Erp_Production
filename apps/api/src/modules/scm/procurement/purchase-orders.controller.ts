import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Paginate } from "../../../common/decorators/paginate.decorator.js";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator.js";
import {
  CreatePurchaseOrderDto,
  QueryPurchaseOrderDto,
} from "./dto/procurement.dto.js";
import { PurchaseOrdersService } from "./purchase-orders.service.js";

/** Legacy `ScmPurchaseOrders`. Approving a PO commits spend and raises
 * incoming stock, so it needs `.approve`; legacy let the creator approve. */
@ApiTags("scm-purchase-orders")
@Controller("scm/procurement/purchase-orders")
export class PurchaseOrdersController {
  constructor(private readonly orders: PurchaseOrdersService) {}

  @Get()
  @RequirePermission("scm.procurement.read")
  findAll(@Paginate(QueryPurchaseOrderDto) query: QueryPurchaseOrderDto) {
    return this.orders.findAll(query);
  }

  @Get(":id")
  @RequirePermission("scm.procurement.read")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.orders.findOne(id);
  }

  @Post()
  @RequirePermission("scm.procurement.write")
  create(@Body() dto: CreatePurchaseOrderDto) {
    return this.orders.create(dto);
  }

  @Post(":id/submit")
  @RequirePermission("scm.procurement.write")
  submit(@Param("id", ParseIntPipe) id: number) {
    return this.orders.submit(id);
  }

  @Post(":id/approve")
  @RequirePermission("scm.procurement.approve")
  approve(@Param("id", ParseIntPipe) id: number) {
    return this.orders.approve(id);
  }

  @Post(":id/send")
  @RequirePermission("scm.procurement.write")
  send(@Param("id", ParseIntPipe) id: number) {
    return this.orders.send(id);
  }

  @Post(":id/cancel")
  @RequirePermission("scm.procurement.write")
  cancel(@Param("id", ParseIntPipe) id: number) {
    return this.orders.cancel(id);
  }

  @Post(":id/close")
  @RequirePermission("scm.procurement.write")
  close(@Param("id", ParseIntPipe) id: number) {
    return this.orders.close(id);
  }

  /** Responds with how many goods receipts were removed with the PO. */
  @Delete(":id")
  @RequirePermission("scm.procurement.write")
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.orders.remove(id);
  }
}
