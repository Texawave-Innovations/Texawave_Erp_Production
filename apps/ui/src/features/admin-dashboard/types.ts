import type { LucideIcon } from "lucide-react";

// View model for the all-modules admin dashboard. Each module ("category")
// adapts its own existing endpoint(s) into this one shape, so the widgets stay
// generic and switching category only swaps data, never layout.

export type CategoryId =
  "hr" | "scm" | "purchases" | "sales" | "finance" | "crm" | "projects";

export type ValueFormat = "number" | "currency" | "percent";

/** One widget's slice of a category: `data` is null until loaded or when not readable. */
export interface Part<T> {
  data: T | null;
  loading: boolean;
  error: boolean;
  retry: () => void;
}

export interface Kpi {
  id: string;
  label: string;
  /** null = the caller cannot read the source of this figure. */
  value: number | null;
  format: ValueFormat;
  note: string;
  direction?: "up" | "down" | "flat";
  href: string;
}

export interface ChartBar {
  /** Short axis label (≤ 4 characters reads best under a pill). */
  label: string;
  /** Full label for the tooltip and screen readers. */
  full: string;
  value: number;
  /** Drawn striped: future periods or "nothing recorded" rather than a real zero. */
  muted?: boolean;
  href?: string;
}

export interface ChartData {
  bars: ChartBar[];
  format: ValueFormat;
  /** Bar index selected by default (e.g. today, the current month). */
  focusIndex?: number;
}

export type GaugeKind = "solid" | "dark" | "striped";

export interface GaugeSegment {
  label: string;
  value: number;
  kind: GaugeKind;
}

export interface GaugeData {
  /** 0–100, drawn in the middle of the arc. */
  percent: number;
  caption: string;
  segments: GaugeSegment[];
  /** How legend values print; defaults to plain numbers. */
  format?: ValueFormat;
}

export type ItemTone =
  "brand" | "cyan" | "sky" | "success" | "warning" | "error" | "slate";

export interface ListItem {
  id: string;
  title: string;
  meta: string;
  href: string;
  tone: ItemTone;
  badge?: string;
}

/** The "Reminders" card: the single most time-sensitive thing in the module. */
export interface Reminder {
  headline: string;
  lines: string[];
  cta: { label: string; href: string };
  /** Overdue / at-risk reminders get a warning accent. */
  urgent?: boolean;
}

/** A row in the avatar list (the reference's "Team Collaboration" card). */
export interface PersonRow {
  id: string;
  name: string;
  sub: string;
  href: string;
  badge?: string;
  tone: ItemTone;
}

export interface SpotlightAction {
  label: string;
  href: string;
  icon: LucideIcon;
}

/** The dark highlight card (the reference's "Time Tracker"). */
export interface Spotlight {
  /** Headline figure; `null` renders the live IST clock instead. */
  value: string | null;
  caption: string;
  lines: string[];
  actions: SpotlightAction[];
}

export interface CategoryView {
  kpis: Part<Kpi[]>;
  chart: Part<ChartData>;
  gauge: Part<GaugeData>;
  list: Part<ListItem[]>;
  reminder: Part<Reminder>;
  people: Part<PersonRow[]>;
  spotlight: Part<Spotlight>;
}

/** Static copy for a category: titles, links, empty states. */
export interface CategoryMeta {
  id: CategoryId;
  label: string;
  /** Module landing page. */
  href: string;
  chartTitle: string;
  chartCaption: string;
  gaugeTitle: string;
  listTitle: string;
  listHref: string;
  listEmpty: string;
  peopleTitle: string;
  peopleHref: string;
  peopleEmpty: string;
  spotlightTitle: string;
}

/** Analytics half of a module view (hooks.ts). */
export type CoreView = Pick<CategoryView, "kpis" | "chart" | "gauge" | "list">;
/** Reminder, people list and spotlight half of a module view (extras.ts). */
export type ExtrasView = Pick<
  CategoryView,
  "reminder" | "people" | "spotlight"
>;
