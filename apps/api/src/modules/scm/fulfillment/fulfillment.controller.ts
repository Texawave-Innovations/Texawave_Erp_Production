import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Paginate } from "../../../common/decorators/paginate.decorator.js";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator.js";
import {
  AssignPickerDto,
  CancelFulfillmentDto,
  CreateFulfillmentDto,
  CreatePackingDto,
  QueryFulfillmentDto,
  QueryPackingDto,
  QueryPickingDto,
  RecordPickDto,
} from "./dto/fulfillment.dto.js";
import { FulfillmentService } from "./fulfillment.service.js";

/** Legacy `orders/*` screens: Fulfillment, Allocation (view=allocation),
 * Backorders (view=backorders). */
@ApiTags("scm-fulfillments")
@Controller("scm/fulfillments")
export class FulfillmentsController {
  constructor(private readonly svc: FulfillmentService) {}

  @Get()
  @RequirePermission("scm.fulfillment.read")
  list(@Paginate(QueryFulfillmentDto) query: QueryFulfillmentDto) {
    return this.svc.listFulfillments(query);
  }

  @Get(":id")
  @RequirePermission("scm.fulfillment.read")
  get(@Param("id", ParseIntPipe) id: number) {
    return this.svc.getFulfillment(id);
  }

  @Post()
  @RequirePermission("scm.fulfillment.write")
  create(@Body() dto: CreateFulfillmentDto) {
    return this.svc.createFulfillment(dto);
  }

  @Post(":id/reserve")
  @RequirePermission("scm.fulfillment.write")
  reserve(@Param("id", ParseIntPipe) id: number) {
    return this.svc.reserve(id);
  }

  @Post(":id/release")
  @RequirePermission("scm.fulfillment.write")
  release(@Param("id", ParseIntPipe) id: number) {
    return this.svc.release(id);
  }

  @Post(":id/pick-list")
  @RequirePermission("scm.fulfillment.write")
  createPick(@Param("id", ParseIntPipe) id: number) {
    return this.svc.createPick(id);
  }

  @Post(":id/shortage-requisition")
  @RequirePermission("scm.fulfillment.write")
  shortage(@Param("id", ParseIntPipe) id: number) {
    return this.svc.shortageRequisition(id);
  }

  @Post(":id/finalize")
  @RequirePermission("scm.fulfillment.approve")
  finalize(@Param("id", ParseIntPipe) id: number) {
    return this.svc.finalize(id);
  }

  @Post(":id/cancel")
  @RequirePermission("scm.fulfillment.write")
  cancel(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: CancelFulfillmentDto,
  ) {
    return this.svc.cancel(id, dto.reason);
  }

  @Delete(":id")
  @HttpCode(204)
  @RequirePermission("scm.fulfillment.write")
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.svc.removeFulfillment(id);
  }
}

/** Legacy `ScmWarehousePicking`. Nothing here reduces on-hand stock. */
@ApiTags("scm-pickings")
@Controller("scm/pickings")
export class PickingsController {
  constructor(private readonly svc: FulfillmentService) {}

  @Get()
  @RequirePermission("scm.fulfillment.read")
  list(@Paginate(QueryPickingDto) query: QueryPickingDto) {
    return this.svc.listPickings(query);
  }

  @Get(":id")
  @RequirePermission("scm.fulfillment.read")
  get(@Param("id", ParseIntPipe) id: number) {
    return this.svc.getPicking(id);
  }

  @Post(":id/start")
  @RequirePermission("scm.fulfillment.write")
  start(@Param("id", ParseIntPipe) id: number) {
    return this.svc.startPick(id);
  }

  @Post(":id/assign")
  @RequirePermission("scm.fulfillment.write")
  assign(@Param("id", ParseIntPipe) id: number, @Body() dto: AssignPickerDto) {
    return this.svc.assignPick(id, dto);
  }

  @Post(":id/record")
  @RequirePermission("scm.fulfillment.write")
  record(@Param("id", ParseIntPipe) id: number, @Body() dto: RecordPickDto) {
    return this.svc.recordPick(id, dto);
  }

  @Post(":id/cancel")
  @RequirePermission("scm.fulfillment.write")
  cancel(@Param("id", ParseIntPipe) id: number) {
    return this.svc.cancelPick(id);
  }

  @Delete(":id")
  @HttpCode(204)
  @RequirePermission("scm.fulfillment.write")
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.svc.removePicking(id);
  }
}

/** Legacy `ScmWarehousePacking`. */
@ApiTags("scm-packings")
@Controller("scm/packings")
export class PackingsController {
  constructor(private readonly svc: FulfillmentService) {}

  @Get()
  @RequirePermission("scm.fulfillment.read")
  list(@Paginate(QueryPackingDto) query: QueryPackingDto) {
    return this.svc.listPackings(query);
  }

  @Get(":id")
  @RequirePermission("scm.fulfillment.read")
  get(@Param("id", ParseIntPipe) id: number) {
    return this.svc.getPacking(id);
  }

  @Post()
  @RequirePermission("scm.fulfillment.write")
  create(@Body() dto: CreatePackingDto) {
    return this.svc.createPacking(dto);
  }

  @Post(":id/pack")
  @RequirePermission("scm.fulfillment.write")
  pack(@Param("id", ParseIntPipe) id: number) {
    return this.svc.markPacked(id);
  }

  @Post(":id/cancel")
  @RequirePermission("scm.fulfillment.write")
  cancel(@Param("id", ParseIntPipe) id: number) {
    return this.svc.cancelPacking(id);
  }

  @Delete(":id")
  @HttpCode(204)
  @RequirePermission("scm.fulfillment.write")
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.svc.removePacking(id);
  }
}
