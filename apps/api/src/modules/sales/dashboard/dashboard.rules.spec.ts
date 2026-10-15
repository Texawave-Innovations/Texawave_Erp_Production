import { Prisma } from "@texawave-erp/database";
import {
  buildSalesDashboard,
  type DocumentFigures,
  NO_DOCUMENT_FIGURES,
  percent,
} from "./dashboard.rules.js";

const D = (v: string | number) => new Prisma.Decimal(v);

describe("percent", () => {
  it("rounds to 1 dp and is 0 when the base is 0", () => {
    expect(percent(1, 3)).toBe(33.3);
    expect(percent(2, 3)).toBe(66.7);
    expect(percent(5, 0)).toBe(0);
    expect(percent(D("3708"), D("21590.9"))).toBe(17.2);
  });
});

describe("buildSalesDashboard", () => {
  it("today: customers and checklist are live, every document figure is zero", () => {
    const d = buildSalesDashboard({
      year: 2026,
      customers: { active: 2, inactive: 1 },
      checklist: { open: 3, overdue: 0 },
      documents: NO_DOCUMENT_FIGURES,
      live: ["customers", "action_items"],
    });
    expect(d.availability).toEqual({
      customers: true,
      action_items: true,
      quotations: false,
      invoices: false,
      payments: false,
      credit_notes: false,
      returnable_dcs: false,
    });
    expect(d.kpis).toMatchObject({
      activeCustomers: 2,
      totalCustomers: 3,
      monthlyRevenue: "0.00",
      outstandingDues: "0.00",
      totalQuotations: 0,
    });
    expect(d.monthlyRevenueVsCollections).toHaveLength(12);
    expect(d.monthlyRevenueVsCollections[0]).toEqual({
      month: 1,
      revenue: "0.00",
      collections: "0.00",
    });
    expect(d.receivables.aging.map((a) => a.bucket)).toEqual([
      "0-30",
      "31-60",
      "61-90",
      "90+",
    ]);
    expect(d.needsAttention).toEqual([]);
    expect(d.topClients).toEqual([]);
    expect(d.checklist).toEqual({ open: 3, overdue: 0 });
  });

  it("derives pipeline, conversion, receivables and attention items from document figures", () => {
    // The legacy screenshot: 2 quotations (1 pending), 4 invoices (3 unpaid),
    // 3 payments of ₹3,708, ₹17,882.90 outstanding, 2 invoices 90+ days.
    const docs: DocumentFigures = {
      ...NO_DOCUMENT_FIGURES,
      quotations: {
        total: 2,
        thisMonth: 0,
        pending: 1,
        won: 0,
        value: D("789.5"),
      },
      invoices: {
        ...NO_DOCUMENT_FIGURES.invoices,
        total: 4,
        unpaid: 3,
        withPayment: 3,
        billedValue: D("18590.9"),
        outstanding: D("17882.9"),
        aging: {
          ...NO_DOCUMENT_FIGURES.invoices.aging,
          days31to60: { amount: D(0), count: 1 },
          days90plus: { amount: D("17882.9"), count: 2 },
        },
      },
      payments: { count: 3, collected: D("3708") },
      creditNotes: { count: 3 },
      returnableDcs: { total: 1, open: 1 },
      topClients: [
        {
          customerId: 1,
          companyName: "Global Enterprises Pvt Ltd",
          revenue: D("17882.9"),
        },
        { customerId: 2, companyName: "DEV TOOL", revenue: D("708") },
      ],
    };
    const d = buildSalesDashboard({
      year: 2026,
      customers: { active: 2, inactive: 0 },
      checklist: { open: 0, overdue: 1 },
      documents: docs,
      live: ["customers", "action_items"],
    });

    expect(d.pipeline).toMatchObject({
      quotationToInvoicePercent: 200,
      invoiceToPaymentPercent: 75,
      conversionPercent: 0,
      stuckAtInvoicing: "17882.90",
    });
    expect(d.receivables).toMatchObject({
      collected: "3708.00",
      outstanding: "17882.90",
      collectedPercent: 17.2,
    });
    expect(d.receivables.aging[3]).toEqual({
      bucket: "90+",
      amount: "17882.90",
      count: 2,
    });
    expect(d.topClients.map((c) => c.sharePercent)).toEqual([96.2, 3.8]);
    expect(d.topClients[0]?.rank).toBe(1);
    expect(d.needsAttention.map((a) => a.kind)).toEqual([
      "unpaid_invoices",
      "pending_quotations",
      "overdue_invoices",
      "open_returnable_dcs",
      "overdue_follow_ups",
    ]);
    expect(d.documentOverview.creditNotes.total).toBe(3);
  });

  it("caps top clients at five", () => {
    const d = buildSalesDashboard({
      year: 2026,
      customers: { active: 0, inactive: 0 },
      checklist: { open: 0, overdue: 0 },
      documents: {
        ...NO_DOCUMENT_FIGURES,
        topClients: Array.from({ length: 8 }, (_, i) => ({
          customerId: i,
          companyName: `C${i}`,
          revenue: D(100),
        })),
      },
      live: [],
    });
    expect(d.topClients).toHaveLength(5);
  });
});
