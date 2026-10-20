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
import {
  CreateScmProductDto,
  QueryScmProductDto,
  UpdateScmProductDto,
} from "./dto/product.dto.js";
import { ScmProductsService } from "./products.service.js";

@ApiTags("scm-products")
@Controller("scm/products")
export class ScmProductsController {
  constructor(private readonly products: ScmProductsService) {}

  @Get()
  @RequirePermission("scm.product.read")
  @ApiOperation({ summary: "List SCM products" })
  findAll(@Paginate(QueryScmProductDto) query: QueryScmProductDto) {
    return this.products.findAll(query);
  }

  @Get("options")
  @RequirePermission("scm.product.read")
  @ApiOperation({ summary: "All active products (pickers)" })
  options() {
    return this.products.findOptions();
  }

  @Get(":id")
  @RequirePermission("scm.product.read")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.products.findOne(id);
  }

  @Post()
  @RequirePermission("scm.product.write")
  create(@Body() dto: CreateScmProductDto) {
    return this.products.create(dto);
  }

  @Patch(":id")
  @RequirePermission("scm.product.write")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateScmProductDto,
  ) {
    return this.products.update(id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission("scm.product.write")
  @ApiOperation({ summary: "Soft-delete (refused once stock history exists)" })
  async remove(@Param("id", ParseIntPipe) id: number) {
    await this.products.remove(id);
  }
}
