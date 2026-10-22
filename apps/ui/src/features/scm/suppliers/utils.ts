import type { Supplier, SupplierStatus } from "@texawave-erp/api-types";

type StatusColorToken = "success" | "gray" | "warning" | "error";

/** Legacy `statusBadgeTone`: Active green, Inactive slate, Pending amber,
 * Blocked rose. */
export function supplierStatusToken(status: SupplierStatus): StatusColorToken {
  switch (status) {
    case "Active":
      return "success";
    case "Inactive":
      return "gray";
    case "Pending Approval":
      return "warning";
    case "Blocked":
      return "error";
  }
}

export function formatSupplierMoney(value: string | number, currency: string) {
  const amount = Number(value);
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString("en-IN")}`;
  }
}

export function formatSupplierDateTime(iso: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function supplierAddressLine(
  supplier: Pick<Supplier, "street" | "city" | "state">,
) {
  return [supplier.street, supplier.city, supplier.state]
    .filter(Boolean)
    .join(", ");
}

/** Legacy "Deactivate/Activate" power toggle only flips Active <-> Inactive;
 * Pending Approval and Blocked must be changed via the edit form. */
export function toggledStatus(status: SupplierStatus): SupplierStatus | null {
  if (status === "Active") return "Inactive";
  if (status === "Inactive") return "Active";
  return null;
}
