import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Paginate } from "../../../common/decorators/paginate.decorator.js";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator.js";
import {
  CreateSupplierDto,
  QuerySupplierDto,
  UpdateSupplierDto,
} from "./dto/supplier.dto.js";
import { SuppliersService } from "./suppliers.service.js";

/** Migrated from the LEGACY TexaWave_ERP_old/src/modules/scm/suppliers
 * (Docs/SCM_LEGACY_PARITY.md section 3). Legacy has no supplier delete
 * action, so there is no DELETE route. Static routes are declared before
 * `:id` so they are never captured by ParseIntPipe. */
@ApiTags("scm-suppliers")
@Controller("scm/suppliers")
export class SuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

  @Get()
  @RequirePermission("scm.supplier.read")
  @ApiOperation({ summary: "List suppliers (search + status/type filters)" })
  findAll(@Paginate(QuerySupplierDto) query: QuerySupplierDto) {
    return this.suppliers.findAll(query);
  }

  @Get("types")
  @RequirePermission("scm.supplier.read")
  @ApiOperation({ summary: "Distinct supplier types in use (filter options)" })
  types() {
    return this.suppliers.findTypes();
  }

  @Get("next-code")
  @RequirePermission("scm.supplier.write")
  @ApiOperation({ summary: "Preview the next free VEND-NNNN supplier code" })
  nextCode() {
    return this.suppliers.nextCode();
  }

  @Get(":id")
  @RequirePermission("scm.supplier.read")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.suppliers.findOne(id);
  }

  @Get(":id/activity")
  @RequirePermission("scm.supplier.read")
  @ApiOperation({ summary: "Audit-backed activity log for the supplier" })
  activity(@Param("id", ParseIntPipe) id: number) {
    return this.suppliers.findActivity(id);
  }

  @Get(":id/procurement")
  @RequirePermission("scm.supplier.read")
  @ApiOperation({
    summary:
      "Procurement history for the supplier (RFQs, quotations, POs, GRNs, products supplied)",
  })
  procurement(@Param("id", ParseIntPipe) id: number) {
    return this.suppliers.findProcurementSummary(id);
  }

  @Post()
  @RequirePermission("scm.supplier.write")
  create(@Body() dto: CreateSupplierDto) {
    return this.suppliers.create(dto);
  }

  @Patch(":id")
  @RequirePermission("scm.supplier.write")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateSupplierDto,
  ) {
    return this.suppliers.update(id, dto);
  }
}
