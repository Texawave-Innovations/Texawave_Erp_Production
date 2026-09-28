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
import { Paginate } from "../../common/decorators/paginate.decorator.js";
import { RequirePermission } from "../../common/decorators/require-permission.decorator.js";
import { AssignUserRolesDto } from "./dto/assign-user-roles.dto.js";
import { AssignUserTeamsDto } from "./dto/assign-user-teams.dto.js";
import { CreateUserDto } from "./dto/create-user.dto.js";
import { QueryUserDto } from "./dto/query-user.dto.js";
import { UpdateUserDto } from "./dto/update-user.dto.js";
import { UsersService } from "./users.service.js";

@ApiTags("users")
@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermission("users.user.read")
  @ApiOperation({ summary: "List users for the current organization" })
  findAll(@Paginate(QueryUserDto) pagination: QueryUserDto) {
    return this.users.findAll(pagination);
  }

  @Get(":id")
  @RequirePermission("users.user.read")
  @ApiOperation({ summary: "User detail with assigned roles and teams" })
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.users.findOne(id);
  }

  @Post()
  @RequirePermission("users.user.write")
  @ApiOperation({ summary: "Create a new user in current organization" })
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @Patch(":id")
  @RequirePermission("users.user.write")
  @ApiOperation({ summary: "Update user profile or isActive status" })
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateUserDto) {
    return this.users.update(id, dto);
  }

  @Delete(":id")
  @RequirePermission("users.user.write")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Soft delete a user" })
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.users.remove(id);
  }

  @Post(":id/roles")
  @RequirePermission("users.user.write")
  @ApiOperation({ summary: "Assign roles to user (org-scoped)" })
  assignRoles(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: AssignUserRolesDto,
  ) {
    return this.users.assignRoles(id, dto);
  }

  @Post(":id/teams")
  @RequirePermission("users.user.write")
  @ApiOperation({ summary: "Assign teams to user (org-scoped)" })
  assignTeams(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: AssignUserTeamsDto,
  ) {
    return this.users.assignTeams(id, dto);
  }
}
