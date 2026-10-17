/**
 * Sales permission codes, for UI visibility only — the API guards every
 * route and is authoritative. Sales is organization-scoped, so these are
 * exact codes (no `.own/.team/.all`). Catalogue:
 * packages/database/prisma/permissions/catalog.ts.
 */
export const SALES_PERMISSIONS = {
  dashboardRead: "sales.dashboard.read",
  customerRead: "sales.customer.read",
  customerWrite: "sales.customer.write",
  customerDelete: "sales.customer.delete",
  customerBankReveal: "sales.customer_bank.reveal",
  actionItemRead: "sales.action_item.read",
  actionItemWrite: "sales.action_item.write",
  masterRead: "sales.master.read",
  /** Code formats, company details and logo, document fields. */
  masterWrite: "sales.master.write",
  runningNumberWrite: "sales.running_number.write",
  quotationRead: "sales.quotation.read",
  quotationWrite: "sales.quotation.write",
  quotationDelete: "sales.quotation.delete",
  quotationSend: "sales.quotation.send",
  invoiceRead: "sales.invoice.read",
  /** Also: converting a quotation, moving a proforma to a tax invoice. */
  invoiceWrite: "sales.invoice.write",
  invoiceDelete: "sales.invoice.delete",
  invoiceSend: "sales.invoice.send",
  /** Record, edit and delete payments received. */
  invoicePaymentWrite: "sales.invoice_payment.write",
  paymentRead: "sales.payment.read",
  deliveryChallanRead: "sales.delivery_challan.read",
  deliveryChallanWrite: "sales.delivery_challan.write",
  deliveryChallanDelete: "sales.delivery_challan.delete",
  deliveryChallanSend: "sales.delivery_challan.send",
  returnableDcRead: "sales.returnable_dc.read",
  /** Also: mark returned and reopen. */
  returnableDcWrite: "sales.returnable_dc.write",
  returnableDcDelete: "sales.returnable_dc.delete",
  returnableDcSend: "sales.returnable_dc.send",
} as const;
