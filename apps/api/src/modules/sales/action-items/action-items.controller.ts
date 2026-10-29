import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Paginate } from "../../../common/decorators/paginate.decorator.js";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator.js";
import { ActionItemsService } from "./action-items.service.js";
import {
  CreateActionItemDto,
  QueryActionItemDto,
} from "./dto/action-item.dto.js";

const READ = "sales.action_item.read";
const WRITE = "sales.action_item.write";

@ApiTags("sales-action-items")
@Controller("sales/action-items")
export class ActionItemsController {
  constructor(private readonly items: ActionItemsService) {}

  @Get()
  @RequirePermission(READ)
  @ApiOperation({ summary: "Sales checklist (default: open items)" })
  findAll(@Paginate(QueryActionItemDto) query: QueryActionItemDto) {
    return this.items.findAll(query);
  }

  @Post()
  @RequirePermission(WRITE)
  create(@Body() dto: CreateActionItemDto) {
    return this.items.create(dto);
  }

  @Post(":id/complete")
  @RequirePermission(WRITE)
  @HttpCode(HttpStatus.OK)
  complete(@Param("id", ParseIntPipe) id: number) {
    return this.items.setDone(id, true);
  }

  @Post(":id/reopen")
  @RequirePermission(WRITE)
  @HttpCode(HttpStatus.OK)
  reopen(@Param("id", ParseIntPipe) id: number) {
    return this.items.setDone(id, false);
  }

  @Delete(":id")
  @RequirePermission(WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.items.remove(id);
  }
}
