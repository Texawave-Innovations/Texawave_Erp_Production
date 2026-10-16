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
import { CompanySealsService } from "./company-seals.service.js";
import { CreateSealSignatureDto } from "./dto/create-seal-signature.dto.js";
import { QueryPaginationDto } from "./dto/query-pagination.dto.js";
import { UpdateSealSignatureDto } from "./dto/update-seal-signature.dto.js";

/** Company Seal masterlist (Seals & Signatures tab). */
@ApiTags("sales-settings-company-seals")
@Controller("sales-settings/company-seals")
export class CompanySealsController {
  constructor(private readonly seals: CompanySealsService) {}

  @Get()
  @RequirePermission("sales_settings.seal_signature.read")
  findAll(@Paginate(QueryPaginationDto) query: QueryPaginationDto) {
    return this.seals.findAll(query);
  }

  @Get(":id")
  @RequirePermission("sales_settings.seal_signature.read")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.seals.findOne(id);
  }

  @Post()
  @RequirePermission("sales_settings.seal_signature.write")
  create(@Body() dto: CreateSealSignatureDto) {
    return this.seals.create(dto);
  }

  @Patch(":id")
  @RequirePermission("sales_settings.seal_signature.write")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateSealSignatureDto,
  ) {
    return this.seals.update(id, dto);
  }

  @Delete(":id")
  @RequirePermission("sales_settings.seal_signature.write")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.seals.remove(id);
  }
}
