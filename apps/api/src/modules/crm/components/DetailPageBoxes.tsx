// Full-page ("box/card") rendering of the same PanelSectionDef<T>[] config used by
// RecordFormPanel's Sheet mode — used only by the 4 tabs redesigned to a QuoteForm-style
// full page (Account Mining Sheet, Leads, Accounts, Recycle Bin). Every section renders as its
// own rounded-3xl/border/shadow-xl box (QuoteForm.tsx visual vocabulary) instead of the Sheet's
// nested rounded-2xl/bg-slate-50/40 style. Field-rendering behavior (text/textarea/select,
// required-asterisk styling, onFieldChange/onFieldBlur/onSelectCommit) is intentionally kept
// identical to RecordFormPanel so autosave/validation is unchanged — this is presentation only.
import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { DatePicker } from "./DatePicker";
import type { PanelSectionDef, PanelTone } from "./RecordFormPanel";

/** Any record type these boxes render can optionally carry Bulk-Import-discovered custom fields —
 *  checked structurally via a cast in the custom-field branch below rather than a generic
 *  constraint, so every existing caller (whose T has no `customFields` property) is unaffected. */
interface HasCustomFields {
  customFields?: Record<string, string>;
}

/** Soft pastel icon-chip fill per section tone — same "gently raised" formula used on the
 *  Account 360 contact cards (gradient fill + faint border + inset top highlight), reused here
 *  for `emphasized` pages so section icons read as a premium accent rather than a flat badge. */
const ICON_CHIP_TONE: Record<PanelTone, string> = {
  brand:
    "bg-gradient-to-br from-brand-50 to-brand-100 text-brand-600 border-brand-200/60",
  blue: "bg-gradient-to-br from-blue-50 to-blue-100 text-blue-600 border-blue-200/60",
  purple:
    "bg-gradient-to-br from-purple-50 to-purple-100 text-purple-600 border-purple-200/60",
  amber:
    "bg-gradient-to-br from-amber-50 to-amber-100 text-amber-600 border-amber-200/60",
  teal: "bg-gradient-to-br from-teal-50 to-teal-100 text-teal-600 border-teal-200/60",
  rose: "bg-gradient-to-br from-rose-50 to-rose-100 text-rose-500 border-rose-200/60",
  slate:
    "bg-gradient-to-br from-slate-50 to-slate-100 text-slate-500 border-slate-200/70",
};

interface DetailPageBoxesProps<T> {
  heading: string;
  subheading?: string;
  sections: PanelSectionDef<T>[];
  values: T;
  onFieldChange: (key: keyof T, value: string) => void;
  onFieldBlur: (key: keyof T) => void;
  onSelectCommit?: (key: keyof T, value: string) => void;
  /** Required only when a section includes a `CustomPanelFieldDef` (Bulk-Import-discovered field) —
   *  reads/writes `values.customFields[key]` instead of `values[key]`. */
  onCustomFieldChange?: (key: string, value: string) => void;
  onCustomFieldBlur?: (key: string) => void;
  /** Renders every field as read-only text — used for "View" pages. */
  readOnly?: boolean;
  /** Rendered above the sections, inside the same heading box (e.g. status badge). */
  headerExtra?: ReactNode;
  /** Rendered as the bottom action bar (Cancel/Save buttons, metadata, etc). */
  footer?: ReactNode;
  /** Opts into the bolder/darker typography + tone-colored icon chips used on a couple of
   *  specific "premium" view pages, without changing this shared component's default look for
   *  every other consumer. */
  emphasized?: boolean;
}

export function DetailPageBoxes<T>({
  heading,
  subheading,
  sections,
  values,
  onFieldChange,
  onFieldBlur,
  onSelectCommit,
  onCustomFieldChange,
  onCustomFieldBlur,
  readOnly = false,
  headerExtra,
  footer,
  emphasized = false,
}: DetailPageBoxesProps<T>) {
  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-brand-100/70 to-blue-100/50 shadow-xl p-6 space-y-1">
        <span
          aria-hidden
          className="pointer-events-none absolute -left-10 -top-16 h-40 w-40 rounded-full bg-brand-300/25 blur-3xl"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -right-10 -bottom-16 h-40 w-40 rounded-full bg-blue-300/20 blur-3xl"
        />
        <div className="relative flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2
              className={cn(
                "font-bold text-slate-900",
                emphasized ? "text-xl text-black" : "text-lg",
              )}
            >
              {heading}
            </h2>
            {subheading && (
              <p
                className={cn(
                  "text-sm",
                  emphasized ? "text-slate-600" : "text-slate-400",
                )}
              >
                {subheading}
              </p>
            )}
          </div>
          {headerExtra}
        </div>
      </div>

      {sections.map((section) => (
        <div
          key={section.id}
          className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-6 space-y-4"
        >
          <div className="flex items-center gap-2.5">
            <span
              className={cn(
                "flex items-center justify-center rounded-xl border shrink-0",
                emphasized
                  ? cn(
                      "h-9 w-9 shadow-[0_1px_2px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.85)]",
                      ICON_CHIP_TONE[section.tone ?? "brand"],
                    )
                  : "p-2 bg-brand-50 text-brand-600 border-brand-200",
              )}
            >
              <section.icon className="h-4 w-4" />
            </span>
            <div>
              <h3
                className={cn(
                  "font-bold",
                  emphasized
                    ? "text-base text-black"
                    : "text-sm text-slate-900",
                )}
              >
                {section.title}
              </h3>
              {section.description && (
                <p
                  className={cn(
                    "text-sm",
                    emphasized ? "text-slate-600" : "text-slate-400",
                  )}
                >
                  {section.description}
                </p>
              )}
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            {section.fields.map((field) => {
              // `field.custom` is a `true`/`false` discriminant (see RecordFormPanel.tsx), so each
              // of these two branches narrows `field` to the right member of the union on its own —
              // resolved once here rather than re-narrowed at every property access below.
              const { rawValue, required, placeholder, onChange, onBlurField } =
                field.custom
                  ? {
                      rawValue: (values as HasCustomFields).customFields?.[
                        field.key
                      ],
                      required: false,
                      placeholder: undefined as string | undefined,
                      onChange: (v: string) =>
                        onCustomFieldChange?.(field.key, v),
                      onBlurField: () => onCustomFieldBlur?.(field.key),
                    }
                  : {
                      rawValue: values[field.key],
                      required: !!field.required,
                      placeholder: field.placeholder,
                      onChange: (v: string) => onFieldChange(field.key, v),
                      onBlurField: () => onFieldBlur(field.key),
                    };
              const value = typeof rawValue === "string" ? rawValue : "";
              const spanClass =
                field.type === "textarea" || field.span === 2
                  ? "md:col-span-2"
                  : "";
              const missingRequired = required && !value.trim();

              return (
                <div
                  key={String(field.key)}
                  className={cn("space-y-1.5", spanClass)}
                >
                  <Label
                    className={cn(
                      "font-bold",
                      emphasized
                        ? "text-sm text-black"
                        : "text-xs text-slate-600",
                    )}
                  >
                    {field.label}
                    {required && <span className="text-red-500 ml-0.5">*</span>}
                  </Label>
                  {readOnly ? (
                    <p
                      className={cn(
                        "min-h-9 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm whitespace-pre-wrap break-words",
                        emphasized ? "text-slate-900" : "text-slate-800",
                      )}
                    >
                      {value ? (
                        value.replace(/_/g, " ")
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </p>
                  ) : field.type === "textarea" ? (
                    <Textarea
                      rows={3}
                      value={value}
                      placeholder={placeholder}
                      onChange={(e) => onChange(e.target.value)}
                      onBlur={onBlurField}
                      className={cn(
                        "rounded-xl resize-y",
                        missingRequired &&
                          "border-red-300 focus-visible:ring-red-300",
                      )}
                    />
                  ) : field.type === "date" ? (
                    <DatePicker
                      value={value}
                      onChange={(v) => {
                        onChange(v);
                        onBlurField();
                      }}
                      className={cn("h-9", missingRequired && "border-red-300")}
                    />
                  ) : field.type === "select" ? (
                    <Select
                      value={value}
                      onValueChange={(v) =>
                        !field.custom && onSelectCommit
                          ? onSelectCommit(field.key, v)
                          : (onChange(v), onBlurField())
                      }
                    >
                      <SelectTrigger
                        className={cn(
                          "h-9 rounded-xl",
                          missingRequired && "border-red-300",
                        )}
                      >
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        {field.options?.map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {opt.replace(/_/g, " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      type="text"
                      value={value}
                      placeholder={placeholder}
                      onChange={(e) => onChange(e.target.value)}
                      onBlur={onBlurField}
                      className={cn(
                        "h-9 rounded-xl",
                        missingRequired &&
                          "border-red-300 focus-visible:ring-red-300",
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {footer && (
        <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-4 flex items-center justify-between flex-wrap gap-3">
          {footer}
        </div>
      )}
    </div>
  );
}

export default DetailPageBoxes;
