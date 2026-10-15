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
import { Paginate } from "../../../common/decorators/paginate.decorator.js";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator.js";
import { CrmColdCallingService } from "./cold-calling.service.js";
import {
  CreateCrmColdCallingEntryDto,
  LinkCrmColdCallingEntryDto,
  QueryCrmColdCallingEntryDto,
  RecordCrmColdCallingDispositionDto,
  UpdateCrmColdCallingEntryDto,
} from "./dto/cold-calling.dto.js";

@ApiTags("crm-cold-calling")
@Controller("crm/cold-calling-entries")
export class CrmColdCallingController {
  constructor(private readonly coldCalling: CrmColdCallingService) {}

  @Get()
  @RequirePermission("crm.coldcalling.read")
  findAll(
    @Paginate(QueryCrmColdCallingEntryDto) query: QueryCrmColdCallingEntryDto,
  ) {
    return this.coldCalling.findAll(query);
  }

  @Get(":id")
  @RequirePermission("crm.coldcalling.read")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.coldCalling.findOne(id);
  }

  @Post()
  @RequirePermission("crm.coldcalling.write")
  create(@Body() dto: CreateCrmColdCallingEntryDto) {
    return this.coldCalling.create(dto);
  }

  @Patch(":id")
  @RequirePermission("crm.coldcalling.write")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateCrmColdCallingEntryDto,
  ) {
    return this.coldCalling.update(id, dto);
  }

  @Post(":id/link-account")
  @RequirePermission("crm.coldcalling.write")
  linkAccount(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: LinkCrmColdCallingEntryDto,
  ) {
    return this.coldCalling.linkAccount(id, dto);
  }

  @Post(":id/disposition")
  @RequirePermission("crm.coldcalling.write")
  recordDisposition(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: RecordCrmColdCallingDispositionDto,
  ) {
    return this.coldCalling.recordDisposition(id, dto);
  }

  @Delete(":id")
  @RequirePermission("crm.coldcalling.delete")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.coldCalling.remove(id);
  }
}
