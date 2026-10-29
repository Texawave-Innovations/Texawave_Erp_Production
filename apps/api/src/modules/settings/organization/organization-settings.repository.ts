import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import type { UpdateOrganizationSettingsDto } from "./dto/update-organization-settings.dto.js";

export const DEFAULT_ORG_SETTINGS = {
  theme: "system",
  density: "comfortable",
  country: "IN",
  locale: "en-IN",
  timezone: "Asia/Kolkata",
  dateFormat: "DD/MM/YYYY",
  timeFormat: "12h",
  baseCurrency: "INR",
  currencySymbolPosition: "before",
  numberFormat: "indian",
  fiscalYearStartMonth: 4,
};

@Injectable()
export class OrganizationSettingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  @OrgScoped()
  async findByOrg(scope: OrgScope, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma;
    return client.organizationSetting.findUnique({
      where: { organizationId: scope.organizationId },
    });
  }

  @OrgScoped()
  async findOrCreateDefault(
    scope: OrgScope,
    createdBy?: number,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.prisma;
    const existing = await client.organizationSetting.findUnique({
      where: { organizationId: scope.organizationId },
    });

    if (existing) {
      return existing;
    }

    return client.organizationSetting.create({
      data: {
        organizationId: scope.organizationId,
        ...DEFAULT_ORG_SETTINGS,
        customFields: {} as Prisma.InputJsonValue,
        createdBy: createdBy ?? null,
        updatedBy: createdBy ?? null,
      },
    });
  }

  @OrgScoped()
  async update(
    scope: OrgScope,
    dto: UpdateOrganizationSettingsDto,
    updatedBy: number,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.prisma;
    const { customFields, displayCurrency, ...rest } = dto;
    const existing = await client.organizationSetting.findUnique({
      where: { organizationId: scope.organizationId },
    });
    const currentCustomFields = (existing?.customFields ?? {}) as Record<
      string,
      unknown
    >;
    const mergedCustomFields = {
      ...currentCustomFields,
      ...(typeof customFields === "object" && customFields !== null
        ? customFields
        : {}),
      ...(displayCurrency ? { displayCurrency } : {}),
    };

    return client.organizationSetting.upsert({
      where: { organizationId: scope.organizationId },
      create: {
        organizationId: scope.organizationId,
        ...DEFAULT_ORG_SETTINGS,
        ...rest,
        customFields: mergedCustomFields as Prisma.InputJsonValue,
        createdBy: updatedBy,
        updatedBy,
      },
      update: {
        ...rest,
        customFields: mergedCustomFields as Prisma.InputJsonValue,
        updatedBy,
      },
    });
  }
}
