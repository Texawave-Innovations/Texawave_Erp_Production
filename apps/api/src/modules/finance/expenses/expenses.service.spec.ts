import { describe, expect, it, vi } from "vitest";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import {
  BusinessRuleViolationException,
  InvalidStateTransitionException,
  ResourceConflictException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import { ExpensesService } from "./expenses.service.js";
import type { CreateExpenseDto } from "./dto/create-expense.dto.js";
import { QueryExpensesDto } from "./dto/query-expenses.dto.js";

const SCOPE = { organizationId: 1 };
const USER_ID = 42;

const DRAFT_EXPENSE = {
  id: 10,
  organizationId: 1,
  expenseNumber: "EXP-202610-0001",
  expenseTypeId: 1,
  expenseDate: "2026-10-23T00:00:00.000Z",
  amount: "1000.00",
  taxAmount: "180.00",
  netAmount: "1180.00",
  status: "DRAFT",
  paymentModeId: 2,
  bankAccountId: null,
  glAccountId: 100,
  vendorName: "Acme Corp",
  notes: "Office Supplies",
  journalEntryId: null,
  hrExpenseClaimId: null,
  deletedAt: null,
};

function makeService() {
  const repository = {
    findMany: vi.fn().mockResolvedValue({ items: [DRAFT_EXPENSE], total: 1 }),
    findById: vi.fn().mockResolvedValue(DRAFT_EXPENSE),
    findByExpenseNumber: vi.fn().mockResolvedValue(null),
    findByHrExpenseClaimId: vi.fn().mockResolvedValue(null),
    generateNextExpenseNumber: vi.fn().mockResolvedValue("EXP-202610-0001"),
    create: vi.fn().mockResolvedValue(DRAFT_EXPENSE),
    update: vi.fn().mockResolvedValue({ ...DRAFT_EXPENSE, notes: "Updated" }),
    updateStatus: vi
      .fn()
      .mockResolvedValue({ ...DRAFT_EXPENSE, status: "PENDING_APPROVAL" }),
    softDelete: vi.fn().mockResolvedValue(true),
    payAndPostExpense: vi.fn().mockResolvedValue({
      ...DRAFT_EXPENSE,
      status: "PAID",
      journalEntryId: 50,
    }),
    cancelAndReverseExpense: vi
      .fn()
      .mockResolvedValue({ ...DRAFT_EXPENSE, status: "CANCELLED" }),
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
        id: 1,
        value: "Office Supplies",
        category: "expense_type",
      }),
    },
    financeBankAccount: {
      findFirst: vi.fn().mockResolvedValue({
        id: 1,
        accountName: "Operating Account",
        glAccountId: 200,
      }),
    },
    financeAccount: {
      findFirst: vi.fn().mockResolvedValue({
        id: 100,
        accountCode: "5020",
        accountName: "Office Supplies",
        accountType: "EXPENSE",
      }),
    },
    financeJournalEntry: {
      findFirst: vi.fn().mockResolvedValue({
        id: 50,
        entryNumber: "JV-202610-0001",
        totalDebit: "1180.00",
        totalCredit: "1180.00",
        lines: [
          {
            accountId: 100,
            lineOrder: 0,
            debit: "1180.00",
            credit: "0.00",
            account: { accountType: "EXPENSE" },
          },
          {
            accountId: 200,
            lineOrder: 1,
            debit: "0.00",
            credit: "1180.00",
            account: { accountType: "ASSET" },
          },
        ],
      }),
    },
    expenseClaim: {
      findFirst: vi.fn().mockResolvedValue({
        id: 88,
        organizationId: 1,
        expenseType: "Travel",
        amount: "3500.00",
        expenseDate: new Date("2026-10-20"),
        description: "Client travel reimbursement",
        receiptRef: "https://rec.pdf",
        status: "APPROVED",
        employee: {
          id: 1,
          fullName: "Alice Smith",
          employeeCode: "EMP001",
        },
      }),
    },
  };

  const service = new ExpensesService(
    repository as never,
    journalRepository as never,
    tenantContext as never,
    prisma as never,
  );

  return { service, repository, journalRepository, prisma };
}

describe("ExpensesService", () => {
  describe("findAll() and findOne()", () => {
    it("findAll() returns paginated response", async () => {
      const { service, repository } = makeService();
      const query = Object.assign(new QueryExpensesDto(), {
        page: 1,
        limit: 10,
      });

      const result = await service.findAll(query);

      expect(repository.findMany).toHaveBeenCalledWith(SCOPE, query);
      expect(result).toBeInstanceOf(PaginatedResponseDto);
      expect(result.items).toEqual([DRAFT_EXPENSE]);
    });

    it("findOne() returns expense when found", async () => {
      const { service, repository } = makeService();

      const result = await service.findOne(10);

      expect(repository.findById).toHaveBeenCalledWith(SCOPE, 10);
      expect(result).toEqual(DRAFT_EXPENSE);
    });

    it("findOne() throws ResourceNotFoundException when missing", async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(
        ResourceNotFoundException,
      );
    });
  });

  describe("create() validation", () => {
    it("creates draft expense when inputs are valid", async () => {
      const { service, repository } = makeService();
      const dto: CreateExpenseDto = {
        expenseTypeId: 1,
        expenseDate: "2026-10-23",
        amount: 1000,
        taxAmount: 180,
        paymentModeId: 2,
        glAccountId: 100,
        notes: "Office supplies",
      };

      const result = await service.create(dto);

      expect(repository.create).toHaveBeenCalled();
      const [createScope, createData] = repository.create.mock.calls[0] as [
        unknown,
        Record<string, unknown>,
      ];
      expect(createScope).toEqual(SCOPE);
      expect(createData.expenseNumber).toBe("EXP-202610-0001");
      expect(createData.netAmount).toBe(1180);
      expect(result).toEqual(DRAFT_EXPENSE);
    });

    it("throws BusinessRuleViolationException when expenseDate is in future", async () => {
      const { service } = makeService();
      const dto: CreateExpenseDto = {
        expenseTypeId: 1,
        expenseDate: "2099-12-31",
        amount: 500,
      };

      await expect(service.create(dto)).rejects.toThrow(
        BusinessRuleViolationException,
      );
    });

    it("throws ResourceNotFoundException when expenseTypeId is invalid", async () => {
      const { service, prisma } = makeService();
      prisma.financeMasterListItem.findFirst.mockResolvedValue(null);

      const dto: CreateExpenseDto = {
        expenseTypeId: 999,
        expenseDate: "2026-10-23",
        amount: 500,
      };

      await expect(service.create(dto)).rejects.toThrow(
        ResourceNotFoundException,
      );
    });

    it("throws ResourceConflictException when expenseNumber is already used", async () => {
      const { service, repository } = makeService();
      repository.findByExpenseNumber.mockResolvedValue(DRAFT_EXPENSE);

      const dto: CreateExpenseDto = {
        expenseNumber: "EXP-202610-0001",
        expenseTypeId: 1,
        expenseDate: "2026-10-23",
        amount: 500,
      };

      await expect(service.create(dto)).rejects.toThrow(
        ResourceConflictException,
      );
    });

    it("throws BusinessRuleViolationException when glAccount is not EXPENSE or ASSET", async () => {
      const { service, prisma } = makeService();
      prisma.financeAccount.findFirst.mockResolvedValue({
        id: 300,
        accountCode: "4010",
        accountType: "REVENUE",
      });

      const dto: CreateExpenseDto = {
        expenseTypeId: 1,
        expenseDate: "2026-10-23",
        amount: 500,
        glAccountId: 300,
      };

      await expect(service.create(dto)).rejects.toThrow(
        BusinessRuleViolationException,
      );
    });
  });

  describe("update() lifecycle rules", () => {
    it("updates editable draft expense", async () => {
      const { service, repository } = makeService();

      const result = await service.update(10, { notes: "Updated note" });

      expect(repository.update).toHaveBeenCalled();
      expect(result?.notes).toBe("Updated");
    });

    it("throws BusinessRuleViolationException when editing PAID expense", async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue({
        ...DRAFT_EXPENSE,
        status: "PAID",
      });

      await expect(
        service.update(10, { notes: "Should fail" }),
      ).rejects.toThrow(BusinessRuleViolationException);
    });

    it("throws BusinessRuleViolationException when editing CANCELLED expense", async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue({
        ...DRAFT_EXPENSE,
        status: "CANCELLED",
      });

      await expect(
        service.update(10, { notes: "Should fail" }),
      ).rejects.toThrow(BusinessRuleViolationException);
    });
  });

  describe("Approval workflow", () => {
    it("submit() moves DRAFT to PENDING_APPROVAL", async () => {
      const { service, repository } = makeService();

      await service.submit(10);

      expect(repository.updateStatus).toHaveBeenCalledWith(
        SCOPE,
        10,
        ["DRAFT"],
        "PENDING_APPROVAL",
        USER_ID,
      );
    });

    it("submit() throws InvalidStateTransitionException if not DRAFT", async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue({
        ...DRAFT_EXPENSE,
        status: "APPROVED",
      });

      await expect(service.submit(10)).rejects.toThrow(
        InvalidStateTransitionException,
      );
    });

    it("approve() moves PENDING_APPROVAL to APPROVED", async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue({
        ...DRAFT_EXPENSE,
        status: "PENDING_APPROVAL",
      });

      await service.approve(10);

      expect(repository.updateStatus).toHaveBeenCalledWith(
        SCOPE,
        10,
        ["PENDING_APPROVAL"],
        "APPROVED",
        USER_ID,
      );
    });

    it("reject() moves PENDING_APPROVAL back to DRAFT", async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue({
        ...DRAFT_EXPENSE,
        status: "PENDING_APPROVAL",
      });

      await service.reject(10);

      expect(repository.updateStatus).toHaveBeenCalledWith(
        SCOPE,
        10,
        ["PENDING_APPROVAL"],
        "DRAFT",
        USER_ID,
      );
    });
  });

  describe("GL Accounting & Payment", () => {
    it("pay() generates balanced journal voucher and posts to GL", async () => {
      const { service, repository, journalRepository } = makeService();
      repository.findById.mockResolvedValue({
        ...DRAFT_EXPENSE,
        status: "APPROVED",
      });

      const result = await service.pay(10, {
        paymentModeId: 2,
        bankAccountId: 1,
      });

      expect(journalRepository.generateNextEntryNumber).toHaveBeenCalledWith(
        SCOPE,
        "JV",
      );
      expect(repository.payAndPostExpense).toHaveBeenCalled();
      expect(result?.status).toBe("PAID");
      expect(result?.journalEntryId).toBe(50);
    });

    it("pay() throws BusinessRuleViolationException if already PAID", async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue({
        ...DRAFT_EXPENSE,
        status: "PAID",
      });

      await expect(service.pay(10)).rejects.toThrow(
        BusinessRuleViolationException,
      );
    });

    it("cancel() generates reversal journal entry when expense was PAID", async () => {
      const { service, repository, journalRepository, prisma } = makeService();
      repository.findById.mockResolvedValue({
        ...DRAFT_EXPENSE,
        status: "PAID",
        journalEntryId: 50,
      });

      await service.cancel(10);

      expect(prisma.financeJournalEntry.findFirst).toHaveBeenCalled();
      expect(journalRepository.generateNextEntryNumber).toHaveBeenCalledWith(
        SCOPE,
        "REV",
      );
      expect(repository.cancelAndReverseExpense).toHaveBeenCalled();
    });

    it("cancel() marks CANCELLED directly when expense was DRAFT", async () => {
      const { service, repository } = makeService();

      await service.cancel(10);

      expect(repository.cancelAndReverseExpense).toHaveBeenCalledWith(
        SCOPE,
        10,
        null,
        [],
        USER_ID,
      );
    });
  });

  describe("delete() restrictions", () => {
    it("soft deletes DRAFT expense", async () => {
      const { service, repository } = makeService();

      await service.delete(10);

      expect(repository.softDelete).toHaveBeenCalledWith(SCOPE, 10, USER_ID);
    });

    it("throws BusinessRuleViolationException when deleting PAID expense", async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue({
        ...DRAFT_EXPENSE,
        status: "PAID",
      });

      await expect(service.delete(10)).rejects.toThrow(
        BusinessRuleViolationException,
      );
    });
  });

  describe("createFromClaim()", () => {
    it("creates approved finance expense from approved HR claim", async () => {
      const { service, repository, prisma } = makeService();

      const result = await service.createFromClaim(88, {
        notes: "HR Reimbursement",
      });

      expect(prisma.expenseClaim.findFirst).toHaveBeenCalledWith({
        where: { id: 88, organizationId: 1 },
        include: {
          employee: {
            select: {
              id: true,
              fullName: true,
              employeeCode: true,
            },
          },
        },
      });
      expect(repository.create).toHaveBeenCalled();
      const [createScope, createData] = repository.create.mock.calls[0] as [
        unknown,
        Record<string, unknown>,
      ];
      expect(createScope).toEqual(SCOPE);
      expect(createData.hrExpenseClaimId).toBe(88);
      expect(createData.amount).toBe(3500);
      expect(createData.status).toBe("APPROVED");
      expect(createData.vendorName).toBe("Reimbursement: Alice Smith (EMP001)");
      expect(result).toBeDefined();
    });

    it("throws BusinessRuleViolationException if claim is not APPROVED", async () => {
      const { service, prisma } = makeService();
      prisma.expenseClaim.findFirst.mockResolvedValue({
        id: 88,
        organizationId: 1,
        status: "PENDING",
      });

      await expect(service.createFromClaim(88, {})).rejects.toThrow(
        BusinessRuleViolationException,
      );
    });

    it("throws ResourceConflictException if claim is already converted", async () => {
      const { service, repository } = makeService();
      repository.findByHrExpenseClaimId.mockResolvedValue(DRAFT_EXPENSE);

      await expect(service.createFromClaim(88, {})).rejects.toThrow(
        ResourceConflictException,
      );
    });
  });
});
