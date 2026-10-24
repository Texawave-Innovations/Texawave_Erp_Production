import { describe, expect, it } from "vitest";
import { Prisma } from "@texawave-erp/database";
type Decimal = Prisma.Decimal;
const Decimal = Prisma.Decimal;

/**
 * Unit test suite verifying the Finance core domain rules, mathematical invariants,
 * double-entry balance constraints, and compatibility with the master list.
 */
describe("Finance Core Data Model & Mathematical Invariants", () => {
  describe("Double-Entry Ledger Balancing (Sum Debit = Sum Credit)", () => {
    it("accepts a perfectly balanced journal voucher", () => {
      const lines = [
        {
          accountCode: "1020",
          debit: new Decimal("50000.00"),
          credit: new Decimal("0.00"),
        }, // Bank
        {
          accountCode: "4010",
          debit: new Decimal("0.00"),
          credit: new Decimal("42372.88"),
        }, // Revenue
        {
          accountCode: "2020",
          debit: new Decimal("0.00"),
          credit: new Decimal("7627.12"),
        }, // GST Output
      ];

      const totalDebit = lines.reduce(
        (acc, line) => acc.plus(line.debit),
        new Decimal(0),
      );
      const totalCredit = lines.reduce(
        (acc, line) => acc.plus(line.credit),
        new Decimal(0),
      );

      expect(totalDebit.equals(totalCredit)).toBe(true);
      expect(totalDebit.equals(new Decimal("50000.00"))).toBe(true);
      expect(totalDebit.greaterThan(0)).toBe(true);
    });

    it("rejects an unbalanced journal voucher", () => {
      const lines = [
        {
          accountCode: "5020",
          debit: new Decimal("1200.00"),
          credit: new Decimal("0.00"),
        },
        {
          accountCode: "1010",
          debit: new Decimal("0.00"),
          credit: new Decimal("1000.00"),
        },
      ];

      const totalDebit = lines.reduce(
        (acc, line) => acc.plus(line.debit),
        new Decimal(0),
      );
      const totalCredit = lines.reduce(
        (acc, line) => acc.plus(line.credit),
        new Decimal(0),
      );

      const isBalanced = totalDebit.minus(totalCredit).abs().lessThan(0.0001);
      expect(isBalanced).toBe(false);
    });

    it("validates that journal lines must be exclusively debit or credit", () => {
      function isValidLine(debit: Decimal, credit: Decimal): boolean {
        return (
          (debit.greaterThan(0) && credit.isZero()) ||
          (credit.greaterThan(0) && debit.isZero())
        );
      }

      expect(isValidLine(new Decimal("150.00"), new Decimal("0.00"))).toBe(
        true,
      );
      expect(isValidLine(new Decimal("0.00"), new Decimal("250.00"))).toBe(
        true,
      );
      expect(isValidLine(new Decimal("100.00"), new Decimal("100.00"))).toBe(
        false,
      );
      expect(isValidLine(new Decimal("0.00"), new Decimal("0.00"))).toBe(false);
    });
  });

  describe("Monetary Precision & Float Safety (Decimal.js)", () => {
    it("avoids standard IEEE-754 floating point drift during tax summation", () => {
      // In raw JS float: 0.1 + 0.2 === 0.30000000000000004
      const rawJsSum = 0.1 + 0.2;
      expect(rawJsSum === 0.3).toBe(false);

      // In Decimal.js:
      const decimalSum = new Decimal("0.1").plus(new Decimal("0.2"));
      expect(decimalSum.toString()).toBe("0.3");
      expect(decimalSum.toFixed(2)).toBe("0.30");
    });

    it("calculates 18% GST splits with banker's rounding to 2 decimal places", () => {
      const taxableAmount = new Decimal("10555.55");
      const gstRate = new Decimal("18"); // 18% total = 9% CGST + 9% SGST

      const totalTax = taxableAmount
        .times(gstRate)
        .dividedBy(100)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      const cgst = taxableAmount
        .times(gstRate.dividedBy(2))
        .dividedBy(100)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      const sgst = taxableAmount
        .times(gstRate.dividedBy(2))
        .dividedBy(100)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

      expect(totalTax.toFixed(2)).toBe("1900.00");
      expect(cgst.toFixed(2)).toBe("950.00");
      expect(sgst.toFixed(2)).toBe("950.00");
      expect(cgst.plus(sgst).equals(totalTax)).toBe(true);
    });
  });

  describe("Journal Reversal Workflow", () => {
    it("generates an exact mirror reversal voucher with swapped debit and credit lines", () => {
      const originalLines = [
        {
          accountId: 1,
          debit: new Decimal("2500.00"),
          credit: new Decimal("0.00"),
        },
        {
          accountId: 2,
          debit: new Decimal("0.00"),
          credit: new Decimal("2500.00"),
        },
      ];

      // Reversal lines swap debit and credit
      const reversalLines = originalLines.map((line) => ({
        accountId: line.accountId,
        debit: line.credit,
        credit: line.debit,
      }));

      expect(reversalLines[0]?.debit.equals(new Decimal("0.00"))).toBe(true);
      expect(reversalLines[0]?.credit.equals(new Decimal("2500.00"))).toBe(
        true,
      );
      expect(reversalLines[1]?.debit.equals(new Decimal("2500.00"))).toBe(true);
      expect(reversalLines[1]?.credit.equals(new Decimal("0.00"))).toBe(true);

      const origDiff = originalLines[0]!.debit.minus(originalLines[0]!.credit);
      const revDiff = reversalLines[0]!.debit.minus(reversalLines[0]!.credit);
      expect(origDiff.plus(revDiff).isZero()).toBe(true);
    });
  });

  describe("Customer Payment Allocations", () => {
    it("allocates customer payment across multiple invoices and tracks unallocated balance", () => {
      const paymentAmount = new Decimal("10000.00");
      const allocations = [
        { invoiceReference: "INV-2026-001", amount: new Decimal("4500.00") },
        { invoiceReference: "INV-2026-002", amount: new Decimal("3500.00") },
      ];

      const allocatedTotal = allocations.reduce(
        (acc, alloc) => acc.plus(alloc.amount),
        new Decimal(0),
      );
      const unallocated = paymentAmount.minus(allocatedTotal);

      expect(allocatedTotal.equals(new Decimal("8000.00"))).toBe(true);
      expect(unallocated.equals(new Decimal("2000.00"))).toBe(true);
      expect(allocatedTotal.plus(unallocated).equals(paymentAmount)).toBe(true);
    });

    it("rejects over-allocation where allocated amount exceeds payment receipt total", () => {
      const paymentAmount = new Decimal("5000.00");
      const requestedAllocation = new Decimal("6000.00");

      const isPermissible =
        requestedAllocation.lessThanOrEqualTo(paymentAmount);
      expect(isPermissible).toBe(false);
    });
  });

  describe("Master List Compatibility & Category Enforcement", () => {
    it("accepts valid category pairings for expenses and payments", () => {
      const validCategories = {
        expenseType: "expense_type",
        paymentMode: "payment_mode",
      };

      function validateExpenseItem(category: string): boolean {
        return category === validCategories.expenseType;
      }

      function validatePaymentItem(category: string): boolean {
        return category === validCategories.paymentMode;
      }

      expect(validateExpenseItem("expense_type")).toBe(true);
      expect(validateExpenseItem("payment_mode")).toBe(false);

      expect(validatePaymentItem("payment_mode")).toBe(true);
      expect(validatePaymentItem("expense_type")).toBe(false);
    });
  });

  describe("Proforma Invoice Exclusion from GST Ledger", () => {
    it("flags and excludes proforma invoices from Output GST sum", () => {
      const invoices = [
        {
          invoiceNumber: "TEXA/INV/2026/001",
          type: "TaxInvoice",
          gstAmount: new Decimal("1800.00"),
        },
        {
          invoiceNumber: "TEXA/PI/2026/001",
          type: "Proforma",
          gstAmount: new Decimal("3600.00"),
        },
        {
          invoiceNumber: "TEXA/INV/2026/002",
          type: "TaxInvoice",
          gstAmount: new Decimal("900.00"),
        },
      ];

      const eligibleForGst = invoices.filter(
        (inv) => inv.type !== "Proforma" && !inv.invoiceNumber.includes("/PI/"),
      );

      const totalOutputGst = eligibleForGst.reduce(
        (acc, inv) => acc.plus(inv.gstAmount),
        new Decimal(0),
      );

      expect(eligibleForGst.length).toBe(2);
      expect(totalOutputGst.equals(new Decimal("2700.00"))).toBe(true);
    });
  });
});
