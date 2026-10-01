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
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { Paginate } from "../../common/decorators/paginate.decorator.js";
import { RequirePermission } from "../../common/decorators/require-permission.decorator.js";
import type { AuthenticatedUser } from "../../platform/auth/authenticated-user.js";
import { CreateMenuItemDto } from "./dto/create-menu-item.dto.js";
import { QueryMenuItemDto } from "./dto/query-menu-item.dto.js";
import { UpdateMenuItemDto } from "./dto/update-menu-item.dto.js";
import { MenuService } from "./menu.service.js";

@ApiTags("menu")
@Controller("menu")
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Get("my-menu")
  @ApiOperation({
    summary:
      "Get navigation menu tree filtered by user's resolved permissions server-side",
  })
  getMyMenu(@CurrentUser() user: AuthenticatedUser) {
    return this.menuService.getMyMenu(user.userId);
  }

  @Get("items")
  @RequirePermission("menu.item.read")
  @ApiOperation({ summary: "List all menu items for current organization" })
  findAll(@Paginate(QueryMenuItemDto) pagination: QueryMenuItemDto) {
    return this.menuService.findAll(pagination);
  }

  @Get("items/:id")
  @RequirePermission("menu.item.read")
  @ApiOperation({ summary: "Get menu item by ID" })
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.menuService.findOne(id);
  }

  @Post("items")
  @RequirePermission("menu.item.write")
  @ApiOperation({ summary: "Create a new navigation menu item" })
  create(@Body() dto: CreateMenuItemDto) {
    return this.menuService.create(dto);
  }

  @Patch("items/:id")
  @RequirePermission("menu.item.write")
  @ApiOperation({ summary: "Update an existing navigation menu item" })
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateMenuItemDto,
  ) {
    return this.menuService.update(id, dto);
  }

  @Delete("items/:id")
  @RequirePermission("menu.item.write")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Soft delete a navigation menu item" })
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.menuService.remove(id);
  }
}
