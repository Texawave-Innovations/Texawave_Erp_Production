import { QuotationForm } from "@/features/crm/quotations/components/QuotationForm";

/** Supports legacy's "New Quote from Deal" preselection
 * (`?accountId=&dealId=`, matching `DealDetail.tsx`'s own query param
 * names — Docs/CRM_QUOTES_LEGACY_PARITY.md §1.1/§1.3). */
export default async function CrmNewQuotePage({
  searchParams,
}: {
  searchParams: Promise<{ accountId?: string; dealId?: string }>;
}) {
  const { accountId, dealId } = await searchParams;
  return (
    <QuotationForm
      initialAccountId={accountId ? Number(accountId) : undefined}
      initialOpportunityId={dealId ? Number(dealId) : undefined}
    />
  );
}
