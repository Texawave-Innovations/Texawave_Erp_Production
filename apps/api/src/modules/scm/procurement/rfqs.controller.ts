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
import { CreateRfqDto, QueryRfqDto } from "./dto/procurement.dto.js";
import { RfqsService } from "./rfqs.service.js";

/** Legacy `ScmRfqs`. */
@ApiTags("scm-rfqs")
@Controller("scm/procurement/rfqs")
export class RfqsController {
  constructor(private readonly rfqs: RfqsService) {}

  @Get()
  @RequirePermission("scm.procurement.read")
  findAll(@Paginate(QueryRfqDto) query: QueryRfqDto) {
    return this.rfqs.findAll(query);
  }

  @Get("with-quotations")
  @RequirePermission("scm.procurement.read")
  withQuotations() {
    return this.rfqs.findWithQuotations();
  }

  @Get(":id")
  @RequirePermission("scm.procurement.read")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.rfqs.findOne(id);
  }

  @Post()
  @RequirePermission("scm.procurement.write")
  create(@Body() dto: CreateRfqDto) {
    return this.rfqs.create(dto);
  }

  @Post(":id/issue")
  @RequirePermission("scm.procurement.write")
  issue(@Param("id", ParseIntPipe) id: number) {
    return this.rfqs.issue(id);
  }

  @Post(":id/close")
  @RequirePermission("scm.procurement.write")
  close(@Param("id", ParseIntPipe) id: number) {
    return this.rfqs.close(id);
  }

  @Post(":id/cancel")
  @RequirePermission("scm.procurement.write")
  cancel(@Param("id", ParseIntPipe) id: number) {
    return this.rfqs.cancel(id);
  }

  @Delete(":id")
  @HttpCode(204)
  @RequirePermission("scm.procurement.write")
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.rfqs.remove(id);
  }
}
