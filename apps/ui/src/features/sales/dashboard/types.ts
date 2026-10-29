/** Mirrors `SalesDashboard` (apps/api/src/modules/sales/dashboard/
 * dashboard.rules.ts). Money is a 2-dp decimal string. */

export type DashboardSource =
  | "customers"
  | "action_items"
  | "quotations"
  | "invoices"
  | "payments"
  | "credit_notes"
  | "returnable_dcs";

export type AttentionKind =
  | "unpaid_invoices"
  | "pending_quotations"
  | "overdue_invoices"
  | "open_returnable_dcs"
  | "overdue_follow_ups";

export interface SalesDashboard {
  year: number;
  availability: Record<DashboardSource, boolean>;
  kpis: {
    monthlyRevenue: string;
    outstandingDues: string;
    totalQuotations: number;
    quotationsThisMonth: number;
    invoicesIssued: number;
    invoicesThisMonth: number;
    activeCustomers: number;
    totalCustomers: number;
    paymentsCollected: string;
    paymentsCount: number;
    creditNotes: number;
  };
  pipeline: {
    quotations: { count: number; pending: number; value: string };
    invoices: { count: number; unpaid: number; value: string };
    payments: { count: number; value: string };
    quotationToInvoicePercent: number;
    invoiceToPaymentPercent: number;
    conversionPercent: number;
    stuckAtInvoicing: string;
  };
  monthlyRevenueVsCollections: Array<{
    month: number;
    revenue: string;
    collections: string;
  }>;
  quotationConversion: {
    winRatePercent: number;
    won: number;
    totalQuotations: number;
    pendingCustomerSignOff: number;
    billedInvoices: number;
    paymentsSettled: number;
  };
  receivables: {
    collected: string;
    outstanding: string;
    collectedPercent: number;
    aging: Array<{ bucket: string; amount: string; count: number }>;
  };
  topClients: Array<{
    rank: number;
    customerId: number;
    companyName: string;
    revenue: string;
    sharePercent: number;
  }>;
  needsAttention: Array<{
    kind: AttentionKind;
    priority: "high" | "medium" | "critical" | "info";
    count: number;
    amount: string | null;
  }>;
  recentActivity: Array<{
    documentType: string;
    documentNumber: string;
    status: string;
    customerName: string;
    amount: string;
    date: string;
  }>;
  checklist: { open: number; overdue: number };
}

/** GET /sales/action-items rows. */
export interface ActionItem {
  id: number;
  title: string;
  dueDate: string | null;
  isDone: boolean;
  completedAt: string | null;
  createdAt: string;
}
