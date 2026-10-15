import { Injectable, Logger } from "@nestjs/common";
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import { FileStorageService } from "../../../shared/file-storage/file-storage.service.js";
import {
  assertFieldAllowed,
  type BankDetailsInput,
  DOCUMENT_TYPES,
  type DocumentField,
  FIELDS_BY_DOCUMENT,
  isImageField,
  normalizeOption,
} from "./document-fields.rules.js";
import {
  type DocumentFieldView,
  DocumentFieldsRepository,
} from "./document-fields.repository.js";
import type {
  CreateDocumentFieldDto,
  QueryDocumentFieldDto,
  UpdateDocumentFieldDto,
} from "./dto/document-field.dto.js";
import { acceptImage, dataUri, type UploadedImage } from "./image-upload.js";

/** Sales master list — the choices on the quotation / PI / tax invoice / DC
 * forms, all on one page grouped by document type and field. */
@Injectable()
export class DocumentFieldsService {
  private readonly logger = new Logger(DocumentFieldsService.name);

  constructor(
    private readonly repository: DocumentFieldsRepository,
    private readonly tenantContext: TenantContextService,
    private readonly files: FileStorageService,
  ) {}

  /** Which fields each document type has, for building the page. */
  layout() {
    return DOCUMENT_TYPES.map((documentType) => ({
      documentType,
      fields: FIELDS_BY_DOCUMENT[documentType].map((field) => ({
        field,
        hasImage: isImageField(field),
      })),
    }));
  }

  findAll(query: QueryDocumentFieldDto) {
    return this.repository.findMany(this.tenantContext.getOrgScope(), {
      documentType: query.documentType,
      field: query.field,
    });
  }

  async findOne(id: number): Promise<DocumentFieldView> {
    const row = await this.repository.findOne(
      this.tenantContext.getOrgScope(),
      id,
    );
    if (!row) throw new ResourceNotFoundException("Document master item", id);
    return row;
  }

  create(dto: CreateDocumentFieldDto) {
    assertFieldAllowed(dto.documentType, dto.field);
    const option = normalizeOption(dto.field, dto);
    return this.repository.create(
      this.tenantContext.getOrgScope(),
      {
        ...option,
        documentType: dto.documentType,
        field: dto.field,
        isDefault: dto.isDefault ?? false,
        sortOrder: dto.sortOrder ?? 0,
      },
      this.tenantContext.getUserId(),
    );
  }

  async update(id: number, dto: UpdateDocumentFieldDto) {
    const current = await this.findOne(id);
    const optionChanged =
      dto.label !== undefined ||
      dto.value !== undefined ||
      dto.bankDetails !== undefined;
    const option = optionChanged
      ? normalizeOption(current.field as DocumentField, {
          label: dto.label !== undefined ? dto.label : current.label,
          value: dto.value !== undefined ? dto.value : current.value,
          bankDetails:
            dto.bankDetails !== undefined
              ? dto.bankDetails
              : (current.bankDetails as BankDetailsInput | null),
        })
      : undefined;
    const updated = await this.repository.update(
      this.tenantContext.getOrgScope(),
      id,
      { option, isDefault: dto.isDefault, sortOrder: dto.sortOrder },
      this.tenantContext.getUserId(),
    );
    if (!updated) {
      throw new ResourceNotFoundException("Document master item", id);
    }
    return updated;
  }

  async remove(id: number): Promise<void> {
    const deleted = await this.repository.softDelete(
      this.tenantContext.getOrgScope(),
      id,
      this.tenantContext.getUserId(),
    );
    if (!deleted) {
      throw new ResourceNotFoundException("Document master item", id);
    }
  }

  /** Uploads (or replaces) a seal / signature image. */
  async uploadImage(id: number, file: UploadedImage | undefined) {
    const scope = this.tenantContext.getOrgScope();
    const current = await this.findOne(id);
    if (!isImageField(current.field)) {
      throw new BusinessRuleViolationException(
        `${current.field} options have no image`,
        "IMAGE_NOT_ALLOWED",
      );
    }
    const image = acceptImage(
      file,
      scope.organizationId,
      current.field === "COMPANY_SEAL" ? "seal" : "signature",
    );
    // file is defined here: acceptImage throws otherwise.
    await this.files.save(image.storageKey, (file as UploadedImage).buffer);
    let result;
    try {
      result = await this.repository.setImage(
        scope,
        id,
        image,
        this.tenantContext.getUserId(),
      );
    } catch (error) {
      await this.files.remove(image.storageKey);
      throw error;
    }
    if (!result) {
      await this.files.remove(image.storageKey);
      throw new ResourceNotFoundException("Document master item", id);
    }
    // One image per option: documents print the option's current image, so
    // the replaced file is no longer referenced.
    if (result.previousKey) await this.removeQuietly(result.previousKey);
    return result.view;
  }

  /** The image of a live option, for the master-list page and previews. */
  async readImage(id: number) {
    await this.findOne(id);
    const image = await this.repository.findImage(
      this.tenantContext.getOrgScope(),
      id,
    );
    if (!image) throw new ResourceNotFoundException("Image of item", id);
    return {
      buffer: await this.files.read(image.storageKey),
      mimeType: image.mimeType,
    };
  }

  /**
   * Public, read-only (Docs/CODING_STANDARDS.md §11): checks that `id` is a
   * live COMPANY_SEAL / AUTHORIZED_SIGNATURE option and returns its label,
   * for documents that choose it. Any document type's option is accepted,
   * so a choice survives conversions (quotation → invoice → DC).
   */
  async resolveSignatory(
    id: number,
    field: "COMPANY_SEAL" | "AUTHORIZED_SIGNATURE",
  ): Promise<{ id: number; label: string }> {
    const row = await this.repository.findOne(
      this.tenantContext.getOrgScope(),
      id,
    );
    if (!row || row.field !== field) {
      throw new BusinessRuleViolationException(
        `${id} is not a ${field} option in the Sales master list`,
        "INVALID_MASTER_ITEM",
      );
    }
    return { id: row.id, label: row.label };
  }

  /** Public, read-only: an option's image as a data URI for PDFs; null when
   * it has none (or its file is gone). Deleted options still resolve, so
   * issued documents keep printing what they chose. */
  async imageDataUri(id: number | null): Promise<string | null> {
    if (id === null) return null;
    const image = await this.repository.findImage(
      this.tenantContext.getOrgScope(),
      id,
    );
    if (!image) return null;
    try {
      return dataUri(image.mimeType, await this.files.read(image.storageKey));
    } catch (error) {
      this.logger.warn(
        `Image of master item ${id} unreadable: ${String(error)}`,
      );
      return null;
    }
  }

  private async removeQuietly(key: string): Promise<void> {
    try {
      await this.files.remove(key);
    } catch (error) {
      this.logger.warn(
        `Could not remove replaced image ${key}: ${String(error)}`,
      );
    }
  }
}
