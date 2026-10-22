import type { RequisitionPriority } from "@/types";
import { toLocalDateKey } from "@/modules/scm/shared/format";

export type RequisitionItemDraft = {
  productCode: string;
  quantity: string;
  estimatedUnitCost: string;
  requiredDate: string;
  notes: string;
};

export function emptyRequisitionItem(): RequisitionItemDraft {
  return {
    productCode: "",
    quantity: "",
    estimatedUnitCost: "",
    requiredDate: "",
    notes: "",
  };
}

export interface RequisitionFormState {
  department: string;
  requestDate: string;
  requiredDate: string;
  priority: RequisitionPriority;
  warehouseId: string;
  purpose: string;
  notes: string;
  tax: string;
}

export function emptyRequisitionForm(warehouseId = ""): RequisitionFormState {
  return {
    department: "",
    requestDate: toLocalDateKey(),
    requiredDate: "",
    priority: "Normal",
    warehouseId,
    purpose: "",
    notes: "",
    tax: "0",
  };
}

/** Pre-filled content for a new requisition (e.g. from a sales-order shortage). */
export interface RequisitionPrefill {
  form: RequisitionFormState;
  items: RequisitionItemDraft[];
  sourceSalesOrder?: { id: string; number: string };
}
