import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Paginate } from "../../../common/decorators/paginate.decorator.js";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator.js";
import { PaginationDto } from "../../../common/dto/pagination.dto.js";
import {
  AssignCarrierDto,
  CreateCarrierDto,
  CreateShipmentDto,
  DeliverShipmentDto,
  QueryCarrierDto,
  QueryShipmentDto,
  ReasonDto,
  RecordExceptionDto,
  ResolveExceptionDto,
  ShipmentLabelDto,
  ShipmentStatusUpdateDto,
  UpdateCarrierDto,
} from "./dto/logistics.dto.js";
import { LogisticsService } from "./logistics.service.js";

/** Legacy `ScmCarriers`. */
@ApiTags("scm-carriers")
@Controller("scm/carriers")
export class CarriersController {
  constructor(private readonly svc: LogisticsService) {}

  @Get()
  @RequirePermission("scm.logistics.read")
  list(@Paginate(QueryCarrierDto) query: QueryCarrierDto) {
    return this.svc.listCarriers(query);
  }

  @Get("options")
  @RequirePermission("scm.logistics.read")
  options() {
    return this.svc.carrierOptions();
  }

  @Get(":id")
  @RequirePermission("scm.logistics.read")
  get(@Param("id", ParseIntPipe) id: number) {
    return this.svc.getCarrier(id);
  }

  @Post()
  @RequirePermission("scm.logistics.write")
  create(@Body() dto: CreateCarrierDto) {
    return this.svc.createCarrier(dto);
  }

  @Patch(":id")
  @RequirePermission("scm.logistics.write")
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateCarrierDto) {
    return this.svc.updateCarrier(id, dto);
  }
}

/** Legacy `ScmShipments`, `ScmDeliveries`, `ScmShipmentDetail`, `ScmTracking`. */
@ApiTags("scm-shipments")
@Controller("scm/shipments")
export class ShipmentsController {
  constructor(private readonly svc: LogisticsService) {}

  @Get()
  @RequirePermission("scm.logistics.read")
  list(@Paginate(QueryShipmentDto) query: QueryShipmentDto) {
    return this.svc.listShipments(query);
  }

  @Get("shippable")
  @RequirePermission("scm.logistics.read")
  shippable() {
    return this.svc.shippable();
  }

  @Get("tracking-events")
  @RequirePermission("scm.logistics.read")
  events(@Paginate(PaginationDto) query: PaginationDto) {
    return this.svc.listEvents(query);
  }

  @Get(":id")
  @RequirePermission("scm.logistics.read")
  get(@Param("id", ParseIntPipe) id: number) {
    return this.svc.getShipment(id);
  }

  @Post()
  @RequirePermission("scm.logistics.write")
  create(@Body() dto: CreateShipmentDto) {
    return this.svc.createShipment(dto);
  }

  @Post(":id/carrier")
  @RequirePermission("scm.logistics.write")
  assignCarrier(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: AssignCarrierDto,
  ) {
    return this.svc.assignCarrier(id, dto);
  }

  @Post(":id/label")
  @RequirePermission("scm.logistics.write")
  label(@Param("id", ParseIntPipe) id: number, @Body() dto: ShipmentLabelDto) {
    return this.svc.createLabel(id, dto.trackingNumber);
  }

  @Post(":id/dispatch")
  @RequirePermission("scm.logistics.write")
  dispatch(@Param("id", ParseIntPipe) id: number) {
    return this.svc.dispatch(id);
  }

  @Post(":id/status")
  @RequirePermission("scm.logistics.write")
  status(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ShipmentStatusUpdateDto,
  ) {
    return this.svc.updateStatus(id, dto);
  }

  @Post(":id/deliver")
  @RequirePermission("scm.logistics.write")
  deliver(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: DeliverShipmentDto,
  ) {
    return this.svc.deliver(id, dto);
  }

  @Post(":id/exception")
  @RequirePermission("scm.logistics.write")
  exception(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: RecordExceptionDto,
  ) {
    return this.svc.recordException(id, dto);
  }

  @Post(":id/exceptions/:exceptionId/resolve")
  @RequirePermission("scm.logistics.write")
  resolve(
    @Param("id", ParseIntPipe) id: number,
    @Param("exceptionId", ParseIntPipe) exceptionId: number,
    @Body() dto: ResolveExceptionDto,
  ) {
    return this.svc.resolveException(id, exceptionId, dto.resolution);
  }

  @Post(":id/fail")
  @RequirePermission("scm.logistics.write")
  fail(@Param("id", ParseIntPipe) id: number, @Body() dto: ReasonDto) {
    return this.svc.failDelivery(id, dto.reason);
  }

  @Post(":id/cancel")
  @RequirePermission("scm.logistics.write")
  cancel(@Param("id", ParseIntPipe) id: number, @Body() dto: ReasonDto) {
    return this.svc.cancel(id, dto.reason);
  }
}
