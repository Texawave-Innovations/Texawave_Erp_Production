import { BadRequestException, Injectable } from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { PaginatedResponseDto } from "../../common/dto/paginated-response.dto.js";
import type { PaginationDto } from "../../common/dto/pagination.dto.js";
import {
  ResourceConflictException,
  ResourceNotFoundException,
} from "../../common/exceptions/business.exception.js";
import { PermissionsService } from "../roles-permissions/permissions.service.js";
import { TenantContextService } from "../tenancy/tenant-context.service.js";
import type { AssignUserRolesDto } from "./dto/assign-user-roles.dto.js";
import type { AssignUserTeamsDto } from "./dto/assign-user-teams.dto.js";
import type { CreateUserDto } from "./dto/create-user.dto.js";
import type { QueryUserDto } from "./dto/query-user.dto.js";
import type { UpdateUserDto } from "./dto/update-user.dto.js";
import { UsersRepository } from "./users.repository.js";

const BCRYPT_ROUNDS = 10;

@Injectable()
export class UsersService {
  constructor(
    private readonly repository: UsersRepository,
    private readonly tenantContext: TenantContextService,
    private readonly permissions: PermissionsService,
  ) {}

  async findAll(query: QueryUserDto) {
    const scope = this.tenantContext.getOrgScope();
    const pagination: PaginationDto = query;
    const { items, total } = await this.repository.findMany(
      scope,
      { search: query.search },
      pagination,
    );
    return new PaginatedResponseDto(
      items,
      total,
      pagination.page,
      pagination.limit,
    );
  }

  async findOne(id: number) {
    const scope = this.tenantContext.getOrgScope();
    const user = await this.repository.findOneDetail(scope, id);
    if (!user) {
      throw new ResourceNotFoundException("User", id);
    }
    return user;
  }

  async create(dto: CreateUserDto) {
    const scope = this.tenantContext.getOrgScope();
    const callerId = this.tenantContext.getUserId();

    const existing = await this.repository.findByEmail(scope, dto.email);
    if (existing) {
      throw new ResourceConflictException(
        `A user with email "${dto.email}" already exists`,
      );
    }

    if (dto.roleIds && dto.roleIds.length > 0) {
      const orgRoles = await this.repository.findRolesInOrg(scope, dto.roleIds);
      if (orgRoles.length !== dto.roleIds.length) {
        throw new BadRequestException(
          "One or more roles do not exist or belong to another organization",
        );
      }
    }

    if (dto.teamIds && dto.teamIds.length > 0) {
      const orgTeams = await this.repository.findTeamsInOrg(scope, dto.teamIds);
      if (orgTeams.length !== dto.teamIds.length) {
        throw new BadRequestException(
          "One or more teams do not exist or belong to another organization",
        );
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.repository.create(
      scope,
      {
        email: dto.email,
        fullName: dto.fullName,
        passwordHash,
      },
      callerId,
    );

    if (dto.roleIds && dto.roleIds.length > 0) {
      await this.repository.assignRoles(scope, user.id, dto.roleIds, callerId);
    }

    if (dto.teamIds && dto.teamIds.length > 0) {
      await this.repository.assignTeams(
        scope,
        user.id,
        dto.teamIds.map((teamId) => ({ teamId, isLead: false })),
        callerId,
      );
    }

    return this.repository.findOneDetail(scope, user.id);
  }

  async update(id: number, dto: UpdateUserDto) {
    const scope = this.tenantContext.getOrgScope();
    const callerId = this.tenantContext.getUserId();

    if (dto.email) {
      const existing = await this.repository.findByEmail(scope, dto.email);
      if (existing && existing.id !== id) {
        throw new ResourceConflictException(
          `A user with email "${dto.email}" already exists`,
        );
      }
    }

    const updated = await this.repository.update(scope, id, dto, callerId);
    if (!updated) {
      throw new ResourceNotFoundException("User", id);
    }
    return updated;
  }

  async remove(id: number): Promise<void> {
    const scope = this.tenantContext.getOrgScope();
    const callerId = this.tenantContext.getUserId();
    const deleted = await this.repository.softDelete(scope, id, callerId);
    if (!deleted) {
      throw new ResourceNotFoundException("User", id);
    }
    await this.permissions.invalidate(id);
  }

  async assignRoles(id: number, dto: AssignUserRolesDto) {
    const scope = this.tenantContext.getOrgScope();
    const callerId = this.tenantContext.getUserId();

    const user = await this.repository.findById(scope, id);
    if (!user) {
      throw new ResourceNotFoundException("User", id);
    }

    const orgRoles = await this.repository.findRolesInOrg(scope, dto.roleIds);
    if (orgRoles.length !== dto.roleIds.length) {
      throw new BadRequestException(
        "One or more roles do not exist or belong to another organization",
      );
    }

    await this.repository.assignRoles(scope, id, dto.roleIds, callerId);
    await this.permissions.invalidate(id);
    return this.repository.findOneDetail(scope, id);
  }

  async assignTeams(id: number, dto: AssignUserTeamsDto) {
    const scope = this.tenantContext.getOrgScope();
    const callerId = this.tenantContext.getUserId();

    const user = await this.repository.findById(scope, id);
    if (!user) {
      throw new ResourceNotFoundException("User", id);
    }

    const assignments = (
      dto.teams ??
      (dto.teamIds
        ? dto.teamIds.map((teamId) => ({ teamId, isLead: false }))
        : [])
    ).map((a) => ({ teamId: a.teamId, isLead: a.isLead ?? false }));

    if (assignments.length > 0) {
      const teamIds = assignments.map((a) => a.teamId);
      const orgTeams = await this.repository.findTeamsInOrg(scope, teamIds);
      if (orgTeams.length !== teamIds.length) {
        throw new BadRequestException(
          "One or more teams do not exist or belong to another organization",
        );
      }
    }

    await this.repository.assignTeams(scope, id, assignments, callerId);
    return this.repository.findOneDetail(scope, id);
  }
}
