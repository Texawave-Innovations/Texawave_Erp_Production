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
import { ApiTags } from "@nestjs/swagger";
import { Paginate } from "../../common/decorators/paginate.decorator.js";
import { RequirePermission } from "../../common/decorators/require-permission.decorator.js";
import { CreateSalespersonDto } from "./dto/create-salesperson.dto.js";
import { QuerySalespersonDto } from "./dto/query-salesperson.dto.js";
import { UpdateSalespersonDto } from "./dto/update-salesperson.dto.js";
import { SalespersonsService } from "./salespersons.service.js";

/** Salespersons tab of Sales Settings. */
@ApiTags("sales-settings-salespersons")
@Controller("sales-settings/salespersons")
export class SalespersonsController {
  constructor(private readonly salespersons: SalespersonsService) {}

  @Get()
  @RequirePermission("sales_settings.salesperson.read")
  findAll(@Paginate(QuerySalespersonDto) query: QuerySalespersonDto) {
    return this.salespersons.findAll(query);
  }

  @Get(":id")
  @RequirePermission("sales_settings.salesperson.read")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.salespersons.findOne(id);
  }

  @Post()
  @RequirePermission("sales_settings.salesperson.write")
  create(@Body() dto: CreateSalespersonDto) {
    return this.salespersons.create(dto);
  }

  @Patch(":id")
  @RequirePermission("sales_settings.salesperson.write")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateSalespersonDto,
  ) {
    return this.salespersons.update(id, dto);
  }

  @Delete(":id")
  @RequirePermission("sales_settings.salesperson.write")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.salespersons.remove(id);
  }
}
