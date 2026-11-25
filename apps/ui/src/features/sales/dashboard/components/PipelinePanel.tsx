import { SectionCard } from "@texawave-erp/ui-kit";
import { Meter } from "../../shared/components/Meter";
import { formatInrWhole } from "../../shared/format";
import type { SalesDashboard } from "../types";

export function PipelinePanel({ d }: { d: SalesDashboard }) {
  const p = d.pipeline;
  const stages = [
    ["Quotations", d.kpis.totalQuotations, p.quotations.value],
    ["Billed", d.kpis.invoicesIssued, p.invoices.value],
    ["Collected", d.kpis.paymentsCount, p.payments.value],
  ] as const;
  return (
    <SectionCard title="Pipeline" description="Quotation to cash">
      <Meter
        label="Quotations turned into invoices"
        percent={p.quotationToInvoicePercent}
      />
      <Meter
        label="Invoices with a payment"
        percent={p.invoiceToPaymentPercent}
      />
      <Meter label="Quotation win rate" percent={p.conversionPercent} />
      <dl className="grid grid-cols-3 gap-2 border-t border-gray-100 pt-3 text-center dark:border-gray-800">
        {stages.map(([label, count, value]) => (
          <div key={label}>
            <dt className="text-theme-xs text-gray-500 dark:text-gray-400">
              {label} · {count}
            </dt>
            <dd className="text-theme-sm font-semibold text-gray-900 dark:text-white/90">
              {formatInrWhole(value)}
            </dd>
          </div>
        ))}
      </dl>
    </SectionCard>
  );
}
