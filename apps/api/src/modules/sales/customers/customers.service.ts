import { Injectable } from "@nestjs/common";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import {
  BusinessRuleConflictException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import { FieldEncryptionService } from "../../../shared/crypto/field-encryption.service.js";
import { CodeFormatsService } from "../master-list/code-formats.service.js";
import { countryFromCallingCode } from "../shared/countries.js";
import {
  maskAccountNumber,
  normalizeAddresses,
  resolveTaxIdentity,
} from "./customers.rules.js";
import {
  type CustomerData,
  CustomersRepository,
} from "./customers.repository.js";
import type {
  CreateCustomerDto,
  CustomerStatus,
  QueryCustomerDto,
  UpdateCustomerDto,
} from "./dto/customer.dto.js";

const DEFAULT_CALLING_CODE = "+91";

@Injectable()
export class CustomersService {
  constructor(
    private readonly repository: CustomersRepository,
    private readonly tenantContext: TenantContextService,
    private readonly encryption: FieldEncryptionService,
    private readonly codeFormats: CodeFormatsService,
  ) {}

  async findAll(query: QueryCustomerDto) {
    const scope = this.tenantContext.getOrgScope();
    const { items, total } = await this.repository.findMany(
      scope,
      { search: query.search, status: query.status },
      query,
    );
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  async findOne(id: number) {
    const scope = this.tenantContext.getOrgScope();
    const row = await this.repository.findOne(scope, id);
    if (!row) throw new ResourceNotFoundException("Customer", id);
    return row;
  }

  /** Preview of the code the next customer from that country will get
   * (not reserved — the real code is issued when the customer is saved). */
  async nextCode(mobileCountryCode = DEFAULT_CALLING_CODE) {
    const scope = this.tenantContext.getOrgScope();
    const format = await this.codeFormats.getFormat("customer");
    return {
      customerCode: await this.repository.peekNextCode(
        scope,
        format,
        countryFromCallingCode(mobileCountryCode),
      ),
    };
  }

  /** The full bank account number. Audited; needs its own permission. */
  async revealBankAccount(id: number) {
    const scope = this.tenantContext.getOrgScope();
    const found = await this.repository.readBankAccountForReveal(scope, id);
    if (!found) throw new ResourceNotFoundException("Customer", id);
    return {
      bankAccountNumber: found.encrypted
        ? this.encryption.decrypt(found.encrypted)
        : null,
    };
  }

  async create(dto: CreateCustomerDto) {
    const scope = this.tenantContext.getOrgScope();
    const identity = resolveTaxIdentity({
      gstin: dto.gstin ?? null,
      stateCode: dto.stateCode ?? null,
      pan: dto.pan ?? null,
    });
    const addresses = normalizeAddresses(dto.addresses ?? []);
    if (identity.gstin) await this.assertGstinFree(scope, identity.gstin);
    const mobileCountryCode = dto.mobileCountryCode ?? DEFAULT_CALLING_CODE;
    const format = await this.codeFormats.getFormat("customer");

    return this.repository.create(
      scope,
      {
        companyName: dto.companyName,
        contactPerson: dto.contactPerson,
        email: dto.email,
        mobileCountryCode,
        mobileNumber: dto.mobileNumber,
        ...identity,
        cgstRate: dto.cgstRate ?? null,
        sgstRate: dto.sgstRate ?? null,
        igstRate: dto.igstRate ?? null,
        cin: dto.cin ?? null,
        bankName: dto.bankName ?? null,
        ...this.bankAccount(dto.bankAccountNumber ?? null),
        bankIfsc: dto.bankIfsc ?? null,
        bankBranch: dto.bankBranch ?? null,
        paymentNotes: dto.paymentNotes ?? null,
        status: dto.status ?? "ACTIVE",
        customFields: dto.customFields ?? {},
        addresses,
        code: { format, country: countryFromCallingCode(mobileCountryCode) },
      },
      this.tenantContext.getUserId(),
    );
  }

  /**
   * Partial update: `undefined` keeps a field, `null` clears an optional one.
   * The tax identity is re-checked as a whole (stored values merged with the
   * changed ones), so a new GSTIN cannot leave a PAN that contradicts it.
   */
  async update(id: number, dto: UpdateCustomerDto) {
    const scope = this.tenantContext.getOrgScope();
    const current = await this.repository.findOne(scope, id);
    if (!current) throw new ResourceNotFoundException("Customer", id);

    const data: Partial<CustomerData> = {};
    const set = <K extends keyof CustomerData>(
      key: K,
      value: CustomerData[K] | undefined,
    ) => {
      if (value !== undefined) data[key] = value;
    };
    set("companyName", dto.companyName);
    set("contactPerson", dto.contactPerson);
    set("email", dto.email);
    set("mobileCountryCode", dto.mobileCountryCode);
    set("mobileNumber", dto.mobileNumber);
    set("cgstRate", dto.cgstRate);
    set("sgstRate", dto.sgstRate);
    set("igstRate", dto.igstRate);
    set("cin", dto.cin);
    set("bankName", dto.bankName);
    set("bankIfsc", dto.bankIfsc);
    set("bankBranch", dto.bankBranch);
    set("paymentNotes", dto.paymentNotes);
    set("status", dto.status);
    set("customFields", dto.customFields);
    if (dto.bankAccountNumber !== undefined) {
      Object.assign(data, this.bankAccount(dto.bankAccountNumber));
    }

    if (
      dto.gstin !== undefined ||
      dto.stateCode !== undefined ||
      dto.pan !== undefined
    ) {
      const gstinChanged =
        dto.gstin !== undefined && dto.gstin !== current.gstin;
      const identity = resolveTaxIdentity({
        gstin: dto.gstin !== undefined ? dto.gstin : current.gstin,
        // A new GSTIN brings its own state and PAN unless they are sent too.
        stateCode:
          dto.stateCode !== undefined
            ? dto.stateCode
            : gstinChanged
              ? null
              : current.stateCode,
        pan:
          dto.pan !== undefined ? dto.pan : gstinChanged ? null : current.pan,
      });
      if (identity.gstin && identity.gstin !== current.gstin) {
        await this.assertGstinFree(scope, identity.gstin, id);
      }
      Object.assign(data, identity);
    }

    const updated = await this.repository.update(
      scope,
      id,
      {
        data,
        addresses: dto.addresses
          ? normalizeAddresses(dto.addresses)
          : undefined,
      },
      this.tenantContext.getUserId(),
    );
    if (!updated) throw new ResourceNotFoundException("Customer", id);
    return updated;
  }

  async remove(id: number): Promise<void> {
    const scope = this.tenantContext.getOrgScope();
    const deleted = await this.repository.softDelete(
      scope,
      id,
      this.tenantContext.getUserId(),
    );
    if (!deleted) throw new ResourceNotFoundException("Customer", id);
  }

  /** Public, read-only: live customers per status, for the Sales dashboard
   * (Docs/CODING_STANDARDS.md §11 — a narrow synchronous read). */
  async countByStatus(): Promise<Record<CustomerStatus, number>> {
    const counts = await this.repository.countByStatus(
      this.tenantContext.getOrgScope(),
    );
    return { ACTIVE: counts.ACTIVE ?? 0, INACTIVE: counts.INACTIVE ?? 0 };
  }

  private bankAccount(plain: string | null) {
    return plain === null
      ? { bankAccountNumberEncrypted: null, bankAccountNumberMasked: null }
      : {
          bankAccountNumberEncrypted: this.encryption.encrypt(plain),
          bankAccountNumberMasked: maskAccountNumber(plain),
        };
  }

  private async assertGstinFree(
    scope: OrgScope,
    gstin: string,
    exceptId?: number,
  ): Promise<void> {
    const taken = await this.repository.findByGstin(scope, gstin, exceptId);
    if (taken) {
      throw new BusinessRuleConflictException(
        `GSTIN ${gstin} already belongs to ${taken.customerCode} (${taken.companyName})`,
        "CUSTOMER_GSTIN_EXISTS",
      );
    }
  }
}
