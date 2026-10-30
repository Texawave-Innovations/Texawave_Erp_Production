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
      create: vi
        .fn()
        .mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({
            id: 99,
            ...data,
          }),
        ),
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

    it("preserves Medical category by auto-provisioning when not yet present in master list", async () => {
      const { service, repository, prisma } = makeService();
      prisma.expenseClaim.findFirst.mockResolvedValue({
        id: 8,
        organizationId: 1,
        expenseType: "Medical",
        amount: "5000.00",
        expenseDate: new Date("2026-10-28"),
        description: "medic emergency",
        receiptRef: null,
        status: "APPROVED",
        employee: {
          fullName: "employee demo",
          employeeCode: "EMP-000002",
        },
      });

      // No item initially exists
      prisma.financeMasterListItem.findFirst.mockResolvedValue(null);
      prisma.financeMasterListItem.create.mockResolvedValue({
        id: 25,
        value: "Medical",
        category: "expense_type",
      });

      await service.createFromClaim(8, {
        notes: "Medical claim reimbursement",
      });

      expect(prisma.financeMasterListItem.create).toHaveBeenCalledWith({
        data: {
          organizationId: 1,
          category: "expense_type",
          value: "Medical",
          isActive: true,
          createdBy: USER_ID,
          updatedBy: USER_ID,
        },
      });

      const [, createData] = repository.create.mock.calls[0] as [
        unknown,
        Record<string, unknown>,
      ];
      expect(createData.expenseTypeId).toBe(25);
      expect(createData.hrExpenseClaimId).toBe(8);
      expect(createData.amount).toBe(5000);
      expect(createData.vendorName).toBe(
        "Reimbursement: employee demo (EMP-000002)",
      );
    });

    it("preserves Medical category when already present in master list", async () => {
      const { service, repository, prisma } = makeService();
      prisma.expenseClaim.findFirst.mockResolvedValue({
        id: 8,
        organizationId: 1,
        expenseType: "Medical",
        amount: "5000.00",
        expenseDate: new Date("2026-10-28"),
        description: "medic emergency",
        receiptRef: null,
        status: "APPROVED",
        employee: {
          fullName: "employee demo",
          employeeCode: "EMP-000002",
        },
      });

      prisma.financeMasterListItem.findFirst.mockResolvedValue({
        id: 11,
        value: "Medical",
        category: "expense_type",
      });

      await service.createFromClaim(8, {});

      expect(prisma.financeMasterListItem.create).not.toHaveBeenCalled();
      const [, createData] = repository.create.mock.calls[0] as [
        unknown,
        Record<string, unknown>,
      ];
      expect(createData.expenseTypeId).toBe(11);
    });

    it("maps Travel claim to Travel & Lodging category", async () => {
      const { service, repository, prisma } = makeService();
      prisma.expenseClaim.findFirst.mockResolvedValue({
        id: 88,
        organizationId: 1,
        expenseType: "Travel",
        amount: "3500.00",
        expenseDate: new Date("2026-10-20"),
        description: "Travel expenses",
        status: "APPROVED",
        employee: { fullName: "Alice Smith", employeeCode: "EMP001" },
      });

      prisma.financeMasterListItem.findFirst.mockResolvedValue({
        id: 2,
        value: "Travel & Lodging",
        category: "expense_type",
      });

      await service.createFromClaim(88, {});

      const [, createData] = repository.create.mock.calls[0] as [
        unknown,
        Record<string, unknown>,
      ];
      expect(createData.expenseTypeId).toBe(2);
    });

    it("maps Food claim to Food & Meals category", async () => {
      const { service, repository, prisma } = makeService();
      prisma.expenseClaim.findFirst.mockResolvedValue({
        id: 89,
        organizationId: 1,
        expenseType: "Food",
        amount: "1200.00",
        expenseDate: new Date("2026-10-21"),
        status: "APPROVED",
        employee: { fullName: "Bob", employeeCode: "EMP002" },
      });

      prisma.financeMasterListItem.findFirst.mockResolvedValue(null);
      prisma.financeMasterListItem.create.mockResolvedValue({
        id: 26,
        value: "Food & Meals",
        category: "expense_type",
      });

      await service.createFromClaim(89, {});

      expect(prisma.financeMasterListItem.create).toHaveBeenCalled();
      const [foodCall] = prisma.financeMasterListItem.create.mock.calls[0] as [
        { data: { value: string; category: string } },
      ];
      expect(foodCall.data.value).toBe("Food & Meals");
      expect(foodCall.data.category).toBe("expense_type");
      const [, createData] = repository.create.mock.calls[0] as [
        unknown,
        Record<string, unknown>,
      ];
      expect(createData.expenseTypeId).toBe(26);
    });

    it("maps Accommodation claim to Accommodation category", async () => {
      const { service, repository, prisma } = makeService();
      prisma.expenseClaim.findFirst.mockResolvedValue({
        id: 90,
        organizationId: 1,
        expenseType: "Accommodation",
        amount: "4500.00",
        expenseDate: new Date("2026-10-22"),
        status: "APPROVED",
        employee: { fullName: "Carol", employeeCode: "EMP003" },
      });

      prisma.financeMasterListItem.findFirst.mockResolvedValue(null);
      prisma.financeMasterListItem.create.mockResolvedValue({
        id: 27,
        value: "Accommodation",
        category: "expense_type",
      });

      await service.createFromClaim(90, {});

      expect(prisma.financeMasterListItem.create).toHaveBeenCalled();
      const [accomCall] = prisma.financeMasterListItem.create.mock.calls[0] as [
        { data: { value: string; category: string } },
      ];
      expect(accomCall.data.value).toBe("Accommodation");
      expect(accomCall.data.category).toBe("expense_type");
      const [, createData] = repository.create.mock.calls[0] as [
        unknown,
        Record<string, unknown>,
      ];
      expect(createData.expenseTypeId).toBe(27);
    });

    it("maps Other claim to Other category", async () => {
      const { service, repository, prisma } = makeService();
      prisma.expenseClaim.findFirst.mockResolvedValue({
        id: 91,
        organizationId: 1,
        expenseType: "Other",
        amount: "800.00",
        expenseDate: new Date("2026-10-23"),
        status: "APPROVED",
        employee: { fullName: "Dave", employeeCode: "EMP004" },
      });

      prisma.financeMasterListItem.findFirst.mockResolvedValue(null);
      prisma.financeMasterListItem.create.mockResolvedValue({
        id: 28,
        value: "Other",
        category: "expense_type",
      });

      await service.createFromClaim(91, {});

      expect(prisma.financeMasterListItem.create).toHaveBeenCalled();
      const [otherCall] = prisma.financeMasterListItem.create.mock.calls[0] as [
        { data: { value: string; category: string } },
      ];
      expect(otherCall.data.value).toBe("Other");
      expect(otherCall.data.category).toBe("expense_type");
      const [, createData] = repository.create.mock.calls[0] as [
        unknown,
        Record<string, unknown>,
      ];
      expect(createData.expenseTypeId).toBe(28);
    });

    it("throws BusinessRuleViolationException and never silently falls back to Office Supplies for unsupported category", async () => {
      const { service, repository, prisma } = makeService();
      prisma.expenseClaim.findFirst.mockResolvedValue({
        id: 92,
        organizationId: 1,
        expenseType: "CryptoTokens",
        amount: "1000.00",
        status: "APPROVED",
      });
      prisma.financeMasterListItem.findFirst.mockResolvedValue(null);

      await expect(service.createFromClaim(92, {})).rejects.toThrow(
        BusinessRuleViolationException,
      );
      expect(repository.create).not.toHaveBeenCalled();
    });

    it("preserves paymentModeId, bankAccountId, glAccountId, notes, and receiptUrl", async () => {
      const { service, repository, prisma } = makeService();
      prisma.expenseClaim.findFirst.mockResolvedValue({
        id: 93,
        organizationId: 1,
        expenseType: "Office Supplies",
        amount: "750.00",
        expenseDate: new Date("2026-10-25"),
        description: "Printer toner cartridge",
        receiptRef: "https://storage.texawave.com/receipts/toner.pdf",
        status: "APPROVED",
        employee: { fullName: "Eve", employeeCode: "EMP005" },
      });

      prisma.financeMasterListItem.findFirst.mockResolvedValue({
        id: 1,
        value: "Office Supplies",
        category: "expense_type",
      });

      await service.createFromClaim(93, {
        paymentModeId: 6,
        bankAccountId: 2,
        glAccountId: 9,
        notes: "Approved stationery reimbursement",
      });

      const [, createData] = repository.create.mock.calls[0] as [
        unknown,
        Record<string, unknown>,
      ];
      expect(createData.expenseTypeId).toBe(1);
      expect(createData.paymentModeId).toBe(6);
      expect(createData.bankAccountId).toBe(2);
      expect(createData.glAccountId).toBe(9);
      expect(createData.notes).toBe("Approved stationery reimbursement");
      expect(createData.receiptUrl).toBe(
        "https://storage.texawave.com/receipts/toner.pdf",
      );
      expect(createData.hrExpenseClaimId).toBe(93);
    });
  });
});
