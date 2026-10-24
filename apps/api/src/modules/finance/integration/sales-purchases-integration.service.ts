import { Injectable } from "@nestjs/common";
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";
import {
  calculateAccountBalanceDelta,
  type FinanceAccountType,
} from "../finance.constants.js";
import { GstRepository } from "../gst/gst.repository.js";
import { JournalEntriesRepository } from "../journal/journal-entries.repository.js";
import type { CancelIntegrationDocumentDto } from "./dto/cancel-integration-document.dto.js";
import type { PostPurchaseBillDto } from "./dto/post-purchase-bill.dto.js";
import type { PostSalesInvoiceDto } from "./dto/post-sales-invoice.dto.js";
import type {
  DocumentIntegrationStatus,
  SalesPurchasesPostingResult,
} from "./integration.types.js";

function round2(val: number): number {
  return Number(Number(val).toFixed(2));
}

@Injectable()
export class SalesPurchasesIntegrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly journalRepository: JournalEntriesRepository,
    private readonly gstRepository: GstRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  /**
   * Posts a finalized Sales Invoice or Sales Order to Finance.
   * Generates a balanced double-entry voucher (Debit AR, Credit Revenue & GST Output)
   * and records an OUTPUT_GST tax ledger entry.
   * Prevents duplicate posting via idempotent retry safeguards.
   */
  async postSalesInvoice(
    dto: PostSalesInvoiceDto,
    actorId?: number,
  ): Promise<SalesPurchasesPostingResult> {
    const scope = this.tenantContext.getOrgScope();
    const userId = actorId ?? this.tenantContext.getUserId();
    const ref = dto.invoiceNumber.trim();

    // 1. Monetary Invariants Validation
    const subtotal = round2(dto.subtotal);
    const taxAmount = round2(dto.taxAmount);
    const total = round2(dto.total);

    if (total <= 0) {
      throw new BusinessRuleViolationException(
        "A sales invoice must have an amount greater than zero.",
        "INVALID_INVOICE_AMOUNT",
      );
    }

    if (Math.abs(round2(subtotal + taxAmount) - total) > 0.02) {
      throw new BusinessRuleViolationException(
        `Invoice total (${total}) does not match subtotal (${subtotal}) + tax (${taxAmount})`,
        "INVOICE_TOTAL_MISMATCH",
      );
    }

    // 2. Duplicate Check & Idempotency Safeguard
    const existingJournal = await this.prisma.financeJournalEntry.findFirst({
      where: {
        organizationId: scope.organizationId,
        referenceNumber: ref,
        status: "POSTED",
      },
    });

    if (existingJournal) {
      const existingGst = await this.prisma.financeGstEntry.findFirst({
        where: {
          organizationId: scope.organizationId,
          sourceReference: ref,
          status: "ACTIVE",
        },
      });

      return {
        success: true,
        alreadyPosted: true,
        documentReference: ref,
        journalEntryId: existingJournal.id,
        journalEntryNumber: existingJournal.entryNumber,
        gstEntryId: existingGst?.id ?? null,
        message: `Sales invoice '${ref}' is already posted to Finance.`,
      };
    }

    // 3. Resolve Chart of Accounts mappings dynamically (no hardcoding)
    const receivableAccount = await this.resolveAccount(
      scope,
      ["1200"],
      "ASSET",
      ["Receivable", "Debtor"],
    );
    const revenueAccount = await this.resolveAccount(
      scope,
      ["4010"],
      "REVENUE",
      ["Revenue", "Sales"],
    );
    const gstOutputAccount = await this.resolveAccount(
      scope,
      ["2020"],
      "LIABILITY",
      ["GST", "Tax", "Output"],
    );

    // 4. Atomic Execution: Journal Posting & GST Recording
    return this.prisma.$transaction(async (tx) => {
      // A. Generate voucher number
      const entryNumber = await this.journalRepository.generateNextEntryNumber(
        scope,
        "JV",
      );
      const entryDate = new Date(dto.invoiceDate);

      // B. Build balanced lines
      const lines = [
        {
          accountId: receivableAccount.id,
          lineOrder: 0,
          description: `Accounts Receivable: ${ref} (${dto.customerName})`,
          debit: total,
          credit: 0,
        },
        {
          accountId: revenueAccount.id,
          lineOrder: 1,
          description: `Sales Revenue: ${ref}`,
          debit: 0,
          credit: subtotal,
        },
      ];

      if (taxAmount > 0) {
        lines.push({
          accountId: gstOutputAccount.id,
          lineOrder: 2,
          description: `GST Output Tax: ${ref}`,
          debit: 0,
          credit: taxAmount,
        });
      }

      // C. Persist Journal Entry and Lines
      const createdJournal = await tx.financeJournalEntry.create({
        data: {
          organizationId: scope.organizationId,
          entryNumber,
          entryDate,
          entryType: "MANUAL",
          narration: `Sales Invoice ${ref} - ${dto.customerName}${dto.notes ? ` (${dto.notes})` : ""}`,
          referenceNumber: ref,
          totalDebit: total,
          totalCredit: total,
          status: "POSTED",
          postedAt: new Date(),
          postedBy: userId ?? null,
          createdBy: userId ?? null,
          updatedBy: userId ?? null,
          lines: {
            create: lines.map((l) => ({
              organizationId: scope.organizationId,
              accountId: l.accountId,
              lineOrder: l.lineOrder,
              description: l.description,
              debit: l.debit,
              credit: l.credit,
            })),
          },
        },
      });

      // D. Update Account Balances
      for (const line of lines) {
        const delta = calculateAccountBalanceDelta(
          line.accountId === receivableAccount.id
            ? receivableAccount.accountType
            : line.accountId === revenueAccount.id
              ? revenueAccount.accountType
              : gstOutputAccount.accountType,
          line.debit,
          line.credit,
        );

        await tx.financeAccount.update({
          where: { id: line.accountId },
          data: { currentBalance: { increment: delta } },
        });
      }

      // E. Record GST Output Ledger Entry
      let gstEntryId: number | null = null;
      if (taxAmount > 0) {
        const period = dto.invoiceDate.slice(0, 7);
        const cgstAmount =
          dto.cgstAmount ?? (dto.igstAmount ? 0 : round2(taxAmount / 2));
        const sgstAmount =
          dto.sgstAmount ?? (dto.igstAmount ? 0 : round2(taxAmount / 2));
        const igstAmount =
          dto.igstAmount ?? (cgstAmount + sgstAmount === 0 ? taxAmount : 0);

        const isProformaExcluded =
          ref.includes("/PI/") ||
          ref.includes("-PI-") ||
          ref.startsWith("PI-") ||
          ref.includes("PROFORMA");

        const gstEntry = await tx.financeGstEntry.create({
          data: {
            organizationId: scope.organizationId,
            gstin: dto.customerGstin?.trim().toUpperCase() || "URP",
            period,
            entryType: "OUTPUT_GST",
            sourceType: "SALES_INVOICE",
            sourceId: dto.salesOrderId ?? null,
            sourceReference: ref,
            hsnSacCode: dto.hsnSacCode?.trim() || null,
            taxableAmount: subtotal,
            cgstRate: 0,
            cgstAmount,
            sgstRate: 0,
            sgstAmount,
            igstRate: 0,
            igstAmount,
            totalTaxAmount: taxAmount,
            isProformaExcluded,
            status: "ACTIVE",
            createdBy: userId ?? null,
          },
        });
        gstEntryId = gstEntry.id;
      }

      return {
        success: true,
        documentReference: ref,
        journalEntryId: createdJournal.id,
        journalEntryNumber: createdJournal.entryNumber,
        gstEntryId,
        message: `Sales invoice '${ref}' successfully posted to Finance.`,
      };
    });
  }

  /**
   * Posts a confirmed Purchase Bill or SCM Supplier Bill to Finance.
   * Generates a balanced double-entry voucher (Debit Expense & GST Input, Credit AP)
   * and records an INPUT_TAX_CREDIT tax ledger entry.
   * Prevents duplicate posting via idempotent retry safeguards.
   */
  async postPurchaseBill(
    dto: PostPurchaseBillDto,
    actorId?: number,
  ): Promise<SalesPurchasesPostingResult> {
    const scope = this.tenantContext.getOrgScope();
    const userId = actorId ?? this.tenantContext.getUserId();
    const ref = dto.supplierBillNumber?.trim() || dto.billNumber.trim();

    // 1. Monetary Invariants Validation
    const subtotal = round2(dto.subtotal);
    const taxAmount = round2(dto.taxAmount);
    const total = round2(dto.total);

    if (total <= 0) {
      throw new BusinessRuleViolationException(
        "A purchase bill must have an amount greater than zero.",
        "INVALID_BILL_AMOUNT",
      );
    }

    if (Math.abs(round2(subtotal + taxAmount) - total) > 0.02) {
      throw new BusinessRuleViolationException(
        `Bill total (${total}) does not match subtotal (${subtotal}) + tax (${taxAmount})`,
        "BILL_TOTAL_MISMATCH",
      );
    }

    // 2. Duplicate Check & Idempotency Safeguard
    const existingJournal = await this.prisma.financeJournalEntry.findFirst({
      where: {
        organizationId: scope.organizationId,
        referenceNumber: ref,
        status: "POSTED",
      },
    });

    if (existingJournal) {
      const existingGst = await this.prisma.financeGstEntry.findFirst({
        where: {
          organizationId: scope.organizationId,
          sourceReference: ref,
          status: "ACTIVE",
        },
      });

      return {
        success: true,
        alreadyPosted: true,
        documentReference: ref,
        journalEntryId: existingJournal.id,
        journalEntryNumber: existingJournal.entryNumber,
        gstEntryId: existingGst?.id ?? null,
        message: `Purchase bill '${ref}' is already posted to Finance.`,
      };
    }

    // 3. Resolve Chart of Accounts mappings dynamically (no hardcoding)
    const payableAccount = await this.resolveAccount(
      scope,
      ["2010"],
      "LIABILITY",
      ["Payable", "Creditor"],
    );
    const expenseAccount = await this.resolveAccount(
      scope,
      ["5010", "5020"],
      "EXPENSE",
      ["Cost of Goods", "Expense", "Purchase"],
    );
    const gstInputAccount = await this.resolveAccount(
      scope,
      ["2020"],
      "LIABILITY",
      ["GST", "Tax", "Input"],
    );

    // 4. Atomic Execution: Journal Posting & GST Recording
    return this.prisma.$transaction(async (tx) => {
      // A. Generate voucher number
      const entryNumber = await this.journalRepository.generateNextEntryNumber(
        scope,
        "JV",
      );
      const entryDate = new Date(dto.billDate);

      // B. Build balanced lines
      const lines = [
        {
          accountId: expenseAccount.id,
          lineOrder: 0,
          description: `COGS / Expense: ${ref} (${dto.supplierName})`,
          debit: subtotal,
          credit: 0,
        },
      ];

      if (taxAmount > 0) {
        // Debiting GST Account reduces GST Liability (or creates ITC Asset)
        lines.push({
          accountId: gstInputAccount.id,
          lineOrder: 1,
          description: `GST Input Tax Credit: ${ref}`,
          debit: taxAmount,
          credit: 0,
        });
      }

      lines.push({
        accountId: payableAccount.id,
        lineOrder: lines.length,
        description: `Accounts Payable: ${ref} (${dto.supplierName})`,
        debit: 0,
        credit: total,
      });

      // C. Persist Journal Entry and Lines
      const createdJournal = await tx.financeJournalEntry.create({
        data: {
          organizationId: scope.organizationId,
          entryNumber,
          entryDate,
          entryType: "EXPENSE",
          narration: `Purchase Bill ${ref} - ${dto.supplierName}${dto.notes ? ` (${dto.notes})` : ""}`,
          referenceNumber: ref,
          totalDebit: total,
          totalCredit: total,
          status: "POSTED",
          postedAt: new Date(),
          postedBy: userId ?? null,
          createdBy: userId ?? null,
          updatedBy: userId ?? null,
          lines: {
            create: lines.map((l) => ({
              organizationId: scope.organizationId,
              accountId: l.accountId,
              lineOrder: l.lineOrder,
              description: l.description,
              debit: l.debit,
              credit: l.credit,
            })),
          },
        },
      });

      // D. Update Account Balances
      for (const line of lines) {
        const delta = calculateAccountBalanceDelta(
          line.accountId === payableAccount.id
            ? payableAccount.accountType
            : line.accountId === expenseAccount.id
              ? expenseAccount.accountType
              : gstInputAccount.accountType,
          line.debit,
          line.credit,
        );

        await tx.financeAccount.update({
          where: { id: line.accountId },
          data: { currentBalance: { increment: delta } },
        });
      }

      // E. Record GST Input Tax Credit Ledger Entry
      let gstEntryId: number | null = null;
      if (taxAmount > 0) {
        const period = dto.billDate.slice(0, 7);
        const cgstAmount =
          dto.cgstAmount ?? (dto.igstAmount ? 0 : round2(taxAmount / 2));
        const sgstAmount =
          dto.sgstAmount ?? (dto.igstAmount ? 0 : round2(taxAmount / 2));
        const igstAmount =
          dto.igstAmount ?? (cgstAmount + sgstAmount === 0 ? taxAmount : 0);

        const gstEntry = await tx.financeGstEntry.create({
          data: {
            organizationId: scope.organizationId,
            gstin: dto.supplierGstin?.trim().toUpperCase() || "UNREGISTERED",
            period,
            entryType: "INPUT_TAX_CREDIT",
            sourceType: "PURCHASE_BILL",
            sourceId: dto.purchaseOrderId ?? null,
            sourceReference: ref,
            hsnSacCode: dto.hsnSacCode?.trim() || null,
            taxableAmount: subtotal,
            cgstRate: 0,
            cgstAmount,
            sgstRate: 0,
            sgstAmount,
            igstRate: 0,
            igstAmount,
            totalTaxAmount: taxAmount,
            isProformaExcluded: false,
            status: "ACTIVE",
            createdBy: userId ?? null,
          },
        });
        gstEntryId = gstEntry.id;
      }

      return {
        success: true,
        documentReference: ref,
        journalEntryId: createdJournal.id,
        journalEntryNumber: createdJournal.entryNumber,
        gstEntryId,
        message: `Purchase bill '${ref}' successfully posted to Finance.`,
      };
    });
  }

  /**
   * Reverses accounting and GST entries upon cancellation of a Sales Invoice.
   */
  async cancelSalesInvoice(
    dto: CancelIntegrationDocumentDto,
    actorId?: number,
  ): Promise<SalesPurchasesPostingResult> {
    return this.cancelDocument(dto.documentReference, dto.reason, actorId);
  }

  /**
   * Reverses accounting and GST entries upon cancellation of a Purchase Bill.
   */
  async cancelPurchaseBill(
    dto: CancelIntegrationDocumentDto,
    actorId?: number,
  ): Promise<SalesPurchasesPostingResult> {
    return this.cancelDocument(dto.documentReference, dto.reason, actorId);
  }

  /**
   * Generic document cancellation & reversal workflow.
   */
  private async cancelDocument(
    reference: string,
    reason: string,
    actorId?: number,
  ): Promise<SalesPurchasesPostingResult> {
    const scope = this.tenantContext.getOrgScope();
    const userId = actorId ?? this.tenantContext.getUserId();
    const ref = reference.trim();

    const journal = await this.prisma.financeJournalEntry.findFirst({
      where: {
        organizationId: scope.organizationId,
        referenceNumber: ref,
        status: "POSTED",
      },
      include: {
        lines: {
          include: { account: true },
        },
      },
    });

    if (!journal) {
      // Check if already reversed
      const alreadyReversed = await this.prisma.financeJournalEntry.findFirst({
        where: {
          organizationId: scope.organizationId,
          referenceNumber: ref,
          status: "REVERSED",
        },
      });

      return {
        success: true,
        alreadyCancelled: true,
        documentReference: ref,
        journalEntryId: alreadyReversed?.id ?? null,
        journalEntryNumber: alreadyReversed?.entryNumber ?? null,
        gstEntryId: null,
        message: `Document '${ref}' is already cancelled / reversed or was not posted.`,
      };
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Generate reversal journal entry
      const reversalNumber =
        await this.journalRepository.generateNextEntryNumber(scope, "REV");

      // Invert lines: swap debits and credits
      const reversedLines = journal.lines.map((line) => ({
        accountId: line.accountId,
        lineOrder: line.lineOrder,
        description: `Reversal of ${ref}: ${reason}`,
        debit: Number(line.credit),
        credit: Number(line.debit),
      }));

      const reversalJournal = await tx.financeJournalEntry.create({
        data: {
          organizationId: scope.organizationId,
          entryNumber: reversalNumber,
          entryDate: new Date(),
          entryType: "REVERSAL",
          narration: `Reversal of ${journal.entryNumber} (${ref}): ${reason}`,
          referenceNumber: ref,
          totalDebit: journal.totalCredit,
          totalCredit: journal.totalDebit,
          status: "POSTED",
          postedAt: new Date(),
          postedBy: userId ?? null,
          createdBy: userId ?? null,
          updatedBy: userId ?? null,
          lines: {
            create: reversedLines.map((l) => ({
              organizationId: scope.organizationId,
              accountId: l.accountId,
              lineOrder: l.lineOrder,
              description: l.description,
              debit: l.debit,
              credit: l.credit,
            })),
          },
        },
      });

      // Mark original entry as REVERSED
      await tx.financeJournalEntry.update({
        where: { id: journal.id },
        data: { status: "REVERSED", updatedBy: userId ?? null },
      });

      // Update account balances with reverse deltas
      for (const line of reversedLines) {
        const acc = journal.lines.find(
          (l) => l.accountId === line.accountId,
        )?.account;
        if (acc) {
          const delta = calculateAccountBalanceDelta(
            acc.accountType,
            line.debit,
            line.credit,
          );
          await tx.financeAccount.update({
            where: { id: line.accountId },
            data: { currentBalance: { increment: delta } },
          });
        }
      }

      // 2. Cancel corresponding GST entry
      await tx.financeGstEntry.updateMany({
        where: {
          organizationId: scope.organizationId,
          sourceReference: ref,
          status: "ACTIVE",
        },
        data: { status: "CANCELLED" },
      });

      return {
        success: true,
        documentReference: ref,
        journalEntryId: journal.id,
        journalEntryNumber: journal.entryNumber,
        reversalJournalEntryId: reversalJournal.id,
        gstEntryId: null,
        message: `Document '${ref}' and accounting entries successfully reversed.`,
      };
    });
  }

  /**
   * Retrieves accounting and GST integration status for a document.
   */
  async getIntegrationStatus(
    reference: string,
  ): Promise<DocumentIntegrationStatus> {
    const scope = this.tenantContext.getOrgScope();
    const ref = reference.trim();

    const [journal, gst] = await Promise.all([
      this.prisma.financeJournalEntry.findFirst({
        where: {
          organizationId: scope.organizationId,
          referenceNumber: ref,
        },
        orderBy: { id: "desc" },
      }),
      this.prisma.financeGstEntry.findFirst({
        where: {
          organizationId: scope.organizationId,
          sourceReference: ref,
        },
        orderBy: { id: "desc" },
      }),
    ]);

    return {
      documentReference: ref,
      isJournalPosted: journal?.status === "POSTED",
      journalEntry: journal
        ? {
            id: journal.id,
            entryNumber: journal.entryNumber,
            entryDate: journal.entryDate.toISOString().slice(0, 10),
            status: journal.status,
            totalDebit: Number(journal.totalDebit),
            totalCredit: Number(journal.totalCredit),
          }
        : null,
      isGstRecorded: gst !== null && gst.status !== "CANCELLED",
      gstEntry: gst
        ? {
            id: gst.id,
            gstin: gst.gstin,
            period: gst.period,
            entryType: gst.entryType,
            taxableAmount: Number(gst.taxableAmount),
            totalTaxAmount: Number(gst.totalTaxAmount),
            status: gst.status,
          }
        : null,
    };
  }

  // ---- Private Helpers ----------------------------------------------------

  private async resolveAccount(
    scope: OrgScope,
    preferredCodes: string[],
    accountType: FinanceAccountType,
    fallbackNameKeywords: string[],
  ) {
    for (const code of preferredCodes) {
      const acc = await this.prisma.financeAccount.findFirst({
        where: {
          organizationId: scope.organizationId,
          accountCode: code,
          isActive: true,
          deletedAt: null,
        },
      });
      if (acc) return acc;
    }

    // Fallback: look up by type and name keywords
    for (const kw of fallbackNameKeywords) {
      const acc = await this.prisma.financeAccount.findFirst({
        where: {
          organizationId: scope.organizationId,
          accountType,
          accountName: { contains: kw, mode: "insensitive" },
          isActive: true,
          deletedAt: null,
        },
      });
      if (acc) return acc;
    }

    // Ultimate fallback: first active account of this type
    const acc = await this.prisma.financeAccount.findFirst({
      where: {
        organizationId: scope.organizationId,
        accountType,
        isActive: true,
        deletedAt: null,
      },
    });
    if (acc) return acc;

    throw new ResourceNotFoundException(
      `Chart of Accounts (${accountType})`,
      preferredCodes.join(" / "),
    );
  }
}
