import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Paginate } from "../../../common/decorators/paginate.decorator.js";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator.js";
import { CreateRoleDto } from "./dto/create-role.dto.js";
import { QueryRoleDto } from "./dto/query-role.dto.js";
import { SetRolePermissionsDto } from "./dto/set-role-permissions.dto.js";
import { UpdateRoleDto } from "./dto/update-role.dto.js";
import { RolesService } from "./roles.service.js";

/**
 * Role → permission assignment, replacing what used to be seed.ts-only
 * (Docs/ARCHITECTURE.md §11, 2026-09-22 changelog entry). Permission
 * strings (`settings.role.read`/`settings.role.write`) gate this screen
 * itself, same pattern as `reference.tags.*`
 * (apps/api/src/modules/_reference/tags/).
 */
@ApiTags("settings-roles")
@Controller("settings")
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get("roles")
  @RequirePermission("settings.role.read")
  @ApiOperation({ summary: "List roles for the current organization" })
  findAll(@Paginate(QueryRoleDto) pagination: QueryRoleDto) {
    return this.roles.findAll(pagination);
  }

  @Get("roles/:id")
  @RequirePermission("settings.role.read")
  @ApiOperation({ summary: "Role detail, including its granted permissions" })
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.roles.findOne(id);
  }

  @Get("permissions")
  @RequirePermission("settings.role.read")
  @ApiOperation({ summary: "The full permission catalog" })
  listPermissionCatalog() {
    return this.roles.listPermissionCatalog();
  }

  @Post("roles")
  @RequirePermission("settings.role.write")
  create(@Body() dto: CreateRoleDto) {
    return this.roles.create(dto);
  }

  @Patch("roles/:id")
  @RequirePermission("settings.role.write")
  @ApiOperation({ summary: "Rename a role or toggle isActive" })
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateRoleDto) {
    return this.roles.update(id, dto);
  }

  @Put("roles/:id/permissions")
  @RequirePermission("settings.role.write")
  @ApiOperation({ summary: "Replace a role's granted permission set" })
  setPermissions(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: SetRolePermissionsDto,
  ) {
    return this.roles.setPermissions(id, dto);
  }
}
