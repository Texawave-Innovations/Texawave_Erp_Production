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
  CompleteReturnInspectionDto,
  CreateCustomerReturnDto,
  CreateVendorReturnDto,
  DispositionDto,
  OptionalReasonDto,
  QueryReturnDto,
  ReceiveReturnDto,
  ReturnReasonDto,
  ReturnShipmentDto,
  ShipVendorReturnDto,
} from "./dto/returns.dto.js";
import { ReturnsService } from "./returns.service.js";

/** Legacy `ScmReturns*` pages: customer and vendor returns share one entity. */
@ApiTags("scm-returns")
@Controller("scm/returns")
export class ReturnsController {
  constructor(private readonly svc: ReturnsService) {}

  @Get()
  @RequirePermission("scm.returns.read")
  list(@Paginate(QueryReturnDto) query: QueryReturnDto) {
    return this.svc.list(query);
  }

  @Get("dashboard")
  @RequirePermission("scm.returns.read")
  dashboard() {
    return this.svc.dashboard();
  }

  @Get("customer-sources")
  @RequirePermission("scm.returns.read")
  customerSources() {
    return this.svc.customerSources();
  }

  @Get("vendor-sources")
  @RequirePermission("scm.returns.read")
  vendorSources() {
    return this.svc.vendorSources();
  }

  @Get(":id")
  @RequirePermission("scm.returns.read")
  get(@Param("id", ParseIntPipe) id: number) {
    return this.svc.get(id);
  }

  @Post("customer")
  @RequirePermission("scm.returns.write")
  createCustomer(@Body() dto: CreateCustomerReturnDto) {
    return this.svc.createCustomer(dto);
  }

  @Post("vendor")
  @RequirePermission("scm.returns.write")
  createVendor(@Body() dto: CreateVendorReturnDto) {
    return this.svc.createVendor(dto);
  }

  @Post(":id/submit")
  @RequirePermission("scm.returns.write")
  submit(@Param("id", ParseIntPipe) id: number) {
    return this.svc.submit(id);
  }

  @Post(":id/approve")
  @RequirePermission("scm.returns.approve")
  approve(@Param("id", ParseIntPipe) id: number) {
    return this.svc.approve(id);
  }

  @Post(":id/reject")
  @RequirePermission("scm.returns.approve")
  reject(@Param("id", ParseIntPipe) id: number, @Body() dto: ReturnReasonDto) {
    return this.svc.reject(id, dto.reason);
  }

  @Post(":id/cancel")
  @RequirePermission("scm.returns.write")
  cancel(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: OptionalReasonDto,
  ) {
    return this.svc.cancel(id, dto.reason);
  }

  @Post(":id/in-transit")
  @RequirePermission("scm.returns.write")
  inTransit(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ReturnShipmentDto,
  ) {
    return this.svc.markInTransit(id, dto);
  }

  @Post(":id/receive")
  @RequirePermission("scm.returns.write")
  receive(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ReceiveReturnDto,
  ) {
    return this.svc.receive(id, dto);
  }

  @Post(":id/start-inspection")
  @RequirePermission("scm.returns.write")
  startInspection(@Param("id", ParseIntPipe) id: number) {
    return this.svc.startInspection(id);
  }

  @Post(":id/inspect")
  @RequirePermission("scm.returns.write")
  inspect(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: CompleteReturnInspectionDto,
  ) {
    return this.svc.completeInspection(id, dto);
  }

  @Post(":id/to-disposition")
  @RequirePermission("scm.returns.write")
  toDisposition(@Param("id", ParseIntPipe) id: number) {
    return this.svc.moveToDisposition(id);
  }

  @Post(":id/disposition")
  @RequirePermission("scm.returns.approve")
  disposition(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: DispositionDto,
  ) {
    return this.svc.disposition(id, dto);
  }

  @Post(":id/ready-to-ship")
  @RequirePermission("scm.returns.write")
  readyToShip(@Param("id", ParseIntPipe) id: number) {
    return this.svc.markReadyToShip(id);
  }

  @Post(":id/ship")
  @RequirePermission("scm.returns.approve")
  ship(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ShipVendorReturnDto,
  ) {
    return this.svc.shipVendor(id, dto);
  }

  @Post(":id/vendor-received")
  @RequirePermission("scm.returns.write")
  vendorReceived(@Param("id", ParseIntPipe) id: number) {
    return this.svc.markVendorReceived(id);
  }

  @Post(":id/complete")
  @RequirePermission("scm.returns.write")
  complete(@Param("id", ParseIntPipe) id: number) {
    return this.svc.complete(id);
  }

  @Delete(":id")
  @HttpCode(204)
  @RequirePermission("scm.returns.write")
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.svc.remove(id);
  }
}
