import { requiredText } from "@texawave-erp/core";
import { z } from "zod";
import {
  blankNull,
  decimal,
  ISO_DATE,
  optionalText,
} from "../shared/priced-form";
import type { DeliveryChallan, DeliveryChallanBody } from "./types";

/** The delivery challan form (no prices). Mirrors
 * apps/api/src/modules/sales/documents/dto/delivery-challan.dto.ts. */

const HSN = /^[0-9]{4,8}$/;

export const challanLineSchema = z.object({
  description: requiredText(500),
  hsnCode: z
    .string()
    .trim()
    .refine((v) => v === "" || HSN.test(v), {
      message: "HSN code must be 4 to 8 digits.",
    }),
  quantity: decimal({
    dp: 3,
    min: 0,
    max: 999_999_999,
    minExclusive: true,
    message: "Enter a quantity above 0 (up to 3 decimals).",
  }),
});

export const challanSchema = z.object({
  customerId: z
    .number()
    .int()
    .positive()
    .nullable()
    .refine((v) => v !== null, { message: "Select a customer." }),
  dcDate: z.string().regex(ISO_DATE, "Enter a date."),
  status: z.enum(["DRAFT", "DISPATCHED"]),
  lines: z
    .array(challanLineSchema)
    .min(1, "Add at least one item.")
    .max(200, "At most 200 items."),
  sealItemId: z.string(),
  signatureItemId: z.string(),
  preparedBy: optionalText(150),
  notes: optionalText(2000),
});

export type ChallanFormValues = z.input<typeof challanSchema>;
export type ChallanLineValues = z.input<typeof challanLineSchema>;

export const emptyChallanLine = (): ChallanLineValues => ({
  description: "",
  hsnCode: "",
  quantity: "1",
});

export function emptyChallanForm(today: string): ChallanFormValues {
  return {
    customerId: null,
    dcDate: today,
    status: "DRAFT",
    lines: [emptyChallanLine()],
    sealItemId: "",
    signatureItemId: "",
    preparedBy: "",
    notes: "",
  };
}

export function challanToForm(dc: DeliveryChallan): ChallanFormValues {
  return {
    customerId: dc.customerId,
    dcDate: dc.dcDate.slice(0, 10),
    status: dc.status,
    lines: dc.lines.map((l) => ({
      description: l.description,
      hsnCode: l.hsnCode ?? "",
      quantity: String(Number(l.quantity)),
    })),
    sealItemId: dc.sealItemId === null ? "" : String(dc.sealItemId),
    signatureItemId:
      dc.signatureItemId === null ? "" : String(dc.signatureItemId),
    preparedBy: dc.preparedBy ?? "",
    notes: dc.notes ?? "",
  };
}

const idOrNull = (v: string) => (v === "" ? null : Number(v));

export function challanToBody(v: ChallanFormValues): DeliveryChallanBody {
  return {
    customerId: v.customerId ?? 0,
    dcDate: v.dcDate,
    status: v.status,
    lines: v.lines.map((l) => ({
      description: l.description.trim(),
      hsnCode: blankNull(l.hsnCode),
      quantity: Number(l.quantity),
    })),
    sealItemId: idOrNull(v.sealItemId),
    signatureItemId: idOrNull(v.signatureItemId),
    ...(v.sealItemId === "" ? { sealName: null } : {}),
    ...(v.signatureItemId === "" ? { signatureName: null } : {}),
    preparedBy: blankNull(v.preparedBy),
    // Blank → the server's standard note.
    notes: blankNull(v.notes),
  };
}
