import { Injectable } from "@nestjs/common";
import { Prisma } from "@texawave-erp/database";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";

const D = (v: Prisma.Decimal.Value | null | undefined) =>
  new Prisma.Decimal(v ?? 0);

/**
 * Aggregates for the Sales dashboard (read-only). "Revenue" and "invoices"
 * mean live TAX invoices; collections are live payments on live invoices
 * (a proforma's advance counts when received). Aging is by days past the
 * due date (the invoice date when there is none) of unpaid tax invoices.
 */
@Injectable()
export class DocumentFiguresRepository {
  constructor(private readonly prisma: PrismaService) {}

  @OrgScoped()
  async figures(scope: OrgScope, today: Date) {
    const org = scope.organizationId;
    const year = today.getUTCFullYear();
    const monthStart = new Date(Date.UTC(year, today.getUTCMonth(), 1));
    const nextMonth = new Date(Date.UTC(year, today.getUTCMonth() + 1, 1));
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const nextYear = new Date(Date.UTC(year + 1, 0, 1));

    const [q] = await this.prisma.$queryRaw<
      Array<{
        total: number;
        this_month: number;
        pending: number;
        won: number;
        value: Prisma.Decimal | null;
      }>
    >`
      SELECT count(*)::int AS total,
             count(*) FILTER (WHERE quotation_date >= ${monthStart} AND quotation_date < ${nextMonth})::int AS this_month,
             count(*) FILTER (WHERE status = 'OPEN')::int AS pending,
             count(*) FILTER (WHERE status = 'CONVERTED')::int AS won,
             sum(total_amount) AS value
        FROM sales.quotations
       WHERE organization_id = ${org} AND deleted_at IS NULL`;

    const [inv] = await this.prisma.$queryRaw<
      Array<{
        total: number;
        this_month: number;
        unpaid: number;
        with_payment: number;
        billed: Prisma.Decimal | null;
        revenue_month: Prisma.Decimal | null;
        outstanding: Prisma.Decimal | null;
        a0_count: number;
        a0: Prisma.Decimal | null;
        a31_count: number;
        a31: Prisma.Decimal | null;
        a61_count: number;
        a61: Prisma.Decimal | null;
        a90_count: number;
        a90: Prisma.Decimal | null;
      }>
    >`
      WITH t AS (
        SELECT invoice_date, total_amount, amount_received,
               total_amount - amount_received AS balance,
               (${today}::date - COALESCE(due_date, invoice_date)) AS overdue
          FROM sales.invoices
         WHERE organization_id = ${org} AND deleted_at IS NULL
           AND invoice_type = 'TAX')
      SELECT count(*)::int AS total,
             count(*) FILTER (WHERE invoice_date >= ${monthStart} AND invoice_date < ${nextMonth})::int AS this_month,
             count(*) FILTER (WHERE balance > 0)::int AS unpaid,
             count(*) FILTER (WHERE amount_received > 0)::int AS with_payment,
             sum(total_amount) AS billed,
             sum(total_amount) FILTER (WHERE invoice_date >= ${monthStart} AND invoice_date < ${nextMonth}) AS revenue_month,
             sum(balance) AS outstanding,
             count(*) FILTER (WHERE balance > 0 AND overdue <= 30)::int AS a0_count,
             sum(balance) FILTER (WHERE balance > 0 AND overdue <= 30) AS a0,
             count(*) FILTER (WHERE balance > 0 AND overdue BETWEEN 31 AND 60)::int AS a31_count,
             sum(balance) FILTER (WHERE balance > 0 AND overdue BETWEEN 31 AND 60) AS a31,
             count(*) FILTER (WHERE balance > 0 AND overdue BETWEEN 61 AND 90)::int AS a61_count,
             sum(balance) FILTER (WHERE balance > 0 AND overdue BETWEEN 61 AND 90) AS a61,
             count(*) FILTER (WHERE balance > 0 AND overdue > 90)::int AS a90_count,
             sum(balance) FILTER (WHERE balance > 0 AND overdue > 90) AS a90
        FROM t`;

    const [pay] = await this.prisma.$queryRaw<
      Array<{ count: number; collected: Prisma.Decimal | null }>
    >`
      SELECT count(*)::int AS count, sum(p.amount) AS collected
        FROM sales.invoice_payments p
        JOIN sales.invoices i ON i.id = p.invoice_id
       WHERE p.organization_id = ${org} AND p.deleted_at IS NULL
         AND i.deleted_at IS NULL`;

    const revenueByMonth = await this.prisma.$queryRaw<
      Array<{ month: number; amount: Prisma.Decimal }>
    >`
      SELECT extract(month FROM invoice_date)::int AS month, sum(total_amount) AS amount
        FROM sales.invoices
       WHERE organization_id = ${org} AND deleted_at IS NULL AND invoice_type = 'TAX'
         AND invoice_date >= ${yearStart} AND invoice_date < ${nextYear}
       GROUP BY 1`;

    const collectionsByMonth = await this.prisma.$queryRaw<
      Array<{ month: number; amount: Prisma.Decimal }>
    >`
      SELECT extract(month FROM p.payment_date)::int AS month, sum(p.amount) AS amount
        FROM sales.invoice_payments p
        JOIN sales.invoices i ON i.id = p.invoice_id
       WHERE p.organization_id = ${org} AND p.deleted_at IS NULL AND i.deleted_at IS NULL
         AND p.payment_date >= ${yearStart} AND p.payment_date < ${nextYear}
       GROUP BY 1`;

    const topClients = await this.prisma.$queryRaw<
      Array<{
        customer_id: number;
        company_name: string;
        revenue: Prisma.Decimal;
      }>
    >`
      SELECT i.customer_id, c.company_name, sum(i.total_amount) AS revenue
        FROM sales.invoices i
        JOIN sales.customers c ON c.id = i.customer_id
       WHERE i.organization_id = ${org} AND i.deleted_at IS NULL
         AND i.invoice_type = 'TAX'
         AND i.invoice_date >= ${yearStart} AND i.invoice_date < ${nextYear}
       GROUP BY i.customer_id, c.company_name
       ORDER BY revenue DESC, i.customer_id
       LIMIT 5`;

    const recent = await this.prisma.$queryRaw<
      Array<{
        document_type: string;
        document_number: string;
        status: string;
        customer_name: string;
        amount: Prisma.Decimal;
        date: Date;
      }>
    >`
      SELECT * FROM (
        SELECT 'QUOTATION' AS document_type, quotation_number AS document_number, status,
               customer_snapshot->>'companyName' AS customer_name, total_amount AS amount,
               quotation_date AS date, created_at
          FROM sales.quotations
         WHERE organization_id = ${org} AND deleted_at IS NULL
        UNION ALL
        SELECT CASE invoice_type WHEN 'TAX' THEN 'TAX_INVOICE' ELSE 'PROFORMA_INVOICE' END,
               invoice_number, status, customer_snapshot->>'companyName', total_amount,
               invoice_date, created_at
          FROM sales.invoices
         WHERE organization_id = ${org} AND deleted_at IS NULL
      ) d
      ORDER BY created_at DESC
      LIMIT 10`;

    const byMonth = (rows: Array<{ month: number; amount: Prisma.Decimal }>) =>
      new Map(rows.map((r) => [r.month, D(r.amount)]));
    const revenue = byMonth(revenueByMonth);
    const collections = byMonth(collectionsByMonth);

    return {
      quotations: {
        total: q?.total ?? 0,
        thisMonth: q?.this_month ?? 0,
        pending: q?.pending ?? 0,
        won: q?.won ?? 0,
        value: D(q?.value),
      },
      invoices: {
        total: inv?.total ?? 0,
        thisMonth: inv?.this_month ?? 0,
        unpaid: inv?.unpaid ?? 0,
        withPayment: inv?.with_payment ?? 0,
        billedValue: D(inv?.billed),
        revenueThisMonth: D(inv?.revenue_month),
        outstanding: D(inv?.outstanding),
        aging: {
          current: { amount: D(inv?.a0), count: inv?.a0_count ?? 0 },
          days31to60: { amount: D(inv?.a31), count: inv?.a31_count ?? 0 },
          days61to90: { amount: D(inv?.a61), count: inv?.a61_count ?? 0 },
          days90plus: { amount: D(inv?.a90), count: inv?.a90_count ?? 0 },
        },
      },
      payments: { count: pay?.count ?? 0, collected: D(pay?.collected) },
      monthly: Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        revenue: revenue.get(i + 1) ?? D(0),
        collections: collections.get(i + 1) ?? D(0),
      })),
      topClients: topClients.map((c) => ({
        customerId: c.customer_id,
        companyName: c.company_name,
        revenue: D(c.revenue),
      })),
      recentActivity: recent.map((r) => ({
        documentType: r.document_type,
        documentNumber: r.document_number,
        status: r.status,
        customerName: r.customer_name,
        amount: D(r.amount),
        date: r.date.toISOString().slice(0, 10),
      })),
    };
  }
}
