import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { AuditWriter } from "../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import type {
  DocumentField,
  MasterDocumentType,
  NormalizedOption,
} from "./document-fields.rules.js";

const ENTITY_TYPE = "sales_document_master_item";

const SELECT = {
  id: true,
  documentType: true,
  field: true,
  label: true,
  value: true,
  bankDetails: true,
  imageStorageKey: true,
  imageMimeType: true,
  isDefault: true,
  sortOrder: true,
  updatedAt: true,
} as const;

type ItemRow = Prisma.SalesDocumentMasterItemGetPayload<{
  select: typeof SELECT;
}>;

/** The API shape — the storage key stays inside the server. */
function toView(row: ItemRow) {
  const { imageStorageKey, imageMimeType: _m, ...rest } = row;
  return { ...rest, hasImage: imageStorageKey !== null };
}

export type DocumentFieldView = ReturnType<typeof toView>;

function snapshot(row: ItemRow) {
  return {
    documentType: row.documentType,
    field: row.field,
    label: row.label,
    value: row.value,
    bankDetails: row.bankDetails,
    isDefault: row.isDefault,
    sortOrder: row.sortOrder,
    hasImage: row.imageStorageKey !== null,
  };
}

export interface NewOption extends NormalizedOption {
  documentType: MasterDocumentType;
  field: DocumentField;
  isDefault: boolean;
  sortOrder: number;
}

export interface OptionPatch {
  option?: NormalizedOption | undefined;
  isDefault?: boolean | undefined;
  sortOrder?: number | undefined;
}

const json = (v: NormalizedOption["bankDetails"]) =>
  v === null ? Prisma.DbNull : (v as unknown as Prisma.InputJsonValue);

/** The only place `PrismaService` is called for document master items. */
@Injectable()
export class DocumentFieldsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

  @OrgScoped()
  async findMany(
    scope: OrgScope,
    filter: { documentType?: string | undefined; field?: string | undefined },
  ) {
    const rows = await this.prisma.salesDocumentMasterItem.findMany({
      where: tenantWhere(scope, {
        deletedAt: null,
        ...(filter.documentType ? { documentType: filter.documentType } : {}),
        ...(filter.field ? { field: filter.field } : {}),
      }),
      select: SELECT,
      orderBy: [
        { documentType: "asc" },
        { field: "asc" },
        { sortOrder: "asc" },
        { label: "asc" },
        { id: "asc" },
      ],
    });
    return rows.map(toView);
  }

  @OrgScoped()
  async findOne(scope: OrgScope, id: number) {
    const row = await this.findRow(scope, id);
    return row ? toView(row) : null;
  }

  /** The stored image of an option — live or deleted, so documents that
   * chose it keep printing it. null when there is none. */
  @OrgScoped()
  async findImage(scope: OrgScope, id: number) {
    const row = await this.prisma.salesDocumentMasterItem.findFirst({
      where: tenantWhere(scope, { id }),
      select: { imageStorageKey: true, imageMimeType: true },
    });
    return row?.imageStorageKey && row.imageMimeType
      ? { storageKey: row.imageStorageKey, mimeType: row.imageMimeType }
      : null;
  }

  @OrgScoped()
  async create(scope: OrgScope, input: NewOption, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await this.clearDefault(tx, scope, input.documentType, input.field);
      }
      const row = await tx.salesDocumentMasterItem.create({
        data: {
          organizationId: scope.organizationId,
          documentType: input.documentType,
          field: input.field,
          label: input.label,
          value: input.value,
          bankDetails: json(input.bankDetails),
          isDefault: input.isDefault,
          sortOrder: input.sortOrder,
          createdBy: actorId,
          updatedBy: actorId,
        },
        select: SELECT,
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: row.id,
        action: "create",
        after: snapshot(row),
      });
      return toView(row);
    });
  }

  /** null when not in scope (→ 404). */
  @OrgScoped()
  async update(
    scope: OrgScope,
    id: number,
    patch: OptionPatch,
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await this.lock(tx, scope, id);
      if (!before) return null;
      if (patch.isDefault) {
        await this.clearDefault(tx, scope, before.documentType, before.field);
      }
      const row = await tx.salesDocumentMasterItem.update({
        where: { id },
        data: {
          ...(patch.option
            ? {
                label: patch.option.label,
                value: patch.option.value,
                bankDetails: json(patch.option.bankDetails),
              }
            : {}),
          ...(patch.isDefault !== undefined
            ? { isDefault: patch.isDefault }
            : {}),
          ...(patch.sortOrder !== undefined
            ? { sortOrder: patch.sortOrder }
            : {}),
          updatedBy: actorId,
        },
        select: SELECT,
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: id,
        action: "update",
        before: snapshot(before),
        after: snapshot(row),
      });
      return toView(row);
    });
  }

  /** Points the option at a newly stored image; returns the previous key
   * (for the caller to remove), or null when not in scope. */
  @OrgScoped()
  async setImage(
    scope: OrgScope,
    id: number,
    image: { storageKey: string; mimeType: string },
    actorId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await this.lock(tx, scope, id);
      if (!before) return null;
      const row = await tx.salesDocumentMasterItem.update({
        where: { id },
        data: {
          imageStorageKey: image.storageKey,
          imageMimeType: image.mimeType,
          updatedBy: actorId,
        },
        select: SELECT,
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: id,
        action: "set_image",
        before: { hasImage: before.imageStorageKey !== null },
        after: { hasImage: true, mimeType: image.mimeType },
      });
      return { view: toView(row), previousKey: before.imageStorageKey };
    });
  }

  /** Soft-deletes (false → 404). The image file stays: documents that chose
   * this option keep printing it. */
  @OrgScoped()
  async softDelete(scope: OrgScope, id: number, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      const before = await this.lock(tx, scope, id);
      if (!before) return false;
      await tx.salesDocumentMasterItem.update({
        where: { id },
        data: { deletedAt: new Date(), isDefault: false, updatedBy: actorId },
      });
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: id,
        action: "delete",
        before: snapshot(before),
      });
      return true;
    });
  }

  private findRow(scope: OrgScope, id: number) {
    return this.prisma.salesDocumentMasterItem.findFirst({
      where: tenantWhere(scope, { id, deletedAt: null }),
      select: SELECT,
    });
  }

  private async lock(
    tx: Prisma.TransactionClient,
    scope: OrgScope,
    id: number,
  ) {
    await tx.$queryRaw`
      SELECT id FROM sales.document_master_items
       WHERE id = ${id} AND organization_id = ${scope.organizationId}
       FOR UPDATE`;
    return tx.salesDocumentMasterItem.findFirst({
      where: tenantWhere(scope, { id, deletedAt: null }),
      select: SELECT,
    });
  }

  private clearDefault(
    tx: Prisma.TransactionClient,
    scope: OrgScope,
    documentType: string,
    field: string,
  ) {
    return tx.salesDocumentMasterItem.updateMany({
      where: tenantWhere(scope, {
        documentType,
        field,
        isDefault: true,
        deletedAt: null,
      }),
      data: { isDefault: false },
    });
  }
}
