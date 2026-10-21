import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import type { UpdateUserPreferencesDto } from "./dto/update-user-preferences.dto.js";

@Injectable()
export class PreferencesRepository {
  constructor(private readonly prisma: PrismaService) {}

  @OrgScoped()
  async findByUserId(scope: OrgScope, userId: number) {
    return this.prisma.userPreference.findFirst({
      where: {
        organizationId: scope.organizationId,
        userId,
      },
    });
  }

  @OrgScoped()
  async upsert(scope: OrgScope, userId: number, dto: UpdateUserPreferencesDto) {
    const { customFields, ...rest } = dto;
    const dataUpdate: Prisma.UserPreferenceUpdateInput = {
      ...rest,
      ...(customFields !== undefined
        ? { customFields: customFields as Prisma.InputJsonValue }
        : {}),
    };

    const dataCreate: Prisma.UserPreferenceCreateInput = {
      user: { connect: { id: userId } },
      organization: { connect: { id: scope.organizationId } },
      ...rest,
      customFields: (customFields ?? {}) as Prisma.InputJsonValue,
    };

    return this.prisma.userPreference.upsert({
      where: { userId },
      update: dataUpdate,
      create: dataCreate,
    });
  }

  @OrgScoped()
  async deleteByUserId(scope: OrgScope, userId: number) {
    const existing = await this.findByUserId(scope, userId);
    if (!existing) {
      return null;
    }
    return this.prisma.userPreference.delete({
      where: { userId },
    });
  }
}
