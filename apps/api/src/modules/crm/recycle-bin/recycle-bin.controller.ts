import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Paginate } from "../../../common/decorators/paginate.decorator.js";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator.js";
import {
  PurgeRecycleBinDto,
  QueryRecycleBinDto,
  RECYCLE_BIN_ENTITY_TYPES,
  type RecycleBinEntityType,
} from "./dto/recycle-bin.dto.js";
import { RecycleBinService } from "./recycle-bin.service.js";

function parseType(raw: string): RecycleBinEntityType {
  if (!(RECYCLE_BIN_ENTITY_TYPES as readonly string[]).includes(raw)) {
    throw new BadRequestException(`Unknown recycle bin entity type "${raw}"`);
  }
  return raw as RecycleBinEntityType;
}

@ApiTags("crm-recycle-bin")
@Controller("crm/recycle-bin")
export class RecycleBinController {
  constructor(private readonly recycleBin: RecycleBinService) {}

  @Get()
  @RequirePermission("crm.recyclebin.read")
  findAll(@Paginate(QueryRecycleBinDto) query: QueryRecycleBinDto) {
    return this.recycleBin.findAll(query);
  }

  @Get("summary")
  @RequirePermission("crm.recyclebin.read")
  summary() {
    return this.recycleBin.summary();
  }

  @Post(":entityType/:id/restore")
  @RequirePermission("crm.recyclebin.write")
  @HttpCode(HttpStatus.OK)
  restore(
    @Param("entityType") entityType: string,
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.recycleBin.restore(parseType(entityType), id);
  }

  @Post(":entityType/:id/purge")
  @RequirePermission("crm.recyclebin.write")
  @HttpCode(HttpStatus.OK)
  purge(
    @Param("entityType") entityType: string,
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: PurgeRecycleBinDto,
  ) {
    return this.recycleBin.purge(parseType(entityType), id, dto.confirm);
  }
}
