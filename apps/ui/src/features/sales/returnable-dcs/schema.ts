import { requiredText } from "@texawave-erp/core";
import { z } from "zod";
import {
  blankNull,
  decimal,
  ISO_DATE,
  optionalText,
} from "../shared/priced-form";
import type { ReturnableDc, ReturnableDcBody } from "./types";

/** The returnable DC form (items lent and when they come back). Mirrors
 * apps/api/src/modules/sales/documents/dto/returnable-dc.dto.ts. */

export const rdcLineSchema = z.object({
  description: requiredText(500),
  quantity: decimal({
    dp: 3,
    min: 0,
    max: 999_999_999,
    minExclusive: true,
    message: "Enter a quantity above 0 (up to 3 decimals).",
  }),
});

export const rdcSchema = z
  .object({
    customerId: z
      .number()
      .int()
      .positive()
      .nullable()
      .refine((v) => v !== null, { message: "Select a recipient." }),
    issueDate: z.string().regex(ISO_DATE, "Enter a date."),
    purpose: requiredText(200),
    expectedReturnDate: z.string().regex(ISO_DATE, "Enter a date."),
    takenBy: optionalText(150),
    lines: z
      .array(rdcLineSchema)
      .min(1, "Add at least one item.")
      .max(200, "At most 200 items."),
    sealItemId: z.string(),
    signatureItemId: z.string(),
    preparedBy: optionalText(150),
    notes: optionalText(2000),
  })
  .refine(
    (v) =>
      !ISO_DATE.test(v.issueDate) ||
      !ISO_DATE.test(v.expectedReturnDate) ||
      v.expectedReturnDate >= v.issueDate,
    {
      path: ["expectedReturnDate"],
      message: "The return date cannot be before the issue date.",
    },
  );

export type RdcFormValues = z.input<typeof rdcSchema>;
export type RdcLineValues = z.input<typeof rdcLineSchema>;

export const emptyRdcLine = (): RdcLineValues => ({
  description: "",
  quantity: "1",
});

/** Suggested purposes; any text is allowed. */
export const RDC_PURPOSES = [
  "Demonstration / Testing",
  "Repair / Service",
  "Trial / Evaluation",
  "Exhibition",
  "Job work",
] as const;

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function emptyRdcForm(today: string): RdcFormValues {
  return {
    customerId: null,
    issueDate: today,
    purpose: RDC_PURPOSES[0],
    expectedReturnDate: addDays(today, 14),
    takenBy: "",
    lines: [emptyRdcLine()],
    sealItemId: "",
    signatureItemId: "",
    preparedBy: "",
    notes: "",
  };
}

export function rdcToForm(rdc: ReturnableDc): RdcFormValues {
  return {
    customerId: rdc.customerId,
    issueDate: rdc.issueDate.slice(0, 10),
    purpose: rdc.purpose,
    expectedReturnDate: rdc.expectedReturnDate.slice(0, 10),
    takenBy: rdc.takenBy ?? "",
    lines: rdc.lines.map((l) => ({
      description: l.description,
      quantity: String(Number(l.quantity)),
    })),
    sealItemId: rdc.sealItemId === null ? "" : String(rdc.sealItemId),
    signatureItemId:
      rdc.signatureItemId === null ? "" : String(rdc.signatureItemId),
    preparedBy: rdc.preparedBy ?? "",
    notes: rdc.notes ?? "",
  };
}

const idOrNull = (v: string) => (v === "" ? null : Number(v));

export function rdcToBody(v: RdcFormValues): ReturnableDcBody {
  const notes = blankNull(v.notes);
  return {
    customerId: v.customerId ?? 0,
    issueDate: v.issueDate,
    purpose: v.purpose.trim(),
    expectedReturnDate: v.expectedReturnDate,
    takenBy: blankNull(v.takenBy),
    lines: v.lines.map((l) => ({
      description: l.description.trim(),
      quantity: Number(l.quantity),
    })),
    sealItemId: idOrNull(v.sealItemId),
    signatureItemId: idOrNull(v.signatureItemId),
    ...(v.sealItemId === "" ? { sealName: null } : {}),
    ...(v.signatureItemId === "" ? { signatureName: null } : {}),
    preparedBy: blankNull(v.preparedBy),
    // Left out when blank: the server prints the standard returnable terms.
    ...(notes === null ? {} : { notes }),
  };
}
