import { describe, expect, it, vi } from "vitest";
import {
  BusinessRuleViolationException,
  ResourceConflictException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import type { PrismaService } from "../../../shared/prisma/prisma.service.js";
import type { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import type { JournalEntriesRepository } from "../journal/journal-entries.repository.js";
import type { FinanceService } from "../../scm/finance/finance.service.js";
import { QueryPaymentsMadeDto } from "./dto/query-payments-made.dto.js";
import type { PaymentsMadeRepository } from "./payments-made.repository.js";
import { PaymentsMadeService } from "./payments-made.service.js";

const SCOPE = { organizationId: 1 };
const USER_ID = 77;

const MOCK_PAYMENT_DRAFT = {
  id: 10,
  organizationId: 1,
  paymentNumber: "PM-202610-0001",
  paymentDate: new Date("2026-10-23T00:00:00.000Z"),
  vendorName: "Steel Industries Corp",
  amount: "3500.00",
  paymentModeId: 4,
  bankAccountId: 2,
  referenceNumber: "NEFT-12345",
  billReference: "BILL-202610-0099",
  scmSupplierPaymentId: null,
  notes: "Advance disbursement",
  status: "DRAFT",
  journalEntryId: null,
  paymentMode: { id: 4, value: "Bank Transfer", category: "payment_mode" },
  bankAccount: { id: 2, accountName: "Current Account", glAccountId: 20 },
  deletedAt: null,
};

const MOCK_PAYMENT_CONFIRMED = {
  ...MOCK_PAYMENT_DRAFT,
  id: 11,
  status: "CONFIRMED",
  journalEntryId: 99,
};

const MOCK_PAYMENT_VOID = {
  ...MOCK_PAYMENT_DRAFT,
  id: 12,
  status: "VOID",
};

const MOCK_PAYMENT_RECONCILED = {
  ...MOCK_PAYMENT_CONFIRMED,
  id: 13,
  status: "RECONCILED",
};

const MOCK_PAYMENT_WITH_BILL = {
  ...MOCK_PAYMENT_DRAFT,
  id: 20,
  supplierId: 14,
  billId: 8,
  status: "DRAFT",
};

const MOCK_PAYMENT_CONFIRMED_WITH_SCM_LINK = {
  ...MOCK_PAYMENT_CONFIRMED,
  id: 21,
  supplierId: 14,
  billId: 8,
  scmSupplierPaymentId: 301,
};

function makeService() {
  const repository = {
    findMany: vi
      .fn()
      .mockResolvedValue({ items: [MOCK_PAYMENT_DRAFT], total: 1 }),
    findById: vi.fn().mockResolvedValue(MOCK_PAYMENT_DRAFT),
    findByPaymentNumber: vi.fn().mockResolvedValue(null),
    generateNextPaymentNumber: vi.fn().mockResolvedValue("PM-202610-0002"),
    create: vi.fn().mockResolvedValue(MOCK_PAYMENT_DRAFT),
    update: vi.fn().mockResolvedValue({
      ...MOCK_PAYMENT_DRAFT,
      vendorName: "Updated Vendor",
    }),
    postAndConfirmPayment: vi.fn().mockResolvedValue({
      ...MOCK_PAYMENT_DRAFT,
      status: "CONFIRMED",
      journalEntryId: 99,
    }),
    voidAndReversePayment: vi.fn().mockResolvedValue({
      ...MOCK_PAYMENT_DRAFT,
      status: "VOID",
    }),
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
    financeMasterListItem: {
      findFirst: vi.fn().mockResolvedValue({
        id: 4,
        value: "Bank Transfer",
        category: "payment_mode",
      }),
    },
    financeBankAccount: {
      findFirst: vi.fn().mockResolvedValue({
        id: 2,
        accountName: "Current Account",
        glAccountId: 20,
      }),
    },
    scmSupplierPayment: {
      findFirst: vi
        .fn()
        .mockResolvedValue({ id: 301, paymentNumber: "SP-001" }),
    },
    supplier: {
      findFirst: vi
        .fn()
        .mockResolvedValue({ id: 14, companyName: "GBSuppliers" }),
    },
    scmSupplierBill: {
      findFirst: vi.fn().mockResolvedValue({
        id: 8,
        supplierId: 14,
        status: "OPEN",
        billNumber: "TW/BILL/26-27/0008",
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
            if (
              where.accountCode === "2010" ||
              where.accountType === "LIABILITY"
            ) {
              return Promise.resolve({
                id: 50,
                accountCode: "2010",
                accountName: "Accounts Payable",
                accountType: "LIABILITY",
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
        id: 99,
        entryNumber: "JV-202610-0001",
        totalDebit: "3500.00",
        totalCredit: "3500.00",
        lines: [
          {
            accountId: 50,
            lineOrder: 0,
            debit: "3500.00",
            credit: "0.00",
            account: { accountType: "LIABILITY" },
          },
          {
            accountId: 20,
            lineOrder: 1,
            debit: "0.00",
            credit: "3500.00",
            account: { accountType: "ASSET" },
          },
        ],
      }),
    },
    $transaction: vi.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
  };

  const scmFinance = {
    createPayment: vi.fn(),
    voidPayment: vi.fn(),
    mapPaymentMode: vi.fn().mockReturnValue("BANK_TRANSFER"),
  };

  const service = new PaymentsMadeService(
    repository as unknown as PaymentsMadeRepository,
    journalRepository as unknown as JournalEntriesRepository,
    tenantContext as unknown as TenantContextService,
    prisma as unknown as PrismaService,
    scmFinance as unknown as FinanceService,
  );

  return { service, repository, journalRepository, prisma, scmFinance };
}

describe("PaymentsMadeService", () => {
  describe("List and Read", () => {
    it("returns paginated payments made", async () => {
      const { service } = makeService();
      const res = await service.findAll(new QueryPaymentsMadeDto());
      expect(res.items).toHaveLength(1);
      expect(res.total).toBe(1);
    });

    it("throws ResourceNotFoundException when payment does not exist", async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(
        ResourceNotFoundException,
      );
    });
  });

  describe("Create Disbursement", () => {
    it("rejects future payment date", async () => {
      const { service } = makeService();

      await expect(
        service.create({
          paymentDate: "2099-01-01",
          vendorName: "Steel Corp",
          amount: 1000,
          paymentModeId: 4,
        }),
      ).rejects.toThrow(BusinessRuleViolationException);
    });

    it("rejects zero or negative amount", async () => {
      const { service } = makeService();

      await expect(
        service.create({
          paymentDate: "2026-10-23",
          vendorName: "Steel Corp",
          amount: 0,
          paymentModeId: 4,
        }),
      ).rejects.toThrow(BusinessRuleViolationException);
    });

    it("throws ResourceNotFoundException for non-existent paymentModeId", async () => {
      const { service, prisma } = makeService();
      prisma.financeMasterListItem.findFirst.mockResolvedValue(null);

      await expect(
        service.create({
          paymentDate: "2026-10-23",
          vendorName: "Steel Corp",
          amount: 1000,
          paymentModeId: 999,
        }),
      ).rejects.toThrow(ResourceNotFoundException);
    });

    it("throws ResourceNotFoundException for non-existent bankAccountId", async () => {
      const { service, prisma } = makeService();
      prisma.financeBankAccount.findFirst.mockResolvedValue(null);

      await expect(
        service.create({
          paymentDate: "2026-10-23",
          vendorName: "Steel Corp",
          amount: 1000,
          paymentModeId: 4,
          bankAccountId: 999,
        }),
      ).rejects.toThrow(ResourceNotFoundException);
    });

    it("throws ResourceConflictException when custom paymentNumber already exists", async () => {
      const { service, repository } = makeService();
      repository.findByPaymentNumber.mockResolvedValue(MOCK_PAYMENT_DRAFT);

      await expect(
        service.create({
          paymentNumber: "PM-202610-0001",
          paymentDate: "2026-10-23",
          vendorName: "Steel Corp",
          amount: 1000,
          paymentModeId: 4,
          bankAccountId: 2,
        }),
      ).rejects.toThrow(ResourceConflictException);
    });

    it("creates DRAFT disbursement without posting GL journal", async () => {
      const { service, repository } = makeService();

      const created = await service.create({
        paymentDate: "2026-10-23",
        vendorName: "Steel Corp",
        amount: 1000,
        paymentModeId: 4,
        bankAccountId: 2,
        status: "DRAFT",
      });

      expect(created).toBeDefined();
      expect(repository.postAndConfirmPayment).not.toHaveBeenCalled();
    });

    it("creates and automatically confirms payment with balanced GL posting when CONFIRMED", async () => {
      const { service, repository } = makeService();

      const created = await service.create({
        paymentDate: "2026-10-23",
        vendorName: "Steel Corp",
        amount: 3500,
        paymentModeId: 4,
        bankAccountId: 2,
        status: "CONFIRMED",
      });

      expect(created).toBeDefined();
      expect(repository.postAndConfirmPayment).toHaveBeenCalled();
      const confirmCall = repository.postAndConfirmPayment.mock.calls[0] as [
        unknown,
        number,
        {
          entryType: string;
          totalDebit: number;
          totalCredit: number;
          lines: Array<{ accountId: number; debit: number; credit: number }>;
        },
        unknown,
        { id: number; delta: number },
        number,
      ];
      expect(confirmCall[0]).toEqual(SCOPE);
      expect(confirmCall[1]).toBe(10);
      expect(confirmCall[2].entryType).toBe("PAYMENT_MADE");
      expect(confirmCall[2].totalDebit).toBe(3500);
      expect(confirmCall[2].totalCredit).toBe(3500);
      expect(confirmCall[2].lines[0]?.accountId).toBe(50);
      expect(confirmCall[2].lines[1]?.accountId).toBe(20);
      expect(confirmCall[4].id).toBe(2);
      expect(confirmCall[4].delta).toBe(-3500);
      expect(confirmCall[5]).toBe(USER_ID);
    });

    it("throws ResourceNotFoundException for non-existent supplierId", async () => {
      const { service, prisma } = makeService();
      prisma.supplier.findFirst.mockResolvedValue(null);

      await expect(
        service.create({
          paymentDate: "2026-10-23",
          vendorName: "Steel Corp",
          amount: 1000,
          paymentModeId: 4,
          bankAccountId: 2,
          supplierId: 999,
        }),
      ).rejects.toThrow(ResourceNotFoundException);
    });

    it("rejects a billId with no supplierId", async () => {
      const { service } = makeService();

      await expect(
        service.create({
          paymentDate: "2026-10-23",
          vendorName: "Steel Corp",
          amount: 1000,
          paymentModeId: 4,
          bankAccountId: 2,
          billId: 8,
        }),
      ).rejects.toThrow(BusinessRuleViolationException);
    });

    it("throws ResourceNotFoundException for non-existent billId", async () => {
      const { service, prisma } = makeService();
      prisma.scmSupplierBill.findFirst.mockResolvedValue(null);

      await expect(
        service.create({
          paymentDate: "2026-10-23",
          vendorName: "Steel Corp",
          amount: 1000,
          paymentModeId: 4,
          bankAccountId: 2,
          supplierId: 14,
          billId: 999,
        }),
      ).rejects.toThrow(ResourceNotFoundException);
    });

    it("rejects a bill that belongs to a different supplier", async () => {
      const { service, prisma } = makeService();
      prisma.scmSupplierBill.findFirst.mockResolvedValue({
        id: 8,
        supplierId: 999,
        status: "OPEN",
        billNumber: "TW/BILL/26-27/0008",
      });

      await expect(
        service.create({
          paymentDate: "2026-10-23",
          vendorName: "Steel Corp",
          amount: 1000,
          paymentModeId: 4,
          bankAccountId: 2,
          supplierId: 14,
          billId: 8,
        }),
      ).rejects.toThrow(BusinessRuleViolationException);
    });

    it("rejects a bill that is not in a payable state", async () => {
      const { service, prisma } = makeService();
      prisma.scmSupplierBill.findFirst.mockResolvedValue({
        id: 8,
        supplierId: 14,
        status: "CANCELLED",
        billNumber: "TW/BILL/26-27/0008",
      });

      await expect(
        service.create({
          paymentDate: "2026-10-23",
          vendorName: "Steel Corp",
          amount: 1000,
          paymentModeId: 4,
          bankAccountId: 2,
          supplierId: 14,
          billId: 8,
        }),
      ).rejects.toThrow(BusinessRuleViolationException);
    });

    it("persists supplierId and billId on the created record", async () => {
      const { service, repository } = makeService();

      await service.create({
        paymentDate: "2026-10-23",
        vendorName: "Steel Corp",
        amount: 1000,
        paymentModeId: 4,
        bankAccountId: 2,
        supplierId: 14,
        billId: 8,
        status: "DRAFT",
      });

      expect(repository.create).toHaveBeenCalledWith(
        SCOPE,
        expect.objectContaining({ supplierId: 14, billId: 8 }),
      );
    });
  });

  describe("Confirm Disbursement", () => {
    it("rejects confirming already confirmed payment", async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue(MOCK_PAYMENT_CONFIRMED);

      await expect(service.confirm(11)).rejects.toThrow(
        BusinessRuleViolationException,
      );
    });

    it("rejects confirming voided payment", async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue(MOCK_PAYMENT_VOID);

      await expect(service.confirm(12)).rejects.toThrow(
        BusinessRuleViolationException,
      );
    });

    it("throws BusinessRuleViolationException when Accounts Payable account is missing", async () => {
      const { service, prisma } = makeService();
      prisma.financeAccount.findFirst.mockResolvedValue(null);

      await expect(service.confirm(10)).rejects.toThrow(
        BusinessRuleViolationException,
      );
    });

    it("does not call the SCM engine when no bill is linked", async () => {
      const { service, repository, scmFinance } = makeService();

      await service.confirm(10);

      expect(scmFinance.createPayment).not.toHaveBeenCalled();
      const call = repository.postAndConfirmPayment.mock.calls[0] as unknown[];
      expect(call[6]).toBeUndefined();
    });

    it("applies the payment to the real bill through the SCM engine, in the same transaction, and links scmSupplierPaymentId", async () => {
      const { service, repository, prisma, scmFinance } = makeService();
      repository.findById.mockResolvedValue(MOCK_PAYMENT_WITH_BILL);
      scmFinance.createPayment.mockResolvedValue({
        id: 301,
        paymentNumber: "TW/PAY/26-27/0002",
      });

      await service.confirm(20);

      expect(scmFinance.createPayment).toHaveBeenCalledTimes(1);
      const [payload, tx] = scmFinance.createPayment.mock.calls[0] as [
        {
          supplierId: number;
          billId: number;
          mode: string;
          amount: number;
        },
        unknown,
      ];
      expect(payload.supplierId).toBe(14);
      expect(payload.billId).toBe(8);
      expect(payload.mode).toBe("BANK_TRANSFER");
      expect(payload.amount).toBe(3500);
      // Run inside the same `prisma.$transaction` this service opened, not a
      // separate one — that's the whole point of the atomicity exception.
      expect(tx).toBe(prisma);

      const confirmCall = repository.postAndConfirmPayment.mock
        .calls[0] as unknown[];
      expect(confirmCall[6]).toBe(301);
      expect(confirmCall[7]).toBe(prisma);
    });

    it("rolls back without posting GL/bank when the SCM engine rejects the bill (e.g. overpayment)", async () => {
      const { service, repository, scmFinance } = makeService();
      repository.findById.mockResolvedValue(MOCK_PAYMENT_WITH_BILL);
      scmFinance.createPayment.mockRejectedValue(
        new BusinessRuleViolationException(
          "The payment exceeds the outstanding balance.",
          "PAYMENT_OVERPAY",
        ),
      );

      await expect(service.confirm(20)).rejects.toThrow(
        BusinessRuleViolationException,
      );
      expect(repository.postAndConfirmPayment).not.toHaveBeenCalled();
    });
  });

  describe("Update Disbursement", () => {
    it("updates metadata on a DRAFT payment", async () => {
      const { service, repository } = makeService();

      await service.update(10, {
        vendorName: "Updated Steel Corp",
        notes: "Updated",
      });

      expect(repository.update).toHaveBeenCalledWith(
        SCOPE,
        10,
        expect.objectContaining({
          vendorName: "Updated Steel Corp",
          notes: "Updated",
        }),
      );
    });

    it("rejects updating a CONFIRMED payment and does not mutate repository", async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue(MOCK_PAYMENT_CONFIRMED);

      await expect(
        service.update(11, { vendorName: "New Name" }),
      ).rejects.toThrow(BusinessRuleViolationException);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it("rejects updating a RECONCILED payment and does not mutate repository", async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue(MOCK_PAYMENT_RECONCILED);

      await expect(
        service.update(13, { vendorName: "New Name" }),
      ).rejects.toThrow(BusinessRuleViolationException);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it("rejects updating a VOID payment and does not mutate repository", async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue(MOCK_PAYMENT_VOID);

      await expect(
        service.update(12, { vendorName: "New Name" }),
      ).rejects.toThrow(BusinessRuleViolationException);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it("rejects update when paymentDate is in the future and does not mutate repository", async () => {
      const { service, repository } = makeService();

      await expect(
        service.update(10, { paymentDate: "2099-01-01" }),
      ).rejects.toThrow(BusinessRuleViolationException);
      expect(repository.update).not.toHaveBeenCalled();
    });
  });

  describe("Void and Reversal", () => {
    it("rejects voiding already voided payment", async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue(MOCK_PAYMENT_VOID);

      await expect(service.void(12)).rejects.toThrow(
        BusinessRuleViolationException,
      );
    });

    it("voids CONFIRMED payment and generates balanced GL reversal voucher", async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue(MOCK_PAYMENT_CONFIRMED);

      await service.void(11);

      expect(repository.voidAndReversePayment).toHaveBeenCalled();
      const voidCall = repository.voidAndReversePayment.mock.calls[0] as [
        unknown,
        number,
        {
          originalJournalEntryId: number;
          lines: Array<{ accountId: number; debit: number; credit: number }>;
        },
        unknown,
        { id: number; delta: number },
        number,
      ];
      expect(voidCall[0]).toEqual(SCOPE);
      expect(voidCall[1]).toBe(11);
      expect(voidCall[2].originalJournalEntryId).toBe(99);
      expect(voidCall[2].lines[0]?.accountId).toBe(50);
      expect(voidCall[2].lines[0]?.debit).toBe(0);
      expect(voidCall[2].lines[0]?.credit).toBe(3500);
      expect(voidCall[2].lines[1]?.accountId).toBe(20);
      expect(voidCall[2].lines[1]?.debit).toBe(3500);
      expect(voidCall[2].lines[1]?.credit).toBe(0);
      expect(voidCall[4].id).toBe(2);
      expect(voidCall[4].delta).toBe(3500);
      expect(voidCall[5]).toBe(USER_ID);
    });

    it("voids DRAFT payment without GL reversal voucher", async () => {
      const { service, repository } = makeService();

      await service.void(10);

      expect(repository.voidAndReversePayment).toHaveBeenCalledWith(
        SCOPE,
        10,
        null,
        [],
        null,
        USER_ID,
      );
    });

    it("does not call the SCM engine when the payment has no linked SCM payment", async () => {
      const { service, repository, scmFinance } = makeService();
      repository.findById.mockResolvedValue(MOCK_PAYMENT_CONFIRMED);

      await service.void(11);

      expect(scmFinance.voidPayment).not.toHaveBeenCalled();
    });

    it("voids the linked SCM supplier payment (restoring the bill's outstanding) in the same transaction as the GL reversal", async () => {
      const { service, repository, prisma, scmFinance } = makeService();
      repository.findById.mockResolvedValue(
        MOCK_PAYMENT_CONFIRMED_WITH_SCM_LINK,
      );

      await service.void(21, "Customer requested cancellation");

      expect(scmFinance.voidPayment).toHaveBeenCalledTimes(1);
      const [id, reason, tx] = scmFinance.voidPayment.mock.calls[0] as [
        number,
        string,
        unknown,
      ];
      expect(id).toBe(301);
      expect(reason).toBe("Customer requested cancellation");
      expect(tx).toBe(prisma);
      expect(repository.voidAndReversePayment).toHaveBeenCalled();
    });

    it("falls back to a generated reason when none is given", async () => {
      const { service, repository, scmFinance } = makeService();
      repository.findById.mockResolvedValue(
        MOCK_PAYMENT_CONFIRMED_WITH_SCM_LINK,
      );

      await service.void(21);

      const [, reason] = scmFinance.voidPayment.mock.calls[0] as [
        number,
        string,
      ];
      expect(reason).toContain(
        MOCK_PAYMENT_CONFIRMED_WITH_SCM_LINK.paymentNumber,
      );
    });
  });

  describe("Delete Disbursement", () => {
    it("rejects deleting a CONFIRMED disbursement", async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue(MOCK_PAYMENT_CONFIRMED);

      await expect(service.delete(11)).rejects.toThrow(
        BusinessRuleViolationException,
      );
    });

    it("allows soft-deleting DRAFT disbursement", async () => {
      const { service, repository } = makeService();

      await service.delete(10);

      expect(repository.softDelete).toHaveBeenCalledWith(SCOPE, 10, USER_ID);
    });
  });
});
