import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { IsInt, IsNumber, Min } from "class-validator";
import { Paginate } from "../../../common/decorators/paginate.decorator.js";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator.js";
import {
  CreateMovementDto,
  CreatePutawayDto,
  QueryActivityDto,
  QueryLocationStockDto,
  QueryMovementDto,
  QueryPutawayDto,
  ReasonDto,
  RecordPutawayItemDto,
} from "./dto/warehouse-ops.dto.js";
import { WarehouseOpsService } from "./warehouse-ops.service.js";

class AddPutawayLineDto {
  @IsInt()
  @Min(1)
  productId!: number;

  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity!: number;
}

/** Legacy `ScmWarehouseDashboard` / `ScmWarehouseActivity` / `ScmWarehouseStock`. */
@ApiTags("scm-warehouse-ops")
@Controller("scm/warehouse")
export class WarehouseOpsController {
  constructor(private readonly svc: WarehouseOpsService) {}

  @Get("dashboard")
  @RequirePermission("scm.warehouse.read")
  dashboard() {
    return this.svc.dashboard();
  }

  @Get("activity")
  @RequirePermission("scm.warehouse.read")
  activity(@Paginate(QueryActivityDto) query: QueryActivityDto) {
    return this.svc.listActivity(query);
  }

  @Get("location-stock")
  @RequirePermission("scm.warehouse.read")
  locationStock(@Paginate(QueryLocationStockDto) query: QueryLocationStockDto) {
    return this.svc.listLocationStock(query);
  }
}

/** Legacy `ScmPutaway`. */
@ApiTags("scm-warehouse-ops")
@Controller("scm/warehouse/putaway")
export class PutawayController {
  constructor(private readonly svc: WarehouseOpsService) {}

  @Get()
  @RequirePermission("scm.warehouse.read")
  list(@Paginate(QueryPutawayDto) query: QueryPutawayDto) {
    return this.svc.listPutaways(query);
  }

  @Get("sources")
  @RequirePermission("scm.warehouse.read")
  sources() {
    return this.svc.putawaySources();
  }

  @Get(":id")
  @RequirePermission("scm.warehouse.read")
  get(@Param("id", ParseIntPipe) id: number) {
    return this.svc.getPutaway(id);
  }

  @Post()
  @RequirePermission("scm.warehouse.write")
  create(@Body() dto: CreatePutawayDto) {
    return this.svc.createPutaway(dto);
  }

  @Post(":id/lines")
  @RequirePermission("scm.warehouse.write")
  addLine(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: AddPutawayLineDto,
  ) {
    return this.svc.addPutawayLine(id, dto);
  }

  @Post(":id/start")
  @RequirePermission("scm.warehouse.write")
  start(@Param("id", ParseIntPipe) id: number) {
    return this.svc.startPutaway(id);
  }

  @Post(":id/items/:itemId")
  @RequirePermission("scm.warehouse.write")
  recordItem(
    @Param("id", ParseIntPipe) id: number,
    @Param("itemId", ParseIntPipe) itemId: number,
    @Body() dto: RecordPutawayItemDto,
  ) {
    return this.svc.recordPutawayItem(id, itemId, dto);
  }

  @Post(":id/cancel")
  @RequirePermission("scm.warehouse.write")
  cancel(@Param("id", ParseIntPipe) id: number, @Body() dto: ReasonDto) {
    return this.svc.cancelPutaway(id, dto.reason);
  }
}

/** Legacy `ScmWarehouseMovements`. */
@ApiTags("scm-warehouse-ops")
@Controller("scm/warehouse/movements")
export class MovementsController {
  constructor(private readonly svc: WarehouseOpsService) {}

  @Get()
  @RequirePermission("scm.warehouse.read")
  list(@Paginate(QueryMovementDto) query: QueryMovementDto) {
    return this.svc.listMovements(query);
  }

  @Get(":id")
  @RequirePermission("scm.warehouse.read")
  get(@Param("id", ParseIntPipe) id: number) {
    return this.svc.getMovement(id);
  }

  @Post()
  @RequirePermission("scm.warehouse.write")
  create(@Body() dto: CreateMovementDto) {
    return this.svc.createMovement(dto);
  }

  @Post(":id/submit")
  @RequirePermission("scm.warehouse.write")
  submit(@Param("id", ParseIntPipe) id: number) {
    return this.svc.submitMovement(id);
  }

  @Post(":id/approve")
  @RequirePermission("scm.warehouse.write")
  approve(@Param("id", ParseIntPipe) id: number) {
    return this.svc.approveMovement(id);
  }

  @Post(":id/complete")
  @RequirePermission("scm.warehouse.write")
  complete(@Param("id", ParseIntPipe) id: number) {
    return this.svc.completeMovement(id);
  }

  @Post(":id/cancel")
  @RequirePermission("scm.warehouse.write")
  cancel(@Param("id", ParseIntPipe) id: number, @Body() dto: ReasonDto) {
    return this.svc.cancelMovement(id, dto.reason);
  }
}
