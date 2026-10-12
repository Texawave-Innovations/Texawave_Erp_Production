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
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Paginate } from "../../../common/decorators/paginate.decorator.js";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator.js";
import { ProductsService } from "./products.service.js";
import {
  CreateProductDto,
  QueryProductDto,
  UpdateProductDto,
} from "./dto/product.dto.js";

/** Migrated from the LIVE legacy TexaWave_ERP/src/modules/crm/Products.tsx
 * + domain/productsService.ts (RTDB `crm/products`). Delete is
 * soft-delete, gated behind the write permission — see the catalog.ts
 * note on crm.product.write (legacy gates Create/Update behind
 * "CRM Admin / Sales Head" and Delete behind "CRM Admin only"; this app
 * collapses both into the single `.write` tier, same stand-in already
 * used for crm.pipeline_stage.write). */
@ApiTags("crm-products")
@Controller("crm/products")
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @RequirePermission("crm.product.read")
  @ApiOperation({
    summary: "List products (search across name/code/category/vendor)",
  })
  findAll(@Paginate(QueryProductDto) query: QueryProductDto) {
    return this.products.findAll(query);
  }

  @Get(":id")
  @RequirePermission("crm.product.read")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.products.findOne(id);
  }

  @Post()
  @RequirePermission("crm.product.write")
  @ApiOperation({ summary: "Create a product" })
  create(@Body() dto: CreateProductDto) {
    return this.products.create(dto);
  }

  @Patch(":id")
  @RequirePermission("crm.product.write")
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateProductDto) {
    return this.products.update(id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission("crm.product.write")
  @ApiOperation({
    summary:
      "Soft-delete a product (refused while any deal line item still references it)",
  })
  async remove(@Param("id", ParseIntPipe) id: number) {
    await this.products.remove(id);
  }
}
