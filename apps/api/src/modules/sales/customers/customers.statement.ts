import { Prisma } from "@texawave-erp/database";

/** One ledger line: a tax invoice raises the balance (debit), a payment
 * lowers it (credit). Money is exact decimal strings, never floats. */
export interface StatementEntry {
  date: string;
  type: "INVOICE" | "PAYMENT";
  number: string;
  description: string;
  debit: string;
  credit: string;
  balance: string;
}

export interface StatementInvoice {
  id: number;
  invoiceNumber: string;
  invoiceDate: Date;
  totalAmount: Prisma.Decimal;
}

export interface StatementPayment {
  id: number;
  paymentNumber: string;
  paymentDate: Date;
  amount: Prisma.Decimal;
  mode: string;
  reference: string | null;
  invoiceNumber: string;
}

export interface CustomerStatement {
  from: string | null;
  to: string | null;
  openingBalance: string;
  totalInvoiced: string;
  totalReceived: string;
  closingBalance: string;
  entries: StatementEntry[];
}

const day = (d: Date) => d.toISOString().slice(0, 10);

/** Running balance over the period, starting from `opening` (what the
 * customer owed before `from`). Same-day order: invoices before payments. */
export function buildStatement(
  range: { from: string | null; to: string | null },
  opening: Prisma.Decimal,
  invoices: readonly StatementInvoice[],
  payments: readonly StatementPayment[],
): CustomerStatement {
  const zero = new Prisma.Decimal(0);
  const lines = [
    ...invoices.map((i) => ({
      date: day(i.invoiceDate),
      rank: 0,
      id: i.id,
      type: "INVOICE" as const,
      number: i.invoiceNumber,
      description: "Tax invoice",
      debit: i.totalAmount,
      credit: zero,
    })),
    ...payments.map((p) => ({
      date: day(p.paymentDate),
      rank: 1,
      id: p.id,
      type: "PAYMENT" as const,
      number: p.paymentNumber,
      description: [`Payment against ${p.invoiceNumber}`, p.mode, p.reference]
        .filter(Boolean)
        .join(" · "),
      debit: zero,
      credit: p.amount,
    })),
  ].sort(
    (a, b) => a.date.localeCompare(b.date) || a.rank - b.rank || a.id - b.id,
  );

  let balance = opening;
  let invoiced = zero;
  let received = zero;
  const entries = lines.map((l): StatementEntry => {
    balance = balance.plus(l.debit).minus(l.credit);
    invoiced = invoiced.plus(l.debit);
    received = received.plus(l.credit);
    return {
      date: l.date,
      type: l.type,
      number: l.number,
      description: l.description,
      debit: l.debit.toFixed(2),
      credit: l.credit.toFixed(2),
      balance: balance.toFixed(2),
    };
  });

  return {
    ...range,
    openingBalance: opening.toFixed(2),
    totalInvoiced: invoiced.toFixed(2),
    totalReceived: received.toFixed(2),
    closingBalance: balance.toFixed(2),
    entries,
  };
}
