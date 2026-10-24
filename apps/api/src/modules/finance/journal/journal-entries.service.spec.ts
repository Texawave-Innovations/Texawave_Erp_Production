import { describe, expect, it, vi } from "vitest";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import {
  BusinessRuleViolationException,
  InvalidStateTransitionException,
  ResourceConflictException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import { JournalEntriesService } from "./journal-entries.service.js";
import type { CreateJournalEntryDto } from "./dto/create-journal-entry.dto.js";
import type { QueryJournalEntriesDto } from "./dto/query-journal-entries.dto.js";

const SCOPE = { organizationId: 1 };
const USER_ID = 42;

const CASH_ACCOUNT = {
  id: 10,
  organizationId: 1,
  accountCode: "1010",
  accountName: "Cash on Hand",
  accountType: "ASSET",
  isActive: true,
};

const RENT_EXPENSE_ACCOUNT = {
  id: 20,
  organizationId: 1,
  accountCode: "5010",
  accountName: "Office Rent",
  accountType: "EXPENSE",
  isActive: true,
};

const SALES_REVENUE_ACCOUNT = {
  id: 30,
  organizationId: 1,
  accountCode: "4010",
  accountName: "Sales Revenue",
  accountType: "REVENUE",
  isActive: true,
};

const INACTIVE_ACCOUNT = {
  id: 40,
  organizationId: 1,
  accountCode: "1099",
  accountName: "Deprecated Reserve",
  accountType: "ASSET",
  isActive: false,
};

const DRAFT_ENTRY = {
  id: 100,
  organizationId: 1,
  entryNumber: "JV-202610-0001",
  entryDate: new Date("2026-10-23"),
  entryType: "MANUAL",
  narration: "Rent payment voucher",
  referenceNumber: "INV-101",
  totalDebit: 1500,
  totalCredit: 1500,
  status: "DRAFT",
  postedAt: null,
  postedBy: null,
  reversedEntryId: null,
  lines: [
    {
      id: 1,
      journalEntryId: 100,
      accountId: 20, // Rent Expense
      lineOrder: 0,
      description: "Debit rent expense",
      debit: 1500,
      credit: 0,
      account: RENT_EXPENSE_ACCOUNT,
    },
    {
      id: 2,
      journalEntryId: 100,
      accountId: 10, // Cash
      lineOrder: 1,
      description: "Credit cash",
      debit: 0,
      credit: 1500,
      account: CASH_ACCOUNT,
    },
  ],
};

const POSTED_ENTRY = {
  ...DRAFT_ENTRY,
  status: "POSTED",
  postedAt: new Date("2026-10-23T10:00:00Z"),
  postedBy: USER_ID,
};

function makeService() {
  const repository = {
    findMany: vi.fn(),
    findById: vi.fn(),
    findByEntryNumber: vi.fn(),
    generateNextEntryNumber: vi.fn().mockResolvedValue("JV-202610-0001"),
    createDraft: vi.fn(),
    updateDraft: vi.fn(),
    postEntry: vi.fn(),
    reverseEntry: vi.fn(),
    deleteDraft: vi.fn(),
  };

  const accountsRepository = {
    findById: vi.fn((_scope, id: number) => {
      if (id === 10) return Promise.resolve(CASH_ACCOUNT);
      if (id === 20) return Promise.resolve(RENT_EXPENSE_ACCOUNT);
      if (id === 30) return Promise.resolve(SALES_REVENUE_ACCOUNT);
      if (id === 40) return Promise.resolve(INACTIVE_ACCOUNT);
      return Promise.resolve(null);
    }),
  };

  const tenantContext = {
    getOrgScope: vi.fn().mockReturnValue(SCOPE),
    getUserId: vi.fn().mockReturnValue(USER_ID),
  };

  const service = new JournalEntriesService(
    repository as never,
    accountsRepository as never,
    tenantContext as never,
  );

  return { service, repository, accountsRepository, tenantContext };
}

describe("JournalEntriesService", () => {
  describe("findAll() & findOne()", () => {
    it("delegates to repository with tenant scope and wraps in PaginatedResponseDto", async () => {
      const { service, repository } = makeService();
      repository.findMany.mockResolvedValue({
        items: [DRAFT_ENTRY],
        total: 1,
      });

      const query: QueryJournalEntriesDto = {
        page: 1,
        limit: 10,
        skip: 0,
      } as QueryJournalEntriesDto;
      const result = await service.findAll(query);

      expect(repository.findMany).toHaveBeenCalledWith(SCOPE, query);
      expect(result).toBeInstanceOf(PaginatedResponseDto);
      expect(result.items).toHaveLength(1);
    });

    it("returns entry when found", async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue(DRAFT_ENTRY);

      const result = await service.findOne(100);
      expect(repository.findById).toHaveBeenCalledWith(SCOPE, 100);
      expect(result).toBe(DRAFT_ENTRY);
    });

    it("throws ResourceNotFoundException when entry is missing", async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(
        ResourceNotFoundException,
      );
    });
  });

  describe("create() validation & drafting", () => {
    it("creates a draft voucher when debits equal credits", async () => {
      const { service, repository } = makeService();
      repository.createDraft.mockResolvedValue(DRAFT_ENTRY);

      const dto: CreateJournalEntryDto = {
        entryDate: "2026-10-23",
        narration: "Rent payment voucher",
        lines: [
          { accountId: 20, debit: 1500, credit: 0 },
          { accountId: 10, debit: 0, credit: 1500 },
        ],
      };

      const result = await service.create(dto);
      const [calledScope, calledData, calledUserId] = repository.createDraft
        .mock.calls[0] as [
        unknown,
        {
          entryNumber: string;
          totalDebit: number;
          totalCredit: number;
          lines: Array<{ accountId: number; debit: number; credit: number }>;
        },
        number,
      ];
      expect(calledScope).toEqual(SCOPE);
      expect(calledUserId).toBe(USER_ID);
      expect(calledData.entryNumber).toBe("JV-202610-0001");
      expect(calledData.totalDebit).toBe(1500);
      expect(calledData.totalCredit).toBe(1500);
      expect(calledData.lines).toEqual([
        {
          accountId: 20,
          debit: 1500,
          credit: 0,
          lineOrder: 0,
          description: null,
        },
        {
          accountId: 10,
          debit: 0,
          credit: 1500,
          lineOrder: 1,
          description: null,
        },
      ]);
      expect(result).toBe(DRAFT_ENTRY);
    });

    it("throws BusinessRuleViolationException (UNBALANCED_JOURNAL) when debit != credit", async () => {
      const { service } = makeService();
      const dto: CreateJournalEntryDto = {
        entryDate: "2026-10-23",
        narration: "Unbalanced voucher",
        lines: [
          { accountId: 20, debit: 1500, credit: 0 },
          { accountId: 10, debit: 0, credit: 1200 }, // unbalanced!
        ],
      };

      await expect(service.create(dto)).rejects.toThrow(
        BusinessRuleViolationException,
      );
    });

    it("throws BusinessRuleViolationException (INSUFFICIENT_JOURNAL_LINES) when fewer than 2 lines", async () => {
      const { service } = makeService();
      const dto: CreateJournalEntryDto = {
        entryDate: "2026-10-23",
        narration: "Single line voucher",
        lines: [{ accountId: 20, debit: 1500, credit: 0 }],
      };

      await expect(service.create(dto)).rejects.toThrow(
        BusinessRuleViolationException,
      );
    });

    it("throws BusinessRuleViolationException (INVALID_LINE_AMOUNTS) when line has both debit and credit", async () => {
      const { service } = makeService();
      const dto: CreateJournalEntryDto = {
        entryDate: "2026-10-23",
        narration: "Both amounts voucher",
        lines: [
          { accountId: 20, debit: 1500, credit: 500 },
          { accountId: 10, debit: 0, credit: 1000 },
        ],
      };

      await expect(service.create(dto)).rejects.toThrow(
        BusinessRuleViolationException,
      );
    });

    it("throws BusinessRuleViolationException (INVALID_LINE_AMOUNTS) when line has neither debit nor credit", async () => {
      const { service } = makeService();
      const dto: CreateJournalEntryDto = {
        entryDate: "2026-10-23",
        narration: "Zero line voucher",
        lines: [
          { accountId: 20, debit: 0, credit: 0 },
          { accountId: 10, debit: 0, credit: 0 },
        ],
      };

      await expect(service.create(dto)).rejects.toThrow(
        BusinessRuleViolationException,
      );
    });

    it("throws ResourceNotFoundException when referencing non-existent or foreign account", async () => {
      const { service } = makeService();
      const dto: CreateJournalEntryDto = {
        entryDate: "2026-10-23",
        narration: "Foreign account voucher",
        lines: [
          { accountId: 999, debit: 500, credit: 0 }, // not found in org
          { accountId: 10, debit: 0, credit: 500 },
        ],
      };

      await expect(service.create(dto)).rejects.toThrow(
        ResourceNotFoundException,
      );
    });

    it("throws BusinessRuleViolationException (ACCOUNT_INACTIVE) when referencing inactive account", async () => {
      const { service } = makeService();
      const dto: CreateJournalEntryDto = {
        entryDate: "2026-10-23",
        narration: "Inactive account voucher",
        lines: [
          { accountId: 40, debit: 500, credit: 0 }, // inactive account
          { accountId: 10, debit: 0, credit: 500 },
        ],
      };

      await expect(service.create(dto)).rejects.toThrow(
        BusinessRuleViolationException,
      );
    });

    it("throws ResourceConflictException when client provides an existing entryNumber", async () => {
      const { service, repository } = makeService();
      repository.findByEntryNumber.mockResolvedValue(DRAFT_ENTRY);

      const dto: CreateJournalEntryDto = {
        entryNumber: "JV-202610-0001",
        entryDate: "2026-10-23",
        narration: "Duplicate number",
        lines: [
          { accountId: 20, debit: 100, credit: 0 },
          { accountId: 10, debit: 0, credit: 100 },
        ],
      };

      await expect(service.create(dto)).rejects.toThrow(
        ResourceConflictException,
      );
    });
  });

  describe("update() rules", () => {
    it("updates draft voucher successfully", async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue(DRAFT_ENTRY);
      repository.updateDraft.mockResolvedValue({
        ...DRAFT_ENTRY,
        narration: "Updated memo",
      });

      const result = await service.update(100, { narration: "Updated memo" });
      expect(repository.updateDraft).toHaveBeenCalledWith(
        SCOPE,
        100,
        expect.objectContaining({ narration: "Updated memo" }),
        USER_ID,
      );
      expect(result.narration).toBe("Updated memo");
    });

    it("throws BusinessRuleViolationException (IMMUTABLE_POSTED_JOURNAL) when editing POSTED voucher", async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue(POSTED_ENTRY);

      await expect(
        service.update(100, { narration: "Attempt illegal edit" }),
      ).rejects.toThrow(BusinessRuleViolationException);
    });
  });

  describe("post() and General Ledger synchronizations", () => {
    it("posts draft and computes correct balance deltas for Asset and Expense", async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue(DRAFT_ENTRY);
      repository.postEntry.mockResolvedValue(POSTED_ENTRY);

      const result = await service.post(100);

      // Rent Expense (EXPENSE, debited 1500) -> delta = +1500
      // Cash (ASSET, credited 1500) -> delta = -1500
      expect(repository.postEntry).toHaveBeenCalledWith(
        SCOPE,
        100,
        expect.arrayContaining([
          { accountId: 20, delta: 1500 },
          { accountId: 10, delta: -1500 },
        ]),
        USER_ID,
      );
      expect(result.status).toBe("POSTED");
    });

    it("computes correct balance deltas for Revenue and Asset (Credit increases Revenue)", async () => {
      const { service, repository } = makeService();
      const revenueVoucher = {
        ...DRAFT_ENTRY,
        lines: [
          {
            accountId: 10, // Cash (ASSET)
            debit: 5000,
            credit: 0,
            account: CASH_ACCOUNT,
          },
          {
            accountId: 30, // Sales (REVENUE)
            debit: 0,
            credit: 5000,
            account: SALES_REVENUE_ACCOUNT,
          },
        ],
      };
      repository.findById.mockResolvedValue(revenueVoucher);
      repository.postEntry.mockResolvedValue({
        ...revenueVoucher,
        status: "POSTED",
      });

      await service.post(100);

      // Cash: Asset debit -> +5000
      // Sales: Revenue credit -> +5000
      expect(repository.postEntry).toHaveBeenCalledWith(
        SCOPE,
        100,
        expect.arrayContaining([
          { accountId: 10, delta: 5000 },
          { accountId: 30, delta: 5000 },
        ]),
        USER_ID,
      );
    });

    it("throws BusinessRuleViolationException (JOURNAL_ALREADY_POSTED) if already posted", async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue(POSTED_ENTRY);

      await expect(service.post(100)).rejects.toThrow(
        BusinessRuleViolationException,
      );
    });

    it("throws InvalidStateTransitionException if status is REVERSED or VOID", async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue({
        ...DRAFT_ENTRY,
        status: "REVERSED",
      });

      await expect(service.post(100)).rejects.toThrow(
        InvalidStateTransitionException,
      );
    });
  });

  describe("reverse() rules and ledger reversal", () => {
    it("reverses a posted voucher, creates linked reversal voucher, and inverts balance deltas", async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue(POSTED_ENTRY);
      repository.generateNextEntryNumber.mockResolvedValue("REV-202610-0001");
      repository.reverseEntry.mockResolvedValue({
        id: 101,
        entryNumber: "REV-202610-0001",
        status: "POSTED",
      });

      const result = await service.reverse(100, {
        reason: "Duplicate rent booking",
      });

      // Original lines:
      // - Account 20 (Rent Expense) debited 1500
      // - Account 10 (Cash) credited 1500
      // Reversed lines swap:
      // - Account 20 credited 1500 -> delta = -1500
      // - Account 10 debited 1500 -> delta = +1500
      expect(repository.reverseEntry).toHaveBeenCalledWith(
        SCOPE,
        100,
        "REV-202610-0001",
        expect.any(Date),
        "Duplicate rent booking",
        expect.arrayContaining([
          expect.objectContaining({ accountId: 20, debit: 0, credit: 1500 }),
          expect.objectContaining({ accountId: 10, debit: 1500, credit: 0 }),
        ]),
        1500,
        1500,
        expect.arrayContaining([
          { accountId: 20, delta: -1500 },
          { accountId: 10, delta: 1500 },
        ]),
        USER_ID,
      );
      expect(result.entryNumber).toBe("REV-202610-0001");
    });

    it("throws BusinessRuleViolationException (INVALID_STATE_TRANSITION) if voucher is DRAFT", async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue(DRAFT_ENTRY);

      await expect(service.reverse(100, {})).rejects.toThrow(
        BusinessRuleViolationException,
      );
    });

    it("throws BusinessRuleViolationException (JOURNAL_ALREADY_REVERSED) if already reversed", async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue({
        ...POSTED_ENTRY,
        reversedEntryId: 999,
      });

      await expect(service.reverse(100, {})).rejects.toThrow(
        BusinessRuleViolationException,
      );
    });

    it("throws BusinessRuleViolationException (CANNOT_REVERSE_REVERSAL) when attempting to reverse a reversal voucher", async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue({
        ...POSTED_ENTRY,
        entryType: "REVERSAL",
      });

      await expect(service.reverse(100, {})).rejects.toThrow(
        BusinessRuleViolationException,
      );
    });
  });

  describe("remove() rules", () => {
    it("deletes draft voucher", async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue(DRAFT_ENTRY);
      repository.deleteDraft.mockResolvedValue(true);

      await service.remove(100);
      expect(repository.deleteDraft).toHaveBeenCalledWith(SCOPE, 100);
    });

    it("throws BusinessRuleViolationException (IMMUTABLE_POSTED_JOURNAL) when deleting POSTED voucher", async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue(POSTED_ENTRY);

      await expect(service.remove(100)).rejects.toThrow(
        BusinessRuleViolationException,
      );
    });
  });
});
