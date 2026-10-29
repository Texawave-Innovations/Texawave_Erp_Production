import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { translateDbError } from "../../../common/database/db-errors.js";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { PaginationDto } from "../../../common/dto/pagination.dto.js";
import { BusinessRuleConflictException } from "../../../common/exceptions/business.exception.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { tenantWhere } from "../../../common/tenancy/tenant-where.js";
import { AuditWriter } from "../../../platform/audit/audit-writer.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import { gstStateName } from "../shared/gst.js";
import {
  type CodeFormat,
  formatCode,
  sequenceDocType,
} from "../master-list/code-formats.rules.js";
import { issueCustomerCode } from "./customer-code.js";
import type { CustomerAddressDto, CustomerStatus } from "./dto/customer.dto.js";

const ENTITY_TYPE = "sales_customer";

const INCLUDE = {
  addresses: {
    where: { deletedAt: null },
    orderBy: [{ isDefault: "desc" }, { id: "asc" }],
  },
} satisfies Prisma.SalesCustomerInclude;

type CustomerRow = Prisma.SalesCustomerGetPayload<{ include: typeof INCLUDE }>;
type AddressRow = CustomerRow["addresses"][number];

export interface CustomerFilter {
  search?: string | undefined;
  status?: CustomerStatus | undefined;
}

/** Every column the service may set. The bank account arrives already
 * encrypted and masked — this layer never sees the plain number. */
export interface CustomerData {
  companyName: string;
  contactPerson: string;
  email: string;
  mobileCountryCode: string;
  mobileNumber: string;
  gstin: string | null;
  stateCode: string | null;
  cgstRate: number | null;
  sgstRate: number | null;
  igstRate: number | null;
  pan: string | null;
  cin: string | null;
  bankName: string | null;
  bankAccountNumberEncrypted: string | null;
  bankAccountNumberMasked: string | null;
  bankIfsc: string | null;
  bankBranch: string | null;
  paymentNotes: string | null;
  status: CustomerStatus;
  customFields: Record<string, unknown>;
}

export interface NewCustomer extends CustomerData {
  addresses: CustomerAddressDto[];
  /** How the code is built: master-list format + ISO country (CUS-IN-001). */
  code: { format: CodeFormat; country: string };
}

export interface CustomerPatch {
  data: Partial<CustomerData>;
  /** undefined = leave the addresses as they are. */
  addresses?: CustomerAddressDto[] | undefined;
}

function addressView(a: AddressRow) {
  return {
    id: a.id,
    addressType: a.addressType,
    label: a.label,
    street: a.street,
    area: a.area,
    city: a.city,
    stateCode: a.stateCode,
    stateName: gstStateName(a.stateCode),
    pincode: a.pincode,
    country: a.country,
    isDefault: a.isDefault,
  };
}

/** The API shape. The encrypted account number never leaves this file. */
function toView(row: CustomerRow) {
  const { bankAccountNumberEncrypted: _secret, addresses, ...rest } = row;
  const billing = addresses.filter((a) => a.addressType === "BILLING");
  const defaultAddress =
    billing.find((a) => a.isDefault) ?? billing[0] ?? addresses[0] ?? null;
  return {
    ...rest,
    stateName: gstStateName(row.stateCode),
    addresses: addresses.map(addressView),
    /** The address the directory shows: default billing, else any. */
    defaultAddress: defaultAddress ? addressView(defaultAddress) : null,
  };
}

function snapshot(row: CustomerRow) {
  return {
    customerCode: row.customerCode,
    companyName: row.companyName,
    contactPerson: row.contactPerson,
    email: row.email,
    mobile: `${row.mobileCountryCode} ${row.mobileNumber}`,
    gstin: row.gstin,
    stateCode: row.stateCode,
    cgstRate: row.cgstRate?.toString() ?? null,
    sgstRate: row.sgstRate?.toString() ?? null,
    igstRate: row.igstRate?.toString() ?? null,
    pan: row.pan,
    cin: row.cin,
    bankName: row.bankName,
    bankAccountNumber: row.bankAccountNumberMasked,
    bankIfsc: row.bankIfsc,
    status: row.status,
    addresses: row.addresses.length,
  };
}

function addressRows(
  organizationId: number,
  customerId: number,
  actorId: number,
  addresses: readonly CustomerAddressDto[],
): Prisma.SalesCustomerAddressCreateManyInput[] {
  return addresses.map((a) => ({
    organizationId,
    customerId,
    addressType: a.addressType,
    label: a.label,
    street: a.street,
    area: a.area ?? null,
    city: a.city,
    stateCode: a.stateCode,
    pincode: a.pincode,
    country: a.country ?? "India",
    isDefault: a.isDefault ?? false,
    createdBy: actorId,
    updatedBy: actorId,
  }));
}

function columns(data: Partial<CustomerData>) {
  const { customFields, ...rest } = data;
  return {
    ...rest,
    ...(rest.status !== undefined
      ? { isActive: rest.status === "ACTIVE" }
      : {}),
    ...(customFields !== undefined
      ? { customFields: customFields as Prisma.InputJsonValue }
      : {}),
  };
}

const GSTIN_TAKEN = () =>
  new BusinessRuleConflictException(
    "Another customer already has this GSTIN",
    "CUSTOMER_GSTIN_EXISTS",
  );

/** The only place `PrismaService` is called for customers. Every write is
 * one transaction holding the change and its audit row. */
@Injectable()
export class CustomersRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriter,
  ) {}

  @OrgScoped()
  async findMany(
    scope: OrgScope,
    filter: CustomerFilter,
    pagination: PaginationDto,
  ) {
    const search = filter.search ?? "";
    const contains = { contains: search, mode: "insensitive" } as const;
    const where = tenantWhere<Prisma.SalesCustomerWhereInput>(scope, {
      deletedAt: null,
      ...(filter.status ? { status: filter.status } : {}),
      ...(search
        ? {
            OR: [
              { customerCode: contains },
              { companyName: contains },
              { contactPerson: contains },
              { email: contains },
              { mobileNumber: { contains: search } },
              { gstin: contains },
              {
                addresses: {
                  some: { deletedAt: null, city: contains },
                },
              },
            ],
          }
        : {}),
    });
    const [rows, total] = await Promise.all([
      this.prisma.salesCustomer.findMany({
        where,
        include: INCLUDE,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [{ customerCode: pagination.order ?? "desc" }],
      }),
      this.prisma.salesCustomer.count({ where }),
    ]);
    return { items: rows.map(toView), total };
  }

  @OrgScoped()
  async findOne(scope: OrgScope, id: number) {
    const row = await this.prisma.salesCustomer.findFirst({
      where: tenantWhere(scope, { id, deletedAt: null }),
      include: INCLUDE,
    });
    return row ? toView(row) : null;
  }

  /** Another live customer holding `gstin` (excluding `exceptId`). */
  @OrgScoped()
  findByGstin(scope: OrgScope, gstin: string, exceptId?: number) {
    return this.prisma.salesCustomer.findFirst({
      where: tenantWhere(scope, {
        gstin,
        deletedAt: null,
        ...(exceptId !== undefined ? { id: { not: exceptId } } : {}),
      }),
      select: { id: true, customerCode: true, companyName: true },
    });
  }

  /** The code the next customer will probably get — a preview for the
   * "Add New Customer" header, never reserved (a concurrent create may take
   * it; the code is issued for real inside the create transaction). */
  @OrgScoped()
  async peekNextCode(
    scope: OrgScope,
    format: CodeFormat,
    country: string,
  ): Promise<string> {
    const row = await this.prisma.documentSequence.findFirst({
      where: tenantWhere(scope, {
        docType: sequenceDocType("customer", country),
        deletedAt: null,
      }),
      select: { nextNumber: true },
    });
    return formatCode(format, country, row?.nextNumber ?? 1);
  }

  /** The encrypted account number, for the audited reveal (null → 404). The
   * read and its audit row commit together. */
  @OrgScoped()
  async readBankAccountForReveal(scope: OrgScope, id: number) {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.salesCustomer.findFirst({
        where: tenantWhere(scope, { id, deletedAt: null }),
        select: {
          id: true,
          customerCode: true,
          bankAccountNumberEncrypted: true,
        },
      });
      if (!row) return null;
      await this.audit.write(tx, {
        entityType: ENTITY_TYPE,
        entityId: id,
        action: "reveal_bank_account",
        after: { customerCode: row.customerCode },
      });
      return { encrypted: row.bankAccountNumberEncrypted };
    });
  }

  @OrgScoped()
  async create(scope: OrgScope, input: NewCustomer, actorId: number) {
    const { addresses, customFields, code, ...data } = input;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const customerCode = await issueCustomerCode(
          tx,
          scope.organizationId,
          code.country,
          code.format,
        );
        const created = await tx.salesCustomer.create({
          data: {
            ...data,
            customFields: customFields as Prisma.InputJsonValue,
            isActive: data.status === "ACTIVE",
            customerCode,
            organizationId: scope.organizationId,
            createdBy: actorId,
            updatedBy: actorId,
          },
        });
        if (addresses.length) {
          await tx.salesCustomerAddress.createMany({
            data: addressRows(
              scope.organizationId,
              created.id,
              actorId,
              addresses,
            ),
          });
        }
        const row = await tx.salesCustomer.findUniqueOrThrow({
          where: { id: created.id },
          include: INCLUDE,
        });
        await this.audit.write(tx, {
          entityType: ENTITY_TYPE,
          entityId: row.id,
          action: "create",
          after: snapshot(row),
        });
        return toView(row);
      });
    } catch (e) {
      throw translateDbError(e, {
        customers_organization_id_gstin_live_key: GSTIN_TAKEN(),
      });
    }
  }

  /** null when the customer is not in scope (→ 404). The row is locked first
   * so concurrent edits serialise. The customer code never changes. */
  @OrgScoped()
  async update(
    scope: OrgScope,
    id: number,
    patch: CustomerPatch,
    actorId: number,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`
          SELECT id FROM sales.customers
           WHERE id = ${id} AND organization_id = ${scope.organizationId}
           FOR UPDATE`;
        const before = await tx.salesCustomer.findFirst({
          where: tenantWhere(scope, { id, deletedAt: null }),
          include: INCLUDE,
        });
        if (!before) return null;

        await tx.salesCustomer.update({
          where: { id },
          data: { ...columns(patch.data), updatedBy: actorId },
        });
        if (patch.addresses !== undefined) {
          await tx.salesCustomerAddress.updateMany({
            where: { customerId: id, deletedAt: null },
            data: {
              deletedAt: new Date(),
              isDefault: false,
              updatedBy: actorId,
            },
          });
          if (patch.addresses.length) {
            await tx.salesCustomerAddress.createMany({
              data: addressRows(
                scope.organizationId,
                id,
                actorId,
                patch.addresses,
              ),
            });
          }
        }
        const after = await tx.salesCustomer.findUniqueOrThrow({
          where: { id },
          include: INCLUDE,
        });
        await this.audit.write(tx, {
          entityType: ENTITY_TYPE,
          entityId: id,
          action: "update",
          before: snapshot(before),
          after: snapshot(after),
        });
        return toView(after);
      });
    } catch (e) {
      throw translateDbError(e, {
        customers_organization_id_gstin_live_key: GSTIN_TAKEN(),
      });
    }
  }

  /** Soft-deletes a customer and its addresses (false → 404). Its code stays
   * used. Refused while live quotations, invoices or DCs point at it. */
  @OrgScoped()
  async softDelete(scope: OrgScope, id: number, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id FROM sales.customers
         WHERE id = ${id} AND organization_id = ${scope.organizationId}
         FOR UPDATE`;
      const before = await tx.salesCustomer.findFirst({
        where: tenantWhere(scope, { id, deletedAt: null }),
        include: INCLUDE,
      });
      if (!before) return false;
      // Sales documents (same bounded context, same schema) keep pointing at
      // the customer — refuse while any live one does.
      const [docs] = await tx.$queryRaw<Array<{ n: number }>>`
        SELECT ((SELECT count(*) FROM sales.quotations
                  WHERE customer_id = ${id} AND deleted_at IS NULL)
              + (SELECT count(*) FROM sales.invoices
                  WHERE customer_id = ${id} AND deleted_at IS NULL)
              + (SELECT count(*) FROM sales.delivery_challans
                  WHERE customer_id = ${id} AND deleted_at IS NULL))::int AS n`;
      if (docs && docs.n > 0) {
        throw new BusinessRuleConflictException(
          `Customer ${before.customerCode} has ${docs.n} live sales document(s); delete or reassign them first`,
          "CUSTOMER_HAS_DOCUMENTS",
        );
      }
      const now = new Date();
      await tx.salesCustomer.update({
        where: { id },
        data: {
          deletedAt: now,
          status: "INACTIVE",
          isActive: false,
          updatedBy: actorId,
        },
      });
      await tx.salesCustomerAddress.updateMany({
        where: { customerId: id, deletedAt: null },
        data: { deletedAt: now, isDefault: false, updatedBy: actorId },
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

  /** Live customers per status — for the dashboard. */
  @OrgScoped()
  async countByStatus(scope: OrgScope) {
    const rows = await this.prisma.salesCustomer.groupBy({
      by: ["status"],
      where: tenantWhere(scope, { deletedAt: null }),
      _count: { _all: true },
    });
    return Object.fromEntries(
      rows.map((r) => [r.status, r._count._all]),
    ) as Partial<Record<CustomerStatus, number>>;
  }
}
