import { BadRequestException, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import { ResourceNotFoundException } from "../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import {
  detectFileType,
  FileStorageService,
  MAX_UPLOAD_BYTES,
} from "../../../shared/file-storage/file-storage.service.js";
import { MasterListValueGuard } from "../master-list-items/master-list-value.guard.js";
import { SuppliersService } from "../suppliers/suppliers.service.js";
import type {
  CreateBillDto,
  CreatePaymentDto,
  QueryBillDto,
  QueryPaymentDto,
  UpdateBillDto,
  UploadSupplierDocumentDto,
} from "./dto/finance.dto.js";
import { FinanceRepository } from "./finance.repository.js";

export interface UploadedSupplierFile {
  buffer: Buffer;
  size: number;
  originalname: string;
}

/** Keeps the uploader's own file name for display, minus any path or control
 * characters (same rule as the HR employee-documents upload). */
function sanitizeFileName(name: string): string {
  const base = [...path.basename(name)]
    .filter((char) => char.charCodeAt(0) >= 0x20 && char.charCodeAt(0) !== 0x7f)
    .join("")
    .trim();
  return (base || "document").slice(0, 255);
}

/** Supplier finance: Accounts Payable bills, payments made, and supplier
 * documents (legacy supplier detail tabs "Bills", "Payments", "Documents"). */
@Injectable()
export class FinanceService {
  constructor(
    private readonly repo: FinanceRepository,
    private readonly suppliers: SuppliersService,
    private readonly tenantContext: TenantContextService,
    private readonly files: FileStorageService,
    private readonly masterListGuard: MasterListValueGuard,
  ) {}

  private get scope() {
    return this.tenantContext.getOrgScope();
  }
  private get actor() {
    return this.tenantContext.getUserId();
  }

  // ---- bills ------------------------------------------------------------------

  async listBills(query: QueryBillDto) {
    const { items, total } = await this.repo.findBills(
      this.scope,
      {
        q: query.q,
        status: query.status,
        supplierId: query.supplierId,
        overdue: query.overdue === "true" ? true : undefined,
      },
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  async getBill(id: number) {
    const row = await this.repo.findBill(this.scope, id);
    if (!row) throw new ResourceNotFoundException("Bill", id);
    return row;
  }

  createBill(dto: CreateBillDto) {
    return this.repo.createBill(this.scope, dto, this.actor);
  }

  async updateBill(id: number, dto: UpdateBillDto) {
    const row = await this.repo.updateBill(this.scope, id, dto, this.actor);
    if (!row) throw new ResourceNotFoundException("Bill", id);
    return row;
  }

  async cancelBill(id: number, reason: string) {
    const row = await this.repo.cancelBill(this.scope, id, reason, this.actor);
    if (!row) throw new ResourceNotFoundException("Bill", id);
    return row;
  }

  async supplierSummary(supplierId: number) {
    await this.suppliers.findOne(supplierId);
    return this.repo.supplierSummary(this.scope, supplierId);
  }

  // ---- payments ---------------------------------------------------------------

  async listPayments(query: QueryPaymentDto) {
    const { items, total } = await this.repo.findPayments(
      this.scope,
      {
        q: query.q,
        supplierId: query.supplierId,
        billId: query.billId,
        status: query.status,
      },
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  createPayment(dto: CreatePaymentDto) {
    return this.repo.createPayment(this.scope, dto, this.actor);
  }

  async voidPayment(id: number, reason: string) {
    const row = await this.repo.voidPayment(this.scope, id, reason, this.actor);
    if (!row) throw new ResourceNotFoundException("Payment", id);
    return row;
  }

  // ---- documents ---------------------------------------------------------------

  /** Never returns the internal storage key. */
  async listDocuments(supplierId: number) {
    await this.suppliers.findOne(supplierId);
    const rows = await this.repo.listDocuments(this.scope, supplierId);
    return rows.map(({ storageKey: _omit, ...rest }) => rest);
  }

  async uploadDocument(
    supplierId: number,
    dto: UploadSupplierDocumentDto,
    file: UploadedSupplierFile | undefined,
  ) {
    if (!file) throw new BadRequestException("Choose a file to upload.");
    await this.masterListGuard.assertValid(
      this.scope,
      "supplier_document_type",
      dto.documentType,
      "Document type",
    );
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new BadRequestException("File must be 5 MB or smaller.");
    }
    const detected = detectFileType(file.buffer);
    if (!detected) {
      throw new BadRequestException(
        "Only PDF, JPG, or PNG files are accepted.",
      );
    }
    await this.suppliers.findOne(supplierId);

    const fileName = sanitizeFileName(file.originalname);
    const storageKey = `scm-suppliers/${supplierId}/${randomUUID()}.${detected.extension}`;
    await this.files.save(storageKey, file.buffer);
    try {
      const row = await this.repo.createDocument(
        this.scope,
        {
          supplierId,
          name: dto.name?.trim() || fileName,
          documentType: dto.documentType ?? null,
          fileName,
          storageKey,
          mimeType: detected.mimeType,
          sizeBytes: file.size,
        },
        this.actor,
      );
      const { storageKey: _omit, ...metadata } = row;
      return metadata;
    } catch (error) {
      await this.files.remove(storageKey);
      throw error;
    }
  }

  async downloadDocument(supplierId: number, id: number) {
    const row = await this.repo.findDocument(this.scope, supplierId, id);
    if (!row) throw new ResourceNotFoundException("Document", id);
    return {
      buffer: await this.files.read(row.storageKey),
      mimeType: row.mimeType,
      fileName: row.fileName,
    };
  }

  async removeDocument(supplierId: number, id: number) {
    const row = await this.repo.softDeleteDocument(this.scope, supplierId, id);
    if (!row) throw new ResourceNotFoundException("Document", id);
    await this.files.remove(row.storageKey);
  }
}
