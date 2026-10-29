import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { CreateBankAccountDto } from "./dto/create-bank-account.dto.js";
import { CreateBankTransactionDto } from "./dto/create-bank-transaction.dto.js";
import { UpdateBankAccountDto } from "./dto/update-bank-account.dto.js";
import { ReconcileTransactionDto } from "./dto/reconcile-transaction.dto.js";

const validateDto = <T extends object>(
  cls: new () => T,
  body: Record<string, unknown>,
) => {
  return validateSync(plainToInstance(cls, body));
};

describe("Banking DTO and Business Rule Validation", () => {
  describe("CreateBankAccountDto", () => {
    const validAccount = {
      accountName: "HDFC Primary Operating Account",
      accountNumber: "50200012345678",
      bankName: "HDFC Bank Ltd",
      ifscCode: "HDFC0001234",
      branchName: "Koramangala, Bengaluru",
      accountType: "CURRENT",
      currency: "INR",
      openingBalance: 15000,
      glAccountId: 20,
      isActive: true,
    };

    it("accepts valid bank account payload", () => {
      const errors = validateDto(CreateBankAccountDto, validAccount);
      expect(errors).toHaveLength(0);
    });

    it("rejects negative opening balance", () => {
      const errors = validateDto(CreateBankAccountDto, {
        ...validAccount,
        openingBalance: -500,
      });
      expect(errors.some((e) => e.property === "openingBalance")).toBe(true);
    });

    it("rejects invalid accountType enum", () => {
      const errors = validateDto(CreateBankAccountDto, {
        ...validAccount,
        accountType: "INVALID_TYPE",
      });
      expect(errors.some((e) => e.property === "accountType")).toBe(true);
    });

    it("rejects missing required fields", () => {
      const errors = validateDto(CreateBankAccountDto, {});
      const errorProps = errors.map((e) => e.property);
      expect(errorProps).toContain("accountName");
      expect(errorProps).toContain("accountNumber");
      expect(errorProps).toContain("bankName");
      expect(errorProps).toContain("ifscCode");
    });
  });

  describe("CreateBankTransactionDto", () => {
    const validTx = {
      bankAccountId: 1,
      transactionDate: "2026-10-26",
      transactionType: "CREDIT",
      amount: 2500.5,
      description: "Client invoice payment via wire",
      referenceNumber: "UTR987654321",
    };

    it("accepts valid bank transaction payload", () => {
      const errors = validateDto(CreateBankTransactionDto, validTx);
      expect(errors).toHaveLength(0);
    });

    it("rejects zero amount", () => {
      const errors = validateDto(CreateBankTransactionDto, {
        ...validTx,
        amount: 0,
      });
      expect(errors.some((e) => e.property === "amount")).toBe(true);
    });

    it("rejects negative amount", () => {
      const errors = validateDto(CreateBankTransactionDto, {
        ...validTx,
        amount: -100,
      });
      expect(errors.some((e) => e.property === "amount")).toBe(true);
    });

    it("rejects invalid transactionType", () => {
      const errors = validateDto(CreateBankTransactionDto, {
        ...validTx,
        transactionType: "TRANSFER",
      });
      expect(errors.some((e) => e.property === "transactionType")).toBe(true);
    });

    it("rejects invalid date string", () => {
      const errors = validateDto(CreateBankTransactionDto, {
        ...validTx,
        transactionDate: "not-a-date",
      });
      expect(errors.some((e) => e.property === "transactionDate")).toBe(true);
    });
  });

  describe("ReconcileTransactionDto", () => {
    it("accepts empty object (reconcile against statement without GL link)", () => {
      const errors = validateDto(ReconcileTransactionDto, {});
      expect(errors).toHaveLength(0);
    });

    it("accepts integer matchedJournalEntryId", () => {
      const errors = validateDto(ReconcileTransactionDto, {
        matchedJournalEntryId: 45,
      });
      expect(errors).toHaveLength(0);
    });

    it("rejects non-integer matchedJournalEntryId", () => {
      const errors = validateDto(ReconcileTransactionDto, {
        matchedJournalEntryId: "not-an-int",
      });
      expect(errors.some((e) => e.property === "matchedJournalEntryId")).toBe(
        true,
      );
    });
  });

  describe("UpdateBankAccountDto", () => {
    it("accepts partial updates", () => {
      const errors = validateDto(UpdateBankAccountDto, {
        accountName: "Renamed Operating Account",
        isActive: false,
      });
      expect(errors).toHaveLength(0);
    });

    it("rejects invalid accountType on update", () => {
      const errors = validateDto(UpdateBankAccountDto, {
        accountType: "UNKNOWN",
      });
      expect(errors.some((e) => e.property === "accountType")).toBe(true);
    });
  });
});
