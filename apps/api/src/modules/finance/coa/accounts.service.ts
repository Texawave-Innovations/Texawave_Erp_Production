import { Injectable } from "@nestjs/common";
import { PaginatedResponseDto } from "../../../common/dto/paginated-response.dto.js";
import {
  BusinessRuleViolationException,
  ResourceConflictException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import { AccountsRepository } from "./accounts.repository.js";
import type { CreateAccountDto } from "./dto/create-account.dto.js";
import type { QueryAccountsDto } from "./dto/query-accounts.dto.js";
import type { UpdateAccountDto } from "./dto/update-account.dto.js";

export interface AccountTreeNode {
  id: number;
  organizationId: number;
  accountCode: string;
  accountName: string;
  accountType: string;
  parentAccountId: number | null;
  currency: string;
  currentBalance: unknown;
  isActive: boolean;
  isReconciled: boolean;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  children: AccountTreeNode[];
}

@Injectable()
export class AccountsService {
  constructor(
    private readonly repository: AccountsRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async findAll(query: QueryAccountsDto) {
    const scope = this.tenantContext.getOrgScope();
    const { items, total } = await this.repository.findMany(scope, query);
    return new PaginatedResponseDto(items, total, query.page, query.limit);
  }

  async findOne(id: number) {
    const scope = this.tenantContext.getOrgScope();
    const account = await this.repository.findById(scope, id);
    if (!account) {
      throw new ResourceNotFoundException("Finance account", id);
    }
    return account;
  }

  async getTree(): Promise<AccountTreeNode[]> {
    const scope = this.tenantContext.getOrgScope();
    const accounts = await this.repository.findAllRaw(scope);

    const nodeMap = new Map<number, AccountTreeNode>();
    const roots: AccountTreeNode[] = [];

    for (const acc of accounts) {
      nodeMap.set(acc.id, {
        id: acc.id,
        organizationId: acc.organizationId,
        accountCode: acc.accountCode,
        accountName: acc.accountName,
        accountType: acc.accountType,
        parentAccountId: acc.parentAccountId,
        currency: acc.currency,
        currentBalance: acc.currentBalance,
        isActive: acc.isActive,
        isReconciled: acc.isReconciled,
        description: acc.description,
        createdAt: acc.createdAt,
        updatedAt: acc.updatedAt,
        children: [],
      });
    }

    for (const acc of accounts) {
      const node = nodeMap.get(acc.id)!;
      if (acc.parentAccountId && nodeMap.has(acc.parentAccountId)) {
        nodeMap.get(acc.parentAccountId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  async create(dto: CreateAccountDto) {
    const scope = this.tenantContext.getOrgScope();

    // Check account code uniqueness within organization
    const existing = await this.repository.findByCode(scope, dto.accountCode);
    if (existing) {
      throw new ResourceConflictException(
        `An account with code "${dto.accountCode}" already exists.`,
      );
    }

    // Validate parent account if provided
    if (dto.parentAccountId) {
      const parent = await this.repository.findById(scope, dto.parentAccountId);
      if (!parent) {
        throw new ResourceNotFoundException(
          "Parent account",
          dto.parentAccountId,
        );
      }
      if (parent.accountType !== dto.accountType) {
        throw new BusinessRuleViolationException(
          `Child account type "${dto.accountType}" must match parent account type "${parent.accountType}".`,
          "ACCOUNT_TYPE_MISMATCH",
        );
      }
    }

    return this.repository.create(scope, dto, this.tenantContext.getUserId());
  }

  async update(id: number, dto: UpdateAccountDto) {
    const scope = this.tenantContext.getOrgScope();

    const current = await this.repository.findById(scope, id);
    if (!current) {
      throw new ResourceNotFoundException("Finance account", id);
    }

    // Check code uniqueness if changing
    if (dto.accountCode && dto.accountCode !== current.accountCode) {
      const duplicate = await this.repository.findByCode(
        scope,
        dto.accountCode,
      );
      if (duplicate && duplicate.id !== id) {
        throw new ResourceConflictException(
          `An account with code "${dto.accountCode}" already exists.`,
        );
      }
    }

    // Hierarchy and cycle checks if parent is changing
    if (dto.parentAccountId !== undefined) {
      if (dto.parentAccountId === id) {
        throw new BusinessRuleViolationException(
          "An account cannot be its own parent.",
          "SELF_PARENTING_NOT_ALLOWED",
        );
      }

      if (dto.parentAccountId !== null) {
        const parent = await this.repository.findById(
          scope,
          dto.parentAccountId,
        );
        if (!parent) {
          throw new ResourceNotFoundException(
            "Parent account",
            dto.parentAccountId,
          );
        }

        if (parent.accountType !== current.accountType) {
          throw new BusinessRuleViolationException(
            `Child account type "${current.accountType}" must match parent account type "${parent.accountType}".`,
            "ACCOUNT_TYPE_MISMATCH",
          );
        }

        // Circular hierarchy check: traverse upward from prospective parent
        let cursorId: number | null | undefined = dto.parentAccountId;
        const visited = new Set<number>();
        while (cursorId) {
          if (cursorId === id) {
            throw new BusinessRuleViolationException(
              "Cannot set parent account: circular hierarchy detected.",
              "CIRCULAR_HIERARCHY",
            );
          }
          if (visited.has(cursorId)) {
            break;
          }
          visited.add(cursorId);
          const ancestor = await this.repository.findById(scope, cursorId);
          cursorId = ancestor?.parentAccountId;
        }
      }
    }

    const updated = await this.repository.update(
      scope,
      id,
      dto,
      this.tenantContext.getUserId(),
    );

    if (!updated) {
      throw new ResourceNotFoundException("Finance account", id);
    }

    return updated;
  }

  async remove(id: number): Promise<void> {
    const scope = this.tenantContext.getOrgScope();

    const current = await this.repository.findById(scope, id);
    if (!current) {
      throw new ResourceNotFoundException("Finance account", id);
    }

    // Rule 1: Cannot delete if it has child accounts
    const subAccountsCount = await this.repository.countSubAccounts(scope, id);
    if (subAccountsCount > 0) {
      throw new BusinessRuleViolationException(
        `Cannot delete account "${current.accountCode}" because it has ${subAccountsCount} active sub-account(s). Reassign or delete child accounts first.`,
        "ACCOUNT_HAS_CHILDREN",
      );
    }

    // Rule 2: Cannot delete if it has journal line postings
    const journalLinesCount = await this.repository.countJournalLines(
      scope,
      id,
    );
    if (journalLinesCount > 0) {
      throw new BusinessRuleViolationException(
        `Cannot delete account "${current.accountCode}" because it has ${journalLinesCount} journal line posting(s).`,
        "ACCOUNT_HAS_POSTINGS",
      );
    }

    // Rule 3: Cannot delete if linked to bank accounts
    const bankAccountsCount = await this.repository.countLinkedBankAccounts(
      scope,
      id,
    );
    if (bankAccountsCount > 0) {
      throw new BusinessRuleViolationException(
        `Cannot delete account "${current.accountCode}" because it is linked to one or more bank accounts.`,
        "ACCOUNT_IN_USE",
      );
    }

    // Rule 4: Cannot delete if linked to expenses
    const expensesCount = await this.repository.countLinkedExpenses(scope, id);
    if (expensesCount > 0) {
      throw new BusinessRuleViolationException(
        `Cannot delete account "${current.accountCode}" because it is linked to one or more operational expenses.`,
        "ACCOUNT_IN_USE",
      );
    }

    const deleted = await this.repository.softDelete(
      scope,
      id,
      this.tenantContext.getUserId(),
    );

    if (!deleted) {
      throw new ResourceNotFoundException("Finance account", id);
    }
  }
}
