import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Paginate } from "../../../common/decorators/paginate.decorator.js";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator.js";
import {
  CreateLocationDto,
  CreateWarehouseDto,
  QueryLocationDto,
  QueryWarehouseDto,
  UpdateLocationDto,
  UpdateWarehouseDto,
} from "./dto/warehouse.dto.js";
import { WarehousesService } from "./warehouses.service.js";

@ApiTags("scm-warehouses")
@Controller("scm/warehouses")
export class WarehousesController {
  constructor(private readonly warehouses: WarehousesService) {}

  @Get()
  @RequirePermission("scm.warehouse.read")
  findAll(@Paginate(QueryWarehouseDto) query: QueryWarehouseDto) {
    return this.warehouses.findAll(query);
  }

  @Get("options")
  @RequirePermission("scm.warehouse.read")
  @ApiOperation({ summary: "All warehouses (pickers)" })
  options() {
    return this.warehouses.findOptions();
  }

  @Get(":id")
  @RequirePermission("scm.warehouse.read")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.warehouses.findOne(id);
  }

  @Post()
  @RequirePermission("scm.warehouse.write")
  create(@Body() dto: CreateWarehouseDto) {
    return this.warehouses.create(dto);
  }

  @Patch(":id")
  @RequirePermission("scm.warehouse.write")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateWarehouseDto,
  ) {
    return this.warehouses.update(id, dto);
  }
}

@ApiTags("scm-warehouse-locations")
@Controller("scm/warehouse-locations")
export class WarehouseLocationsController {
  constructor(private readonly warehouses: WarehousesService) {}

  @Get()
  @RequirePermission("scm.warehouse.read")
  findAll(@Paginate(QueryLocationDto) query: QueryLocationDto) {
    return this.warehouses.findLocations(query);
  }

  @Get("options")
  @RequirePermission("scm.warehouse.read")
  options(@Query("warehouseId") warehouseId?: string) {
    return this.warehouses.findLocationOptions(
      warehouseId && /^\d+$/.test(warehouseId)
        ? Number(warehouseId)
        : undefined,
    );
  }

  @Get(":id")
  @RequirePermission("scm.warehouse.read")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.warehouses.findLocation(id);
  }

  @Post()
  @RequirePermission("scm.warehouse.write")
  create(@Body() dto: CreateLocationDto) {
    return this.warehouses.createLocation(dto);
  }

  @Patch(":id")
  @RequirePermission("scm.warehouse.write")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateLocationDto,
  ) {
    return this.warehouses.updateLocation(id, dto);
  }
}
