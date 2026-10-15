import { Prisma } from "@texawave-erp/database";

/**
 * Pure builder for `GET /sales/dashboard` — every number the legacy "Sales
 * Analytics & Dashboard" screen shows, from figures each source module
 * supplies. No I/O, so every formula is unit-tested here.
 *
 * Only customers and the checklist exist today. Quotations, invoices,
 * payments, credit notes and returnable DCs are not built yet: their figures
 * are `NO_DOCUMENT_FIGURES` (all zero), and `availability` says so, so the UI
 * can tell "nothing yet" from "module not built". Each module, when it lands,
 * supplies its own part of `DocumentFigures` — the response shape does not
 * change.
 *
 * Formulas (money as 2-dp strings, percentages rounded to 1 dp):
 * - pipeline quotation→invoice % = invoices / quotations
 * - pipeline invoice→payment %   = invoices with a payment / invoices
 * - conversion % (win rate)      = accepted-or-converted quotations / quotations
 * - collected %                  = collected / (collected + outstanding)
 * - stuck at invoicing           = outstanding receivables
 * - revenue counts tax invoices only (no proforma, draft, void, cancelled)
 */

type Money = Prisma.Decimal;
const ZERO = new Prisma.Decimal(0);
const money = (v: Money) => v.toFixed(2);

export interface AgingBucket {
  amount: Money;
  count: number;
}

/** What the not-yet-built document modules will report. */
export interface DocumentFigures {
  quotations: {
    total: number;
    thisMonth: number;
    /** Sent, awaiting the customer. */
    pending: number;
    /** Accepted or converted. */
    won: number;
    value: Money;
  };
  invoices: {
    total: number;
    thisMonth: number;
    unpaid: number;
    /** Invoices with at least one payment. */
    withPayment: number;
    billedValue: Money;
    revenueThisMonth: Money;
    outstanding: Money;
    aging: {
      current: AgingBucket;
      days31to60: AgingBucket;
      days61to90: AgingBucket;
      days90plus: AgingBucket;
    };
  };
  payments: { count: number; collected: Money };
  creditNotes: { count: number };
  returnableDcs: { total: number; open: number };
  /** Calendar months 1–12 of the current year. */
  monthly: Array<{ month: number; revenue: Money; collections: Money }>;
  topClients: Array<{
    customerId: number;
    companyName: string;
    revenue: Money;
  }>;
  recentActivity: Array<{
    documentType: string;
    documentNumber: string;
    status: string;
    customerName: string;
    amount: Money;
    date: string;
  }>;
}

const bucket = (): AgingBucket => ({ amount: ZERO, count: 0 });

export const NO_DOCUMENT_FIGURES: DocumentFigures = {
  quotations: { total: 0, thisMonth: 0, pending: 0, won: 0, value: ZERO },
  invoices: {
    total: 0,
    thisMonth: 0,
    unpaid: 0,
    withPayment: 0,
    billedValue: ZERO,
    revenueThisMonth: ZERO,
    outstanding: ZERO,
    aging: {
      current: bucket(),
      days31to60: bucket(),
      days61to90: bucket(),
      days90plus: bucket(),
    },
  },
  payments: { count: 0, collected: ZERO },
  creditNotes: { count: 0 },
  returnableDcs: { total: 0, open: 0 },
  monthly: Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    revenue: ZERO,
    collections: ZERO,
  })),
  topClients: [],
  recentActivity: [],
};

export const DASHBOARD_SOURCES = [
  "customers",
  "action_items",
  "quotations",
  "invoices",
  "payments",
  "credit_notes",
  "returnable_dcs",
] as const;
export type DashboardSource = (typeof DASHBOARD_SOURCES)[number];

export interface DashboardInput {
  customers: { active: number; inactive: number };
  checklist: { open: number; overdue: number };
  documents: DocumentFigures;
  /** Sources that are built and feeding real data. */
  live: readonly DashboardSource[];
  year: number;
}

/** a / b as a percentage, 1 dp; 0 when b is 0. */
export function percent(a: number | Money, b: number | Money): number {
  const den = new Prisma.Decimal(b);
  if (den.isZero()) return 0;
  return new Prisma.Decimal(a)
    .times(100)
    .dividedBy(den)
    .toDecimalPlaces(1, Prisma.Decimal.ROUND_HALF_UP)
    .toNumber();
}

export type AttentionKind =
  | "unpaid_invoices"
  | "pending_quotations"
  | "overdue_invoices"
  | "open_returnable_dcs"
  | "overdue_follow_ups";

export function buildSalesDashboard(input: DashboardInput) {
  const { documents: d, customers, checklist } = input;
  const q = d.quotations;
  const inv = d.invoices;
  const pay = d.payments;
  const totalBilledAndCollected = pay.collected.plus(inv.outstanding);

  const needsAttention: Array<{
    kind: AttentionKind;
    priority: "high" | "medium" | "critical" | "info";
    count: number;
    amount: string | null;
  }> = [];
  if (inv.unpaid > 0) {
    needsAttention.push({
      kind: "unpaid_invoices",
      priority: "high",
      count: inv.unpaid,
      amount: money(inv.outstanding),
    });
  }
  if (q.pending > 0) {
    needsAttention.push({
      kind: "pending_quotations",
      priority: "medium",
      count: q.pending,
      amount: null,
    });
  }
  if (inv.aging.days90plus.count > 0) {
    needsAttention.push({
      kind: "overdue_invoices",
      priority: "critical",
      count: inv.aging.days90plus.count,
      amount: money(inv.aging.days90plus.amount),
    });
  }
  if (d.returnableDcs.open > 0) {
    needsAttention.push({
      kind: "open_returnable_dcs",
      priority: "info",
      count: d.returnableDcs.open,
      amount: null,
    });
  }
  if (checklist.overdue > 0) {
    needsAttention.push({
      kind: "overdue_follow_ups",
      priority: "medium",
      count: checklist.overdue,
      amount: null,
    });
  }

  const totalRevenueTop = d.topClients.reduce(
    (acc, c) => acc.plus(c.revenue),
    ZERO,
  );

  return {
    year: input.year,
    availability: Object.fromEntries(
      DASHBOARD_SOURCES.map((s) => [s, input.live.includes(s)]),
    ) as Record<DashboardSource, boolean>,
    kpis: {
      monthlyRevenue: money(inv.revenueThisMonth),
      outstandingDues: money(inv.outstanding),
      totalQuotations: q.total,
      quotationsThisMonth: q.thisMonth,
      invoicesIssued: inv.total,
      invoicesThisMonth: inv.thisMonth,
      activeCustomers: customers.active,
      totalCustomers: customers.active + customers.inactive,
      paymentsCollected: money(pay.collected),
      paymentsCount: pay.count,
      creditNotes: d.creditNotes.count,
    },
    pipeline: {
      quotations: { count: q.total, pending: q.pending, value: money(q.value) },
      invoices: {
        count: inv.total,
        unpaid: inv.unpaid,
        value: money(inv.billedValue),
      },
      payments: { count: pay.count, value: money(pay.collected) },
      quotationToInvoicePercent: percent(inv.total, q.total),
      invoiceToPaymentPercent: percent(inv.withPayment, inv.total),
      conversionPercent: percent(q.won, q.total),
      stuckAtInvoicing: money(inv.outstanding),
    },
    monthlyRevenueVsCollections: d.monthly.map((m) => ({
      month: m.month,
      revenue: money(m.revenue),
      collections: money(m.collections),
    })),
    quotationConversion: {
      winRatePercent: percent(q.won, q.total),
      won: q.won,
      totalQuotations: q.total,
      pendingCustomerSignOff: q.pending,
      billedInvoices: inv.total,
      paymentsSettled: pay.count,
    },
    receivables: {
      collected: money(pay.collected),
      outstanding: money(inv.outstanding),
      collectedPercent: percent(pay.collected, totalBilledAndCollected),
      aging: [
        { bucket: "0-30", ...agingView(inv.aging.current) },
        { bucket: "31-60", ...agingView(inv.aging.days31to60) },
        { bucket: "61-90", ...agingView(inv.aging.days61to90) },
        { bucket: "90+", ...agingView(inv.aging.days90plus) },
      ],
    },
    topClients: d.topClients.slice(0, 5).map((c, i) => ({
      rank: i + 1,
      customerId: c.customerId,
      companyName: c.companyName,
      revenue: money(c.revenue),
      sharePercent: percent(c.revenue, totalRevenueTop),
    })),
    documentOverview: {
      quotations: { total: q.total, thisMonth: q.thisMonth },
      taxInvoices: { total: inv.total, thisMonth: inv.thisMonth },
      paymentsReceived: { total: pay.count, amount: money(pay.collected) },
      creditNotes: { total: d.creditNotes.count },
      returnableDcs: { total: d.returnableDcs.total },
    },
    needsAttention,
    recentActivity: d.recentActivity.map((a) => ({
      ...a,
      amount: money(a.amount),
    })),
    checklist,
  };
}

function agingView(b: AgingBucket) {
  return { amount: money(b.amount), count: b.count };
}

export type SalesDashboard = ReturnType<typeof buildSalesDashboard>;
