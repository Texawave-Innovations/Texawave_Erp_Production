"use client";

// Presentation helpers shared by the Account list / detail / queues. Ports of the small local
// components legacy `AccountDetail.tsx` defined at the bottom of the file (SectionShell,
// InfoField, ContactChannel, inline-form chrome) plus the shared style constants.
import type { LucideIcon } from "lucide-react";
import type { ReactNode, SVGProps } from "react";
import { Button } from "@/components/legacy-ui/button";
import { Label } from "@/components/legacy-ui/label";
import { cn } from "@/components/legacy-ui/utils";

/** Legacy table header gradient. */
export const TABLE_HEAD_STYLE = {
  background: "linear-gradient(90deg, #2454e8 0%, #1769f5 50%, #12cfe3 100%)",
} as const;

export const TH_CLASS =
  "font-black text-sm uppercase tracking-wider text-white py-2.5";

/** Shared styling for every Delete trigger button across Account Details. */
export const CRM_DELETE_BTN_CLASS =
  "h-8 px-2 gap-1 text-xs font-semibold shrink-0 text-red-700 border-red-200 bg-red-50/50 hover:text-red-800 hover:border-red-400 hover:bg-red-100 rounded-lg";

export const VIEW_BTN_CLASS =
  "h-8 px-2 gap-1 text-xs font-semibold text-blue-600 border-blue-200 bg-blue-50/50 hover:text-blue-700 hover:border-blue-400 hover:bg-blue-100 rounded-lg";

export const EDIT_BTN_CLASS =
  "h-8 px-2 gap-1 text-xs font-semibold text-brand-700 border-brand-200 bg-brand-50/50 hover:text-brand-800 hover:border-brand-400 hover:bg-brand-100 rounded-lg";

export const CANCEL_BTN_CLASS =
  "rounded-xl border-red-200 text-red-600 bg-red-50/50 hover:text-red-700 hover:border-red-400 hover:bg-red-100";

export const ROW_ACTION_BTN_CLASS = "h-7 px-2.5 text-xs rounded-lg gap-1";
export const COMPLETE_BTN_CLASS = `${ROW_ACTION_BTN_CLASS} border-emerald-200 text-emerald-700 hover:bg-emerald-50`;
export const CANCEL_ROW_BTN_CLASS = `${ROW_ACTION_BTN_CLASS} border-red-200 text-red-600 hover:bg-red-50`;

export const STATUS_TAG_STYLE: Record<string, string> = {
  Interested: "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Not Interested": "bg-red-50 text-red-700 border-red-200",
  "Keep in Touch": "bg-blue-50 text-blue-700 border-blue-200",
  "Call Back": "bg-amber-50 text-amber-700 border-amber-200",
  "Send Info": "bg-purple-50 text-purple-700 border-purple-200",
};

export const MEETING_STATUS_STYLE: Record<string, string> = {
  REQUESTED: "bg-slate-100 text-slate-900 border-slate-200",
  TENTATIVE: "bg-amber-50 text-amber-700 border-amber-200",
  CONFIRMED: "bg-blue-50 text-blue-700 border-blue-200",
  COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CANCELLED: "bg-red-50 text-red-700 border-red-200",
  RESCHEDULED: "bg-amber-50 text-amber-700 border-amber-200",
  NO_SHOW: "bg-red-50 text-red-700 border-red-200",
};

export const FOLLOWUP_STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-blue-50 text-blue-700 border-blue-200",
  COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  OVERDUE: "bg-red-50 text-red-700 border-red-200",
  CANCELLED: "bg-slate-100 text-slate-900 border-slate-200",
  RESCHEDULED: "bg-amber-50 text-amber-700 border-amber-200",
  MISSED: "bg-red-50 text-red-700 border-red-200",
};

/** Legacy intelligence/components PriorityBadge / TemperatureBadge. */
export function PriorityBadge({ priority }: { priority: string }) {
  const style: Record<string, string> = {
    High: "bg-red-50 text-red-700 border-red-200",
    Medium: "bg-amber-50 text-amber-700 border-amber-200",
    Low: "bg-slate-100 text-slate-600 border-slate-200",
  };
  return (
    <span
      className={cn(
        "text-xs font-bold px-2 py-0.5 rounded-full border whitespace-nowrap",
        style[priority],
      )}
    >
      {priority} Priority
    </span>
  );
}

export function TemperatureBadge({ temperature }: { temperature: string }) {
  const style: Record<string, string> = {
    Hot: "bg-red-50 text-red-700 border-red-200",
    Warm: "bg-amber-50 text-amber-700 border-amber-200",
    Cold: "bg-blue-50 text-blue-700 border-blue-200",
  };
  const emoji: Record<string, string> = { Hot: "🔥", Warm: "🌤️", Cold: "❄️" };
  return (
    <span
      className={cn(
        "text-xs font-bold px-2 py-0.5 rounded-full border whitespace-nowrap",
        style[temperature],
      )}
    >
      {emoji[temperature]} {temperature}
    </span>
  );
}

/** lucide-react v1 dropped brand icons — inline LinkedIn glyph. */
export function LinkedinIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9.75h4v11.5H3V9.75Zm6.5 0h3.83v1.57h.06c.53-1.01 1.84-2.07 3.79-2.07 4.05 0 4.82 2.66 4.82 6.12v5.88h-4v-5.21c0-1.24-.02-2.84-1.73-2.84-1.73 0-2 1.35-2 2.75v5.3h-4V9.75Z" />
    </svg>
  );
}

export function SectionShell({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl overflow-hidden">
      <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

export type FieldTone =
  | "slate"
  | "brand"
  | "rose"
  | "indigo"
  | "fuchsia"
  | "sky"
  | "purple"
  | "emerald"
  | "blue"
  | "amber";

const CARD_BORDER: Record<FieldTone, string> = {
  slate: "border-slate-200",
  brand: "border-brand-200",
  rose: "border-rose-200",
  indigo: "border-indigo-200",
  fuchsia: "border-fuchsia-200",
  sky: "border-sky-200",
  purple: "border-purple-200",
  emerald: "border-emerald-200",
  blue: "border-blue-200",
  amber: "border-amber-200",
};

const EMPTY_BG: Record<FieldTone, string> = {
  slate: "bg-slate-50/60",
  brand: "bg-brand-50/50",
  rose: "bg-rose-50/50",
  indigo: "bg-indigo-50/50",
  fuchsia: "bg-fuchsia-50/50",
  sky: "bg-sky-50/50",
  purple: "bg-purple-50/50",
  emerald: "bg-emerald-50/50",
  blue: "bg-blue-50/50",
  amber: "bg-amber-50/50",
};

const ICON_CHIP: Record<FieldTone, string> = {
  slate:
    "bg-gradient-to-br from-slate-50 to-slate-100 text-slate-400 border-slate-200/70",
  brand:
    "bg-gradient-to-br from-brand-50 to-brand-100 text-brand-600 border-brand-200/60",
  rose: "bg-gradient-to-br from-rose-50 to-rose-100 text-rose-500 border-rose-200/60",
  indigo:
    "bg-gradient-to-br from-indigo-50 to-indigo-100 text-indigo-500 border-indigo-200/60",
  fuchsia:
    "bg-gradient-to-br from-fuchsia-50 to-fuchsia-100 text-fuchsia-500 border-fuchsia-200/60",
  sky: "bg-gradient-to-br from-sky-50 to-sky-100 text-sky-600 border-sky-200/60",
  purple:
    "bg-gradient-to-br from-purple-50 to-purple-100 text-purple-600 border-purple-200/60",
  emerald:
    "bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-600 border-emerald-200/60",
  blue: "bg-gradient-to-br from-blue-50 to-blue-100 text-blue-600 border-blue-200/60",
  amber:
    "bg-gradient-to-br from-amber-50 to-amber-100 text-amber-600 border-amber-200/60",
};

type IconLike = LucideIcon | ((props: SVGProps<SVGSVGElement>) => ReactNode);

/** One labeled value in the Company Information card (legacy `InfoField`). */
export function InfoField({
  icon: Icon,
  label,
  value,
  href,
  tone = "slate",
  showEmpty = false,
}: {
  icon: IconLike;
  label: string;
  value?: string | number | null | undefined;
  href?: string | undefined;
  tone?: FieldTone;
  showEmpty?: boolean;
}) {
  const hasValue = value !== undefined && value !== null && value !== "";
  if (!hasValue && !showEmpty) return null;
  const I = Icon as React.ComponentType<{ className?: string }>;

  const content = (
    <div
      className={cn(
        "flex items-start gap-2.5 min-w-0 h-full rounded-xl border p-2.5 shadow-[0_1px_3px_rgba(15,23,42,0.06)]",
        hasValue
          ? cn(CARD_BORDER[tone], "bg-white")
          : cn(CARD_BORDER[tone], EMPTY_BG[tone]),
      )}
    >
      <span
        className={cn(
          "h-8 w-8 flex items-center justify-center rounded-lg border shrink-0 shadow-[0_1px_2px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.85)]",
          hasValue ? ICON_CHIP[tone] : ICON_CHIP.slate,
        )}
      >
        <I className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-900">
          {label}
        </p>
        <p
          className={cn(
            "text-sm break-words",
            hasValue ? "font-medium text-slate-700" : "text-slate-400",
          )}
        >
          {hasValue ? value : "Not available"}
        </p>
      </div>
    </div>
  );

  if (href && hasValue) {
    const external = href.startsWith("http");
    return (
      <a
        href={href}
        target={external ? "_blank" : undefined}
        rel={external ? "noreferrer" : undefined}
        className="block rounded-xl transition-shadow hover:shadow-md"
      >
        {content}
      </a>
    );
  }
  return content;
}

/** Communication-channel card in the Account 360 header (legacy `ContactChannel`). */
export function ContactChannel({
  icon: Icon,
  label,
  value,
  href,
  tone = "brand",
  empty = "Not added",
  className,
}: {
  icon: IconLike;
  label: string;
  value?: string | null | undefined;
  href?: string | undefined;
  tone?: FieldTone;
  empty?: string;
  className?: string;
}) {
  const hasValue = Boolean(value);
  const I = Icon as React.ComponentType<{ className?: string }>;

  const inner = (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-2xl border p-3 min-w-0 h-full shadow-[0_3px_10px_-3px_rgba(100,116,139,0.3)]",
        hasValue
          ? cn(CARD_BORDER[tone], "bg-white")
          : cn(CARD_BORDER[tone], EMPTY_BG[tone]),
      )}
    >
      <span
        className={cn(
          "h-9 w-9 flex items-center justify-center rounded-xl border shrink-0 shadow-[0_1px_2px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.8)]",
          hasValue ? ICON_CHIP[tone] : ICON_CHIP.slate,
        )}
      >
        <I className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-900">
          {label}
        </p>
        <p
          className={cn(
            "text-sm truncate",
            hasValue ? "font-semibold text-slate-800" : "text-slate-400",
          )}
        >
          {value || empty}
        </p>
      </div>
    </div>
  );

  if (href && hasValue) {
    const external = href.startsWith("http");
    return (
      <a
        href={href}
        target={external ? "_blank" : undefined}
        rel={external ? "noreferrer" : undefined}
        className={cn(
          "block rounded-2xl transition-shadow hover:shadow-md",
          className,
        )}
      >
        {inner}
      </a>
    );
  }
  return <div className={className}>{inner}</div>;
}

/** Labelled field wrapper used by every inline form (legacy `space-y-1.5` + xs bold label). */
export function FormRow({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs font-bold text-slate-600">
        {label}
        {required ? " *" : ""}
      </Label>
      {children}
    </div>
  );
}

/** Legacy inline-form chrome: a title box + a bottom action bar. */
export function InlineFormPanel({
  icon: Icon,
  title,
  subtitle,
  tone = "brand",
  children,
  note = "Fields marked with * are required.",
  onCancel,
  onSubmit,
  submitLabel,
  saving,
  canSubmit = true,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  tone?: "brand" | "emerald";
  children: ReactNode;
  note?: string | null;
  onCancel: () => void;
  onSubmit: () => void;
  submitLabel: string;
  saving: boolean;
  canSubmit?: boolean;
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              "p-2.5 rounded-2xl border",
              tone === "emerald"
                ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                : "bg-brand-50 text-brand-600 border-brand-200",
            )}
          >
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
            <p className="text-sm text-slate-400">{subtitle}</p>
          </div>
        </div>
        {children}
      </div>
      <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-4 flex items-center justify-between flex-wrap gap-3">
        <div className="text-sm text-slate-400">{note}</div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className={CANCEL_BTN_CLASS}
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            className={cn(
              "rounded-xl",
              tone === "emerald" && "bg-emerald-600 hover:bg-emerald-700",
            )}
            disabled={!canSubmit || saving}
            onClick={onSubmit}
          >
            {saving ? "Saving…" : submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** `tel:`/`mailto:`/`wa.me`/normalised-URL hrefs for an account's channels. */
export function accountContactHrefs(account: {
  phone: string | null;
  email: string | null;
  linkedin: string | null;
  website: string | null;
}) {
  const normalizeUrl = (v: string) =>
    v.startsWith("http") ? v : `https://${v}`;
  return {
    phone: account.phone ? `tel:${account.phone}` : undefined,
    email: account.email ? `mailto:${account.email}` : undefined,
    whatsapp: account.phone
      ? `https://wa.me/${account.phone.replace(/[^\d]/g, "")}`
      : undefined,
    linkedin: account.linkedin ? normalizeUrl(account.linkedin) : undefined,
    website: account.website ? normalizeUrl(account.website) : undefined,
  };
}

export function formatRupees(value: string | number | null | undefined) {
  const n = Number(value ?? 0);
  return `₹${(Number.isFinite(n) ? n : 0).toLocaleString("en-IN")}`;
}
