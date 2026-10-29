import { describe, expect, it, vi } from "vitest";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import {
  BusinessRuleViolationException,
  ResourceConflictException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import { AccountsService } from "./accounts.service.js";
import type { CreateAccountDto } from "./dto/create-account.dto.js";
import type { QueryAccountsDto } from "./dto/query-accounts.dto.js";
import type { UpdateAccountDto } from "./dto/update-account.dto.js";

const SCOPE = { organizationId: 1 };
const USER_ID = 42;

const ACCOUNT_ROOT = {
  id: 1,
  organizationId: 1,
  accountCode: "1000",
  accountName: "Current Assets",
  accountType: "ASSET",
  parentAccountId: null,
  currency: "INR",
  currentBalance: 0,
  isActive: true,
  isReconciled: false,
  description: "Root asset",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const ACCOUNT_CHILD = {
  id: 2,
  organizationId: 1,
  accountCode: "1010",
  accountName: "Cash on Hand",
  accountType: "ASSET",
  parentAccountId: 1,
  currency: "INR",
  currentBalance: 0,
  isActive: true,
  isReconciled: false,
  description: "Child asset",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const ACCOUNT_LIABILITY = {
  id: 3,
  organizationId: 1,
  accountCode: "2000",
  accountName: "Current Liabilities",
  accountType: "LIABILITY",
  parentAccountId: null,
  currency: "INR",
  currentBalance: 0,
  isActive: true,
  isReconciled: false,
  description: "Root liability",
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeService() {
  const repository = {
    findMany: vi.fn(),
    findAllRaw: vi.fn(),
    findById: vi.fn(),
    findByCode: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
    countSubAccounts: vi.fn(),
    countJournalLines: vi.fn(),
    countLinkedBankAccounts: vi.fn(),
    countLinkedExpenses: vi.fn(),
  };

  const tenantContext = {
    getOrgScope: vi.fn().mockReturnValue(SCOPE),
    getUserId: vi.fn().mockReturnValue(USER_ID),
  };

  const service = new AccountsService(
    repository as never,
    tenantContext as never,
  );

  return { service, repository, tenantContext };
}

describe("AccountsService", () => {
  describe("findAll()", () => {
    it("delegates to repository with tenant scope and wraps in PaginatedResponseDto", async () => {
      const { service, repository } = makeService();
      repository.findMany.mockResolvedValue({
        items: [ACCOUNT_ROOT, ACCOUNT_CHILD],
        total: 2,
      });

      const query: QueryAccountsDto = {
        page: 1,
        limit: 10,
        skip: 0,
      } as QueryAccountsDto;
      const result = await service.findAll(query);

      expect(repository.findMany).toHaveBeenCalledWith(SCOPE, query);
      expect(result).toBeInstanceOf(PaginatedResponseDto);
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });
  });

  describe("findOne()", () => {
    it("returns account when found", async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue(ACCOUNT_ROOT);

      const result = await service.findOne(1);
      expect(repository.findById).toHaveBeenCalledWith(SCOPE, 1);
      expect(result).toBe(ACCOUNT_ROOT);
    });

    it("throws ResourceNotFoundException when account does not exist", async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(
        ResourceNotFoundException,
      );
    });
  });

  describe("getTree()", () => {
    it("builds a hierarchical tree from flat accounts list", async () => {
      const { service, repository } = makeService();
      const grandchild = {
        id: 4,
        organizationId: 1,
        accountCode: "1011",
        accountName: "Petty Cash Drawer",
        accountType: "ASSET",
        parentAccountId: 2,
        currency: "INR",
        currentBalance: 0,
        isActive: true,
        isReconciled: false,
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      repository.findAllRaw.mockResolvedValue([
        ACCOUNT_ROOT,
        ACCOUNT_CHILD,
        grandchild,
        ACCOUNT_LIABILITY,
      ]);

      const tree = await service.getTree();

      expect(tree).toHaveLength(2); // Two root nodes: 1 (Asset) and 3 (Liability)
      const assetRoot = tree.find((n) => n.id === 1)!;
      expect(assetRoot.children).toHaveLength(1);
      expect(assetRoot.children[0]!.id).toBe(2);
      expect(assetRoot.children[0]!.children).toHaveLength(1);
      expect(assetRoot.children[0]!.children[0]!.id).toBe(4);

      const liabilityRoot = tree.find((n) => n.id === 3)!;
      expect(liabilityRoot.children).toHaveLength(0);
    });
  });

  describe("create()", () => {
    it("creates a root account successfully", async () => {
      const { service, repository } = makeService();
      repository.findByCode.mockResolvedValue(null);
      repository.create.mockResolvedValue(ACCOUNT_ROOT);

      const dto: CreateAccountDto = {
        accountCode: "1000",
        accountName: "Current Assets",
        accountType: "ASSET",
      };

      const result = await service.create(dto);
      expect(repository.findByCode).toHaveBeenCalledWith(SCOPE, "1000");
      expect(repository.create).toHaveBeenCalledWith(SCOPE, dto, USER_ID);
      expect(result).toBe(ACCOUNT_ROOT);
    });

    it("creates a child account when parent exists and type matches", async () => {
      const { service, repository } = makeService();
      repository.findByCode.mockResolvedValue(null);
      repository.findById.mockResolvedValue(ACCOUNT_ROOT);
      repository.create.mockResolvedValue(ACCOUNT_CHILD);

      const dto: CreateAccountDto = {
        accountCode: "1010",
        accountName: "Cash on Hand",
        accountType: "ASSET",
        parentAccountId: 1,
      };

      const result = await service.create(dto);
      expect(repository.findById).toHaveBeenCalledWith(SCOPE, 1);
      expect(repository.create).toHaveBeenCalledWith(SCOPE, dto, USER_ID);
      expect(result).toBe(ACCOUNT_CHILD);
    });

    it("rejects duplicate accountCode with ResourceConflictException", async () => {
      const { service, repository } = makeService();
      repository.findByCode.mockResolvedValue(ACCOUNT_ROOT);

      const dto: CreateAccountDto = {
        accountCode: "1000",
        accountName: "Duplicate Assets",
        accountType: "ASSET",
      };

      await expect(service.create(dto)).rejects.toThrow(
        ResourceConflictException,
      );
    });

    it("throws ResourceNotFoundException if parentAccountId does not exist", async () => {
      const { service, repository } = makeService();
      repository.findByCode.mockResolvedValue(null);
      repository.findById.mockResolvedValue(null);

      const dto: CreateAccountDto = {
        accountCode: "1010",
        accountName: "Cash on Hand",
        accountType: "ASSET",
        parentAccountId: 999,
      };

      await expect(service.create(dto)).rejects.toThrow(
        ResourceNotFoundException,
      );
    });

    it("throws BusinessRuleViolationException (ACCOUNT_TYPE_MISMATCH) if child type differs from parent", async () => {
      const { service, repository } = makeService();
      repository.findByCode.mockResolvedValue(null);
      repository.findById.mockResolvedValue(ACCOUNT_ROOT); // ASSET

      const dto: CreateAccountDto = {
        accountCode: "2010",
        accountName: "Accounts Payable",
        accountType: "LIABILITY", // mismatch!
        parentAccountId: 1,
      };

      await expect(service.create(dto)).rejects.toThrow(
        BusinessRuleViolationException,
      );
    });
  });

  describe("update()", () => {
    it("updates account fields successfully", async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue(ACCOUNT_ROOT);
      repository.update.mockResolvedValue({
        ...ACCOUNT_ROOT,
        accountName: "Updated Assets",
      });

      const dto: UpdateAccountDto = { accountName: "Updated Assets" };
      const result = await service.update(1, dto);

      expect(repository.update).toHaveBeenCalledWith(SCOPE, 1, dto, USER_ID);
      expect(result.accountName).toBe("Updated Assets");
    });

    it("throws ResourceNotFoundException when updating non-existent account", async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue(null);

      await expect(
        service.update(999, { accountName: "Ghost" }),
      ).rejects.toThrow(ResourceNotFoundException);
    });

    it("throws ResourceConflictException when changing to an existing accountCode", async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue(ACCOUNT_CHILD); // id: 2, code: 1010
      repository.findByCode.mockResolvedValue(ACCOUNT_ROOT); // id: 1, code: 1000

      await expect(service.update(2, { accountCode: "1000" })).rejects.toThrow(
        ResourceConflictException,
      );
    });

    it("throws BusinessRuleViolationException (SELF_PARENTING_NOT_ALLOWED) when parentAccountId is self", async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue(ACCOUNT_ROOT); // id: 1

      await expect(service.update(1, { parentAccountId: 1 })).rejects.toThrow(
        BusinessRuleViolationException,
      );
    });

    it("throws BusinessRuleViolationException (ACCOUNT_TYPE_MISMATCH) if new parent has different accountType", async () => {
      const { service, repository } = makeService();
      repository.findById
        .mockResolvedValueOnce(ACCOUNT_CHILD) // current account (ASSET)
        .mockResolvedValueOnce(ACCOUNT_LIABILITY); // prospective parent (LIABILITY)

      await expect(service.update(2, { parentAccountId: 3 })).rejects.toThrow(
        BusinessRuleViolationException,
      );
    });

    it("throws BusinessRuleViolationException (CIRCULAR_HIERARCHY) when cycle is detected", async () => {
      const { service, repository } = makeService();
      // Node 1 (Asset Root) is currently parent of Node 2 (Cash).
      // Attempting to make Node 2 the parent of Node 1!
      repository.findById
        .mockResolvedValueOnce(ACCOUNT_ROOT) // current account to update: id: 1, parent: null
        .mockResolvedValueOnce(ACCOUNT_CHILD) // prospective parent: id: 2, parent: 1
        .mockResolvedValueOnce(ACCOUNT_CHILD); // loop check traversal: node 2's parent is 1!

      await expect(service.update(1, { parentAccountId: 2 })).rejects.toThrow(
        BusinessRuleViolationException,
      );
    });
  });

  describe("remove()", () => {
    it("soft deletes account when no constraints are violated", async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue(ACCOUNT_CHILD);
      repository.countSubAccounts.mockResolvedValue(0);
      repository.countJournalLines.mockResolvedValue(0);
      repository.countLinkedBankAccounts.mockResolvedValue(0);
      repository.countLinkedExpenses.mockResolvedValue(0);
      repository.softDelete.mockResolvedValue(true);

      await service.remove(2);

      expect(repository.softDelete).toHaveBeenCalledWith(SCOPE, 2, USER_ID);
    });

    it("throws ResourceNotFoundException if account does not exist", async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue(null);

      await expect(service.remove(999)).rejects.toThrow(
        ResourceNotFoundException,
      );
    });

    it("throws BusinessRuleViolationException (ACCOUNT_HAS_CHILDREN) if sub-accounts exist", async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue(ACCOUNT_ROOT);
      repository.countSubAccounts.mockResolvedValue(3);

      await expect(service.remove(1)).rejects.toThrow(
        BusinessRuleViolationException,
      );
    });

    it("throws BusinessRuleViolationException (ACCOUNT_HAS_POSTINGS) if journal lines exist", async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue(ACCOUNT_CHILD);
      repository.countSubAccounts.mockResolvedValue(0);
      repository.countJournalLines.mockResolvedValue(5);

      await expect(service.remove(2)).rejects.toThrow(
        BusinessRuleViolationException,
      );
    });

    it("throws BusinessRuleViolationException (ACCOUNT_IN_USE) if linked to bank accounts", async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue(ACCOUNT_CHILD);
      repository.countSubAccounts.mockResolvedValue(0);
      repository.countJournalLines.mockResolvedValue(0);
      repository.countLinkedBankAccounts.mockResolvedValue(1);

      await expect(service.remove(2)).rejects.toThrow(
        BusinessRuleViolationException,
      );
    });

    it("throws BusinessRuleViolationException (ACCOUNT_IN_USE) if linked to expenses", async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue(ACCOUNT_CHILD);
      repository.countSubAccounts.mockResolvedValue(0);
      repository.countJournalLines.mockResolvedValue(0);
      repository.countLinkedBankAccounts.mockResolvedValue(0);
      repository.countLinkedExpenses.mockResolvedValue(2);

      await expect(service.remove(2)).rejects.toThrow(
        BusinessRuleViolationException,
      );
    });
  });
});
