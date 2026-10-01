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
import { AttachRolePermissionsDto } from "./dto/attach-role-permissions.dto.js";
import { CreateRoleDto } from "./dto/create-role.dto.js";
import { QueryRoleDto } from "./dto/query-role.dto.js";
import { SetRolePermissionsDto } from "./dto/set-role-permissions.dto.js";
import { UpdateRoleDto } from "./dto/update-role.dto.js";
import { RolesService } from "./roles.service.js";

/**
 * Role → permission assignment. Single canonical path (`/settings/roles`);
 * permission strings (`settings.role.read`/`settings.role.write`) gate these
 * endpoints.
 */
@ApiTags("settings-roles")
@Controller("settings/roles")
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get()
  @RequirePermission("settings.role.read")
  @ApiOperation({ summary: "List roles for the current organization" })
  findAll(@Paginate(QueryRoleDto) pagination: QueryRoleDto) {
    return this.roles.findAll(pagination);
  }

  @Get(":id")
  @RequirePermission("settings.role.read")
  @ApiOperation({ summary: "Role detail, including its granted permissions" })
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.roles.findOne(id);
  }

  @Post()
  @RequirePermission("settings.role.write")
  @ApiOperation({ summary: "Create a new role" })
  create(@Body() dto: CreateRoleDto) {
    return this.roles.create(dto);
  }

  @Patch(":id")
  @RequirePermission("settings.role.write")
  @ApiOperation({ summary: "Rename a role or toggle isActive" })
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateRoleDto) {
    return this.roles.update(id, dto);
  }

  @Post(":id/permissions")
  @RequirePermission("settings.role.write")
  @ApiOperation({
    summary:
      "Attach permissions to a role, returning the updated permission set",
  })
  attachPermissions(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: AttachRolePermissionsDto,
  ) {
    return this.roles.attachPermissions(id, dto);
  }

  @Put(":id/permissions")
  @RequirePermission("settings.role.write")
  @ApiOperation({ summary: "Replace a role's granted permission set" })
  setPermissions(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: SetRolePermissionsDto,
  ) {
    return this.roles.setPermissions(id, dto);
  }
}

@ApiTags("settings-roles")
@Controller("settings/permissions")
export class PermissionsCatalogController {
  constructor(private readonly roles: RolesService) {}

  @Get()
  @RequirePermission("settings.role.read")
  @ApiOperation({ summary: "The full permission catalog" })
  listPermissionCatalog() {
    return this.roles.listPermissionCatalog();
  }
}
