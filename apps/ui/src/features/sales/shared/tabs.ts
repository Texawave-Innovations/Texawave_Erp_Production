import { SALES_PERMISSIONS } from "../permissions";

export type SalesTabId =
  | "customers"
  | "quotations"
  | "proforma-invoices"
  | "tax-invoices"
  | "delivery-challans"
  | "returnable-dcs"
  | "payments";

/** Tab order follows the sales flow; `read` is the permission that shows it. */
export const SALES_TABS: readonly {
  id: SalesTabId;
  label: string;
  read: string;
}[] = [
  { id: "customers", label: "Customers", read: SALES_PERMISSIONS.customerRead },
  {
    id: "quotations",
    label: "Quotations",
    read: SALES_PERMISSIONS.quotationRead,
  },
  {
    id: "proforma-invoices",
    label: "Proforma Invoices",
    read: SALES_PERMISSIONS.invoiceRead,
  },
  {
    id: "tax-invoices",
    label: "Tax Invoices",
    read: SALES_PERMISSIONS.invoiceRead,
  },
  {
    id: "delivery-challans",
    label: "Delivery Challans",
    read: SALES_PERMISSIONS.deliveryChallanRead,
  },
  {
    id: "returnable-dcs",
    label: "Returnable DCs",
    read: SALES_PERMISSIONS.returnableDcRead,
  },
  {
    id: "payments",
    label: "Payments Received",
    read: SALES_PERMISSIONS.paymentRead,
  },
];

/** Where a tab's list lives — the one place other screens link back to. */
export const salesTabHref = (id: SalesTabId) => `/sales?tab=${id}`;
