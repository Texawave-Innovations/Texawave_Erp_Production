import { getAllRecords, getRecordById } from "@/services/firebase";
import { transitionStatus } from "@/modules/scm/shared/statusTransition";
import { PROCUREMENT_PATHS } from "./procurementPaths";
import type {
  QuotationStatus,
  Rfq,
  RfqStatus,
  SupplierQuotation,
} from "@/types";

/** RFQ statuses that still accept supplier quotations. */
export const RFQ_OPEN_FOR_RESPONSES: RfqStatus[] = [
  "RESPONSES_PENDING",
  "PARTIALLY_RESPONDED",
  "RESPONDED",
];

/** Quotations that can still be chosen in a comparison. */
export const SELECTABLE_QUOTATION_STATUSES: QuotationStatus[] = [
  "RECEIVED",
  "UNDER_REVIEW",
  "SHORTLISTED",
];

const INACTIVE_QUOTATION_STATUSES: ReadonlySet<QuotationStatus> =
  new Set<QuotationStatus>(["CANCELLED", "REJECTED"]);

export async function getOpenRfq(rfqId: string): Promise<Rfq> {
  const rfq = (await getRecordById(
    PROCUREMENT_PATHS.rfqs,
    rfqId,
  )) as Rfq | null;
  if (!rfq) throw new Error("RFQ not found. Refresh and try again.");
  if (!RFQ_OPEN_FOR_RESPONSES.includes(rfq.status))
    throw new Error(`RFQ ${rfq.rfqNumber} is not accepting quotations.`);
  return rfq;
}

/** Recomputes an open RFQ's response status from fresh quotation data: a supplier counts as having
 * responded only if it was invited on the RFQ and has a live (not cancelled/rejected) quotation. */
export async function refreshRfqResponseStatus(rfq: Rfq): Promise<RfqStatus> {
  const invited = new Set(rfq.supplierIds || []);
  const quotations = (await getAllRecords(
    PROCUREMENT_PATHS.quotations,
  )) as SupplierQuotation[];
  const responded = new Set(
    quotations
      .filter(
        (q) =>
          q.rfqId === rfq.id &&
          invited.has(q.vendorId) &&
          !INACTIVE_QUOTATION_STATUSES.has(q.status),
      )
      .map((q) => q.vendorId),
  );
  const next: RfqStatus =
    responded.size === 0
      ? "RESPONSES_PENDING"
      : responded.size >= invited.size
        ? "RESPONDED"
        : "PARTIALLY_RESPONDED";
  if (next !== rfq.status)
    await transitionStatus<RfqStatus>(
      PROCUREMENT_PATHS.rfqs,
      rfq.id,
      RFQ_OPEN_FOR_RESPONSES,
      next,
    );
  return next;
}

/** Marks `selectedId` SELECTED and rejects the RFQ's other still-open quotations. */
export async function selectQuotation(
  selectedId: string,
  others: SupplierQuotation[],
): Promise<void> {
  await transitionStatus<QuotationStatus>(
    PROCUREMENT_PATHS.quotations,
    selectedId,
    SELECTABLE_QUOTATION_STATUSES,
    "SELECTED",
  );
  for (const q of others) {
    if (
      q.id === selectedId ||
      !SELECTABLE_QUOTATION_STATUSES.includes(q.status)
    )
      continue;
    await transitionStatus<QuotationStatus>(
      PROCUREMENT_PATHS.quotations,
      q.id,
      SELECTABLE_QUOTATION_STATUSES,
      "REJECTED",
    ).catch(() => undefined);
  }
}
