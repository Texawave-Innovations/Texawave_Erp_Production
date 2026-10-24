import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@texawave-erp/database";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import {
  BusinessRuleViolationException,
  ResourceConflictException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import type { PrismaService } from "../../../shared/prisma/prisma.service.js";
import type { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import type { JournalEntriesRepository } from "../journal/journal-entries.repository.js";
import type { CreatePaymentAllocationDto } from "./dto/create-allocation.dto.js";
import type { CreatePaymentReceivedDto } from "./dto/create-payment-received.dto.js";
import { QueryPaymentsReceivedDto } from "./dto/query-payments-received.dto.js";
import {
  PaymentsReceivedRepository,
  type PaymentBalanceDelta,
  type PaymentJournalEntryData,
  type PaymentReversalData,
} from "./payments-received.repository.js";
import { PaymentsReceivedService } from "./payments-received.service.js";

const SCOPE = { organizationId: 1 };
const USER_ID = 42;

const MOCK_PAYMENT_DRAFT = {
  id: 10,
  organizationId: 1,
  paymentNumber: "PR-202610-0001",
  paymentDate: "2026-10-23T00:00:00.000Z",
  customerId: 101,
  customerName: "Acme Industrial",
  amount: "5000.00",
  allocatedAmount: "2000.00",
  unallocatedAmount: "3000.00",
  paymentModeId: 5,
  bankAccountId: 2,
  referenceNumber: "CHQ-998811",
  invoiceReference: "INV-202610-0001",
  notes: "Customer advance payment",
  status: "DRAFT",
  journalEntryId: null,
  allocations: [
    {
      id: 1,
      paymentReceivedId: 10,
      invoiceReference: "INV-202610-0001",
      allocatedAmount: "2000.00",
      notes: "Partial payment",
    },
  ],
  paymentMode: { id: 5, value: "Bank Transfer", category: "payment_mode" },
  bankAccount: {
    id: 2,
    accountName: "Corporate Current Account",
    glAccountId: 20,
  },
  journalEntry: null,
  deletedAt: null,
};

const MOCK_PAYMENT_CONFIRMED = {
  ...MOCK_PAYMENT_DRAFT,
  id: 11,
  status: "CONFIRMED",
  journalEntryId: 55,
};

const MOCK_PAYMENT_VOID = {
  ...MOCK_PAYMENT_DRAFT,
  id: 12,
  status: "VOID",
};

function makeService() {
  const repository = {
    findMany: vi
      .fn()
      .mockResolvedValue({ items: [MOCK_PAYMENT_DRAFT], total: 1 }),
    findById: vi.fn().mockResolvedValue(MOCK_PAYMENT_DRAFT),
    findByPaymentNumber: vi.fn().mockResolvedValue(null),
    generateNextPaymentNumber: vi.fn().mockResolvedValue("PR-202610-0002"),
    create: vi.fn().mockResolvedValue(MOCK_PAYMENT_DRAFT),
    update: vi
      .fn()
      .mockResolvedValue({ ...MOCK_PAYMENT_DRAFT, notes: "Updated notes" }),
    postAndConfirmReceipt: vi.fn().mockResolvedValue({
      ...MOCK_PAYMENT_DRAFT,
      status: "CONFIRMED",
      journalEntryId: 55,
    }),
    voidAndReverseReceipt: vi.fn().mockResolvedValue({
      ...MOCK_PAYMENT_DRAFT,
      status: "VOID",
    }),
    addAllocation: vi.fn().mockResolvedValue({ id: 2 }),
    removeAllocation: vi.fn().mockResolvedValue(true),
    softDelete: vi.fn().mockResolvedValue(true),
  };

  const journalRepository = {
    generateNextEntryNumber: vi.fn().mockResolvedValue("JV-202610-0001"),
  };

  const tenantContext = {
    getOrgScope: vi.fn().mockReturnValue(SCOPE),
    getUserId: vi.fn().mockReturnValue(USER_ID),
  };

  const prisma = {
    account: {
      findFirst: vi
        .fn()
        .mockResolvedValue({ id: 101, name: "Acme Industrial" }),
    },
    financeMasterListItem: {
      findFirst: vi.fn().mockResolvedValue({
        id: 5,
        value: "Bank Transfer",
        category: "payment_mode",
      }),
    },
    financeBankAccount: {
      findFirst: vi.fn().mockResolvedValue({
        id: 2,
        accountName: "Corporate Current Account",
        glAccountId: 20,
      }),
    },
    financeAccount: {
      findFirst: vi
        .fn()
        .mockImplementation(
          ({
            where,
          }: {
            where: { accountCode?: string; accountType?: string };
          }) => {
            if (where.accountCode === "1200") {
              return Promise.resolve({
                id: 30,
                accountCode: "1200",
                accountName: "Accounts Receivable",
                accountType: "ASSET",
              });
            }
            if (where.accountCode === "1020" || where.accountType === "ASSET") {
              return Promise.resolve({
                id: 20,
                accountCode: "1020",
                accountName: "Operating Bank Account",
                accountType: "ASSET",
              });
            }
            if (where.accountCode === "1010") {
              return Promise.resolve({
                id: 10,
                accountCode: "1010",
                accountName: "Cash on Hand",
                accountType: "ASSET",
              });
            }
            return Promise.resolve(null);
          },
        ),
    },
    financeJournalEntry: {
      findFirst: vi.fn().mockResolvedValue({
        id: 55,
        entryNumber: "JV-202610-0001",
        totalDebit: "5000.00",
        totalCredit: "5000.00",
        lines: [
          {
            accountId: 20,
            lineOrder: 0,
            debit: "5000.00",
            credit: "0.00",
            account: { id: 20, accountType: "ASSET" },
          },
          {
            accountId: 30,
            lineOrder: 1,
            debit: "0.00",
            credit: "5000.00",
            account: { id: 30, accountType: "ASSET" },
          },
        ],
      }),
    },
  };

  const service = new PaymentsReceivedService(
    repository as unknown as PaymentsReceivedRepository,
    journalRepository as unknown as JournalEntriesRepository,
    tenantContext as unknown as TenantContextService,
    prisma as unknown as PrismaService,
  );

  return {
    service,
    repository,
    journalRepository,
    tenantContext,
    prisma,
  };
}

describe("PaymentsReceivedService", () => {
  describe("List & Query", () => {
    it("findAll() returns paginated list with tenant scope", async () => {
      const { service, repository } = makeService();
      const query = Object.assign(new QueryPaymentsReceivedDto(), {
        page: 1,
        limit: 10,
      });

      const result = await service.findAll(query);

      expect(repository.findMany).toHaveBeenCalledWith(SCOPE, query);
      expect(result).toBeInstanceOf(PaginatedResponseDto);
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it("findOne() returns record when found", async () => {
      const { service, repository } = makeService();

      const result = await service.findOne(10);

      expect(repository.findById).toHaveBeenCalledWith(SCOPE, 10);
      expect(result.id).toBe(10);
    });

    it("findOne() throws ResourceNotFoundException when record not found", async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(
        ResourceNotFoundException,
      );
    });
  });

  describe("Create Payment Receipt", () => {
    const validDto: CreatePaymentReceivedDto = {
      paymentDate: "2026-10-23",
      amount: 5000,
      paymentModeId: 5,
      bankAccountId: 2,
      customerId: 101,
      customerName: "Acme Industrial",
      referenceNumber: "CHQ-998811",
      notes: "Advance payment",
      status: "DRAFT",
    };

    it("throws BusinessRuleViolationException when paymentDate is in the future", async () => {
      const { service } = makeService();
      const dto = { ...validDto, paymentDate: "2099-01-01" };

      await expect(service.create(dto)).rejects.toThrow(
        BusinessRuleViolationException,
      );
    });

    it("throws ResourceNotFoundException when CRM customerId does not exist", async () => {
      const { service, prisma } = makeService();
      prisma.account.findFirst.mockResolvedValue(null);

      await expect(service.create(validDto)).rejects.toThrow(
        ResourceNotFoundException,
      );
    });

    it("throws ResourceNotFoundException when paymentModeId does not exist", async () => {
      const { service, prisma } = makeService();
      prisma.financeMasterListItem.findFirst.mockResolvedValue(null);

      await expect(service.create(validDto)).rejects.toThrow(
        ResourceNotFoundException,
      );
    });

    it("throws ResourceNotFoundException when bankAccountId does not exist", async () => {
      const { service, prisma } = makeService();
      prisma.financeBankAccount.findFirst.mockResolvedValue(null);

      await expect(service.create(validDto)).rejects.toThrow(
        ResourceNotFoundException,
      );
    });

    it("throws BusinessRuleViolationException when an allocation amount is non-positive", async () => {
      const { service } = makeService();
      const dto: CreatePaymentReceivedDto = {
        ...validDto,
        allocations: [{ invoiceReference: "INV-001", allocatedAmount: 0 }],
      };

      await expect(service.create(dto)).rejects.toThrow(
        BusinessRuleViolationException,
      );
    });

    it("throws BusinessRuleViolationException when total allocations exceed payment amount", async () => {
      const { service } = makeService();
      const dto: CreatePaymentReceivedDto = {
        ...validDto,
        amount: 1000,
        allocations: [
          { invoiceReference: "INV-001", allocatedAmount: 600 },
          { invoiceReference: "INV-002", allocatedAmount: 500 },
        ],
      };

      await expect(service.create(dto)).rejects.toThrow(
        BusinessRuleViolationException,
      );
    });

    it("throws ResourceConflictException when custom paymentNumber already exists", async () => {
      const { service, repository } = makeService();
      repository.findByPaymentNumber.mockResolvedValue(MOCK_PAYMENT_DRAFT);
      const dto = { ...validDto, paymentNumber: "PR-EXISTING" };

      await expect(service.create(dto)).rejects.toThrow(
        ResourceConflictException,
      );
    });

    it("throws ResourceConflictException when paymentNumber belongs to a soft-deleted record", async () => {
      const { service, repository } = makeService();
      repository.findByPaymentNumber.mockResolvedValue({
        ...MOCK_PAYMENT_DRAFT,
        deletedAt: new Date("2026-10-24"),
      });
      const dto = { ...validDto, paymentNumber: "PR-SOFT-DELETED" };

      await expect(service.create(dto)).rejects.toThrow(
        ResourceConflictException,
      );
    });

    it("maps Prisma P2002 unique constraint error from repository.create to ResourceConflictException", async () => {
      const { service, repository } = makeService();
      const p2002Error = new Prisma.PrismaClientKnownRequestError(
        "Unique constraint failed on the fields: (`organization_id`, `payment_number`)",
        { code: "P2002", clientVersion: "6.0.0" },
      );
      repository.create.mockRejectedValue(p2002Error);

      await expect(service.create(validDto)).rejects.toThrow(
        ResourceConflictException,
      );
    });

    it("creates DRAFT receipt and computes allocated and unallocated balances accurately", async () => {
      const { service, repository } = makeService();
      const dto: CreatePaymentReceivedDto = {
        ...validDto,
        amount: 5000,
        status: "DRAFT",
        allocations: [
          { invoiceReference: "INV-001", allocatedAmount: 2000 },
          { invoiceReference: "INV-002", allocatedAmount: 1500 },
        ],
      };

      await service.create(dto);

      expect(repository.create).toHaveBeenCalledWith(
        SCOPE,
        expect.objectContaining({
          amount: 5000,
          allocatedAmount: 3500,
          unallocatedAmount: 1500,
          paymentNumber: "PR-202610-0002",
          status: "DRAFT",
        }),
        expect.arrayContaining([
          expect.objectContaining({
            invoiceReference: "INV-001",
            allocatedAmount: 2000,
          }),
          expect.objectContaining({
            invoiceReference: "INV-002",
            allocatedAmount: 1500,
          }),
        ]),
      );
    });

    it("creates CONFIRMED receipt and triggers GL journal posting immediately", async () => {
      const { service, repository } = makeService();
      const dto: CreatePaymentReceivedDto = {
        ...validDto,
        amount: 5000,
        status: "CONFIRMED",
      };

      repository.create.mockResolvedValue({ ...MOCK_PAYMENT_DRAFT, id: 99 });
      repository.findById.mockResolvedValue({
        ...MOCK_PAYMENT_DRAFT,
        id: 99,
        status: "DRAFT",
      });

      await service.create(dto);

      expect(repository.postAndConfirmReceipt).toHaveBeenCalledWith(
        SCOPE,
        99,
        expect.objectContaining<Partial<PaymentJournalEntryData>>({
          entryType: "PAYMENT_RECEIVED",
          totalDebit: 5000,
          totalCredit: 5000,
        }),
        expect.any(Array),
        USER_ID,
      );
    });
  });

  describe("Update Payment Receipt", () => {
    it("throws BusinessRuleViolationException when updating a VOID payment", async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue(MOCK_PAYMENT_VOID);

      await expect(service.update(12, { notes: "New note" })).rejects.toThrow(
        BusinessRuleViolationException,
      );
    });

    it("throws BusinessRuleViolationException when updating a CONFIRMED payment", async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue(MOCK_PAYMENT_CONFIRMED);

      await expect(service.update(11, { notes: "New note" })).rejects.toThrow(
        BusinessRuleViolationException,
      );
    });

    it("throws BusinessRuleViolationException when updating a RECONCILED payment", async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue({
        ...MOCK_PAYMENT_CONFIRMED,
        id: 15,
        status: "RECONCILED",
      });

      await expect(service.update(15, { notes: "New note" })).rejects.toThrow(
        BusinessRuleViolationException,
      );
    });

    it("throws BusinessRuleViolationException when update paymentDate is in the future", async () => {
      const { service } = makeService();

      await expect(
        service.update(10, { paymentDate: "2099-01-01" }),
      ).rejects.toThrow(BusinessRuleViolationException);
    });

    it("throws ResourceNotFoundException when update customerId does not exist", async () => {
      const { service, prisma } = makeService();
      prisma.account.findFirst.mockResolvedValue(null);

      await expect(service.update(10, { customerId: 999 })).rejects.toThrow(
        ResourceNotFoundException,
      );
    });

    it("updates metadata successfully on DRAFT payment", async () => {
      const { service, repository } = makeService();

      await service.update(10, {
        referenceNumber: "NEW-REF",
        notes: "Updated remarks",
      });

      expect(repository.update).toHaveBeenCalledWith(
        SCOPE,
        10,
        expect.objectContaining({
          referenceNumber: "NEW-REF",
          notes: "Updated remarks",
          updatedBy: USER_ID,
        }),
      );
    });
  });

  describe("General Ledger Confirmation & Double-Entry Invariants", () => {
    it("throws BusinessRuleViolationException if payment is already CONFIRMED", async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue(MOCK_PAYMENT_CONFIRMED);

      await expect(service.confirm(11)).rejects.toThrow(
        BusinessRuleViolationException,
      );
    });

    it("throws BusinessRuleViolationException if payment is VOID", async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue(MOCK_PAYMENT_VOID);

      await expect(service.confirm(12)).rejects.toThrow(
        BusinessRuleViolationException,
      );
    });

    it("posts balanced double-entry GL journal: Debit Bank/Cash, Credit Accounts Receivable", async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue({
        ...MOCK_PAYMENT_DRAFT,
        amount: "5000.00",
        bankAccountId: 2,
      });

      await service.confirm(10);

      expect(repository.postAndConfirmReceipt).toHaveBeenCalledWith(
        SCOPE,
        10,
        expect.objectContaining({
          entryType: "PAYMENT_RECEIVED",
          totalDebit: 5000,
          totalCredit: 5000,
          lines: [
            expect.objectContaining({
              accountId: 20, // Bank GL
              debit: 5000,
              credit: 0,
            }),
            expect.objectContaining({
              accountId: 30, // AR GL (1200)
              debit: 0,
              credit: 5000,
            }),
          ],
        }),
        expect.arrayContaining<PaymentBalanceDelta>([
          { accountId: 20, delta: 5000 },
          { accountId: 30, delta: -5000 },
        ]),
        USER_ID,
      );
    });

    it("resolves Cash GL account (1010) when payment mode is Cash", async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue({
        ...MOCK_PAYMENT_DRAFT,
        bankAccountId: null,
        paymentMode: {
          id: 3,
          value: "Cash on Delivery",
          category: "payment_mode",
        },
      });

      await service.confirm(10);

      const [, , journalData] = repository.postAndConfirmReceipt.mock
        .calls[0] as [unknown, unknown, PaymentJournalEntryData];
      expect(journalData.lines[0]?.accountId).toBe(10); // Cash on Hand
      expect(journalData.lines[0]?.debit).toBe(5000);
    });

    it("throws BusinessRuleViolationException if Accounts Receivable GL account is missing", async () => {
      const { service, prisma } = makeService();
      // Bank account resolves deposit GL account via bankAccount.glAccountId = 20
      prisma.financeBankAccount.findFirst.mockResolvedValue({
        id: 2,
        accountName: "Corporate Bank",
        glAccountId: 20,
      });
      // All financeAccount queries return null (AR 1200, named AR, and fallback ASSET accounts missing)
      prisma.financeAccount.findFirst.mockResolvedValue(null);

      await expect(service.confirm(10)).rejects.toThrow(
        BusinessRuleViolationException,
      );
    });
  });

  describe("Void & Reversal Workflow", () => {
    it("throws BusinessRuleViolationException if payment is already VOID", async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue(MOCK_PAYMENT_VOID);

      await expect(service.void(12)).rejects.toThrow(
        BusinessRuleViolationException,
      );
    });

    it("voids DRAFT receipt without generating a reversal journal", async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue(MOCK_PAYMENT_DRAFT);

      await service.void(10);

      expect(repository.voidAndReverseReceipt).toHaveBeenCalledWith(
        SCOPE,
        10,
        null,
        [],
        USER_ID,
      );
    });

    it("voids CONFIRMED receipt, creates REV reversal voucher, inverts lines and restores balances", async () => {
      const { service, repository, journalRepository } = makeService();
      repository.findById.mockResolvedValue(MOCK_PAYMENT_CONFIRMED);
      journalRepository.generateNextEntryNumber.mockResolvedValue(
        "REV-202610-0001",
      );

      await service.void(11);

      expect(repository.voidAndReverseReceipt).toHaveBeenCalledWith(
        SCOPE,
        11,
        expect.objectContaining<Partial<PaymentReversalData>>({
          originalJournalEntryId: 55,
          reversalEntryNumber: "REV-202610-0001",
          lines: [
            expect.objectContaining({
              accountId: 20,
              debit: 0,
              credit: 5000,
            }),
            expect.objectContaining({
              accountId: 30,
              debit: 5000,
              credit: 0,
            }),
          ],
        }),
        expect.arrayContaining<PaymentBalanceDelta>([
          { accountId: 20, delta: -5000 },
          { accountId: 30, delta: 5000 },
        ]),
        USER_ID,
      );
    });
  });

  describe("Dynamic Invoice Allocations", () => {
    const allocationDto: CreatePaymentAllocationDto = {
      invoiceReference: "INV-202610-0088",
      allocatedAmount: 1000,
      notes: "Follow-up partial allocation",
    };

    it("throws BusinessRuleViolationException when allocating against a VOID receipt", async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue(MOCK_PAYMENT_VOID);

      await expect(service.addAllocation(12, allocationDto)).rejects.toThrow(
        BusinessRuleViolationException,
      );
    });

    it("throws BusinessRuleViolationException when allocation amount is <= 0", async () => {
      const { service } = makeService();

      await expect(
        service.addAllocation(10, { ...allocationDto, allocatedAmount: 0 }),
      ).rejects.toThrow(BusinessRuleViolationException);
    });

    it("throws BusinessRuleViolationException when allocation exceeds available unallocated balance", async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue({
        ...MOCK_PAYMENT_DRAFT,
        unallocatedAmount: "500.00",
      });

      await expect(
        service.addAllocation(10, { ...allocationDto, allocatedAmount: 800 }),
      ).rejects.toThrow(BusinessRuleViolationException);
    });

    it("successfully adds allocation when within unallocated balance", async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue({
        ...MOCK_PAYMENT_DRAFT,
        unallocatedAmount: "3000.00",
      });

      await service.addAllocation(10, allocationDto);

      expect(repository.addAllocation).toHaveBeenCalledWith(
        SCOPE,
        10,
        {
          invoiceReference: "INV-202610-0088",
          allocatedAmount: 1000,
          notes: "Follow-up partial allocation",
        },
        USER_ID,
      );
    });

    it("throws ResourceNotFoundException when removing an allocation that does not belong to the payment", async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue(MOCK_PAYMENT_DRAFT); // has allocation id: 1

      await expect(service.removeAllocation(10, 999)).rejects.toThrow(
        ResourceNotFoundException,
      );
    });

    it("successfully removes allocation and restores unallocated balance", async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue(MOCK_PAYMENT_DRAFT);

      await service.removeAllocation(10, 1);

      expect(repository.removeAllocation).toHaveBeenCalledWith(
        SCOPE,
        10,
        1,
        2000,
        USER_ID,
      );
    });
  });

  describe("Delete Receipts", () => {
    it("throws BusinessRuleViolationException when attempting to delete a CONFIRMED receipt", async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue(MOCK_PAYMENT_CONFIRMED);

      await expect(service.delete(11)).rejects.toThrow(
        BusinessRuleViolationException,
      );
    });

    it("soft deletes a DRAFT receipt successfully", async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue(MOCK_PAYMENT_DRAFT);

      await service.delete(10);

      expect(repository.softDelete).toHaveBeenCalledWith(SCOPE, 10, USER_ID);
    });
  });
});
