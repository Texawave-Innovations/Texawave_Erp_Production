import { Prisma } from "@texawave-erp/database";
import { amountInWords } from "./amount-in-words.js";
import type { DocumentData } from "./document-repository.helpers.js";

/**
 * Pure helpers for the live previews (POST …/preview) of quotations and
 * invoices: what the printable builders need from priced, unsaved data,
 * and the totals the form shows. No I/O.
 */

/** Priced, unsaved data in the shape the printable builders read. */
export function printableFromData(data: DocumentData) {
  return {
    ...data,
    lines: data.lines.map((l) => ({
      ...l,
      quantity: new Prisma.Decimal(l.quantity),
      unitPrice: new Prisma.Decimal(l.unitPrice),
    })),
    amountInWords: amountInWords(data.totalAmount),
  };
}

/** The server's figures, shown beside the preview. */
export function previewTotals(data: DocumentData) {
  return {
    placeOfSupply: data.placeOfSupply,
    taxMode: data.taxMode,
    itemsSubtotal: data.itemsSubtotal,
    transportCharge: data.transportCharge,
    taxableAmount: data.taxableAmount,
    cgstRate: data.cgstRate,
    sgstRate: data.sgstRate,
    igstRate: data.igstRate,
    cgstAmount: data.cgstAmount,
    sgstAmount: data.sgstAmount,
    igstAmount: data.igstAmount,
    roundOff: data.roundOff,
    totalAmount: data.totalAmount,
    amountInWords: amountInWords(data.totalAmount),
    lineAmounts: data.lines.map((l) => l.amount),
  };
}
