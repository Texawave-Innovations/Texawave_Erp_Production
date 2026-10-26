import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../common/decorators/org-scoped.decorator.js";
import type { PaginationDto } from "../../common/dto/pagination.dto.js";
import type { OrgScope } from "../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../common/tenancy/tenant-where.js";
import { PrismaService } from "../../shared/prisma/prisma.service.js";
import type { SealSignatureKind } from "./sales-settings.constants.js";
import type { CreateSealSignatureDto } from "./dto/create-seal-signature.dto.js";
import type { UpdateSealSignatureDto } from "./dto/update-seal-signature.dto.js";

/** Backs both the Company Seal masterlist and the Authorized Signature
 * masterlist — `kind` is always supplied by the caller (a controller), never
 * accepted from the request body. The only place `PrismaService` is called
 * for this resource. */
@Injectable()
export class SealSignaturesRepository {
  constructor(private readonly prisma: PrismaService) {}

  @OrgScoped()
  async findMany(
    scope: OrgScope,
    kind: SealSignatureKind,
    pagination: PaginationDto,
  ) {
    const where = tenantWhere<Prisma.SealSignatureWhereInput>(scope, {
      kind,
      deletedAt: null,
    });
    const [items, total] = await Promise.all([
      this.prisma.sealSignature.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: pagination.order ?? "desc" },
      }),
      this.prisma.sealSignature.count({ where }),
    ]);
    return { items, total };
  }

  @OrgScoped()
  findOne(scope: OrgScope, kind: SealSignatureKind, id: number) {
    return this.prisma.sealSignature.findFirst({
      where: tenantWhere(scope, { id, kind, deletedAt: null }),
    });
  }

  @OrgScoped()
  create(
    scope: OrgScope,
    kind: SealSignatureKind,
    dto: CreateSealSignatureDto,
    createdBy: number,
  ) {
    return this.prisma.sealSignature.create({
      data: {
        ...dto,
        kind,
        customFields: (dto.customFields ?? {}) as Prisma.InputJsonValue,
        organizationId: scope.organizationId,
        createdBy,
        updatedBy: createdBy,
      },
    });
  }

  @OrgScoped()
  async update(
    scope: OrgScope,
    kind: SealSignatureKind,
    id: number,
    dto: UpdateSealSignatureDto,
    updatedBy: number,
  ) {
    const { customFields, ...rest } = dto;
    const result = await this.prisma.sealSignature.updateMany({
      where: tenantWhere(scope, { id, kind, deletedAt: null }),
      data: {
        ...rest,
        ...(customFields !== undefined
          ? { customFields: customFields as Prisma.InputJsonValue }
          : {}),
        updatedBy,
      },
    });
    if (result.count === 0) return null;
    return this.findOne(scope, kind, id);
  }

  @OrgScoped()
  async softDelete(
    scope: OrgScope,
    kind: SealSignatureKind,
    id: number,
    deletedBy: number,
  ) {
    const result = await this.prisma.sealSignature.updateMany({
      where: tenantWhere(scope, { id, kind, deletedAt: null }),
      data: { deletedAt: new Date(), updatedBy: deletedBy },
    });
    return result.count > 0;
  }
}
