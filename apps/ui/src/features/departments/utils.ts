import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  Boxes,
  Briefcase,
  Building2,
  Code,
  Cog,
  Headphones,
  Layers,
  Palette,
  Scale,
  ShoppingBag,
  TrendingUp,
  Truck,
  Users,
  Zap,
} from "lucide-react";

const KNOWN_CODES: Record<string, string> = {
  "human resources": "HR",
  hr: "HR",
  finance: "FIN",
  operations: "OPS",
  software: "SOFT",
  "sales marketing": "SALE",
  sales: "SALE",
  marketing: "MKT",
  "it support": "IT",
  it: "IT",
  "information technology": "IT",
  engineering: "ENG",
  administration: "ADMIN",
  admin: "ADMIN",
  legal: "LEGAL",
  procurement: "PROC",
  logistics: "LOG",
  mechanical: "MECH",
  electrical: "ELEC",
};

export interface DepartmentVisual {
  icon: LucideIcon;
  bgColor: string;
  textColor: string;
  borderColor: string;
}

const FALLBACK_PALETTES: DepartmentVisual[] = [
  {
    icon: Building2,
    bgColor: "bg-blue-50 dark:bg-blue-950/40",
    textColor: "text-blue-600 dark:text-blue-400",
    borderColor: "border-blue-200/60 dark:border-blue-800/40",
  },
  {
    icon: Briefcase,
    bgColor: "bg-purple-50 dark:bg-purple-950/40",
    textColor: "text-purple-600 dark:text-purple-400",
    borderColor: "border-purple-200/60 dark:border-purple-800/40",
  },
  {
    icon: Layers,
    bgColor: "bg-teal-50 dark:bg-teal-950/40",
    textColor: "text-teal-600 dark:text-teal-400",
    borderColor: "border-teal-200/60 dark:border-teal-800/40",
  },
  {
    icon: Boxes,
    bgColor: "bg-cyan-50 dark:bg-cyan-950/40",
    textColor: "text-cyan-600 dark:text-cyan-400",
    borderColor: "border-cyan-200/60 dark:border-cyan-800/40",
  },
];

/**
 * Returns distinct visual styling (icon and color palette) for each department.
 */
export function getDepartmentVisual(name: string): DepartmentVisual {
  const normalized = name.trim().toLowerCase();

  // Logistics / Supply Chain / SCM / Transport / Warehouse / Shipping
  if (
    normalized.includes("logistic") ||
    normalized.includes("supply") ||
    normalized.includes("scm") ||
    normalized.includes("transport") ||
    normalized.includes("warehouse") ||
    normalized.includes("shipping") ||
    normalized.includes("fleet")
  ) {
    return {
      icon: Truck,
      bgColor: "bg-cyan-50 dark:bg-cyan-950/40",
      textColor: "text-cyan-600 dark:text-cyan-400",
      borderColor: "border-cyan-200/60 dark:border-cyan-800/40",
    };
  }

  // Sales / Marketing / Commercial / Growth / Advertising
  if (
    normalized.includes("sale") ||
    normalized.includes("market") ||
    normalized.includes("growth") ||
    normalized.includes("commercial") ||
    normalized.includes("adver") ||
    normalized.includes("revenue")
  ) {
    return {
      icon: TrendingUp,
      bgColor: "bg-purple-50 dark:bg-purple-950/40",
      textColor: "text-purple-600 dark:text-purple-400",
      borderColor: "border-purple-200/60 dark:border-purple-800/40",
    };
  }

  // Electrical / Electronics / Power / Energy / Circuit / Hardware Electrical
  if (
    normalized.includes("electric") ||
    normalized.includes("power") ||
    normalized.includes("energy") ||
    normalized.includes("circuit") ||
    normalized.includes("electronic")
  ) {
    return {
      icon: Zap,
      bgColor: "bg-amber-50 dark:bg-amber-950/40",
      textColor: "text-amber-600 dark:text-amber-400",
      borderColor: "border-amber-200/60 dark:border-amber-800/40",
    };
  }

  // Mechanical / Machinery / Hardware / Factory / Plant / Manufacturing
  if (
    normalized.includes("mechanic") ||
    normalized.includes("machin") ||
    normalized.includes("factory") ||
    normalized.includes("plant") ||
    normalized.includes("manufactur") ||
    normalized.includes("hardware") ||
    normalized.includes("workshop")
  ) {
    return {
      icon: Cog,
      bgColor: "bg-orange-50 dark:bg-orange-950/40",
      textColor: "text-orange-600 dark:text-orange-400",
      borderColor: "border-orange-200/60 dark:border-orange-800/40",
    };
  }

  // Software / Tech / IT / Dev / Engineering / Code / Cloud / QA
  if (
    normalized.includes("software") ||
    normalized.includes("tech") ||
    normalized.includes("dev") ||
    normalized.includes("code") ||
    normalized.includes("it") ||
    normalized.includes("computer") ||
    normalized.includes("cloud") ||
    normalized.includes("data") ||
    normalized.includes("qa") ||
    normalized.includes("engineer")
  ) {
    return {
      icon: Code,
      bgColor: "bg-blue-50 dark:bg-blue-950/40",
      textColor: "text-blue-600 dark:text-blue-400",
      borderColor: "border-blue-200/60 dark:border-blue-800/40",
    };
  }

  // HR / Human Resources / People / Talent / Recruitment
  if (
    normalized.includes("hr") ||
    normalized.includes("human") ||
    normalized.includes("people") ||
    normalized.includes("talent") ||
    normalized.includes("recruit") ||
    normalized.includes("personnel")
  ) {
    return {
      icon: Users,
      bgColor: "bg-pink-50 dark:bg-pink-950/40",
      textColor: "text-pink-600 dark:text-pink-400",
      borderColor: "border-pink-200/60 dark:border-pink-800/40",
    };
  }

  // Finance / Accounts / Billing / Treasury / Audit / Tax
  if (
    normalized.includes("financ") ||
    normalized.includes("account") ||
    normalized.includes("bill") ||
    normalized.includes("audit") ||
    normalized.includes("tax") ||
    normalized.includes("treasur") ||
    normalized.includes("payroll")
  ) {
    return {
      icon: Banknote,
      bgColor: "bg-emerald-50 dark:bg-emerald-950/40",
      textColor: "text-emerald-600 dark:text-emerald-400",
      borderColor: "border-emerald-200/60 dark:border-emerald-800/40",
    };
  }

  // Operations / SCM / Inventory / Facilities
  if (
    normalized.includes("operat") ||
    normalized.includes("inventor") ||
    normalized.includes("facilit")
  ) {
    return {
      icon: Boxes,
      bgColor: "bg-teal-50 dark:bg-teal-950/40",
      textColor: "text-teal-600 dark:text-teal-400",
      borderColor: "border-teal-200/60 dark:border-teal-800/40",
    };
  }

  // Design / Creative / UI / UX
  if (
    normalized.includes("design") ||
    normalized.includes("creat") ||
    normalized.includes("ui") ||
    normalized.includes("ux") ||
    normalized.includes("brand") ||
    normalized.includes("media")
  ) {
    return {
      icon: Palette,
      bgColor: "bg-rose-50 dark:bg-rose-950/40",
      textColor: "text-rose-600 dark:text-rose-400",
      borderColor: "border-rose-200/60 dark:border-rose-800/40",
    };
  }

  // Support / Customer Service / Helpdesk
  if (
    normalized.includes("support") ||
    normalized.includes("service") ||
    normalized.includes("help") ||
    normalized.includes("custom")
  ) {
    return {
      icon: Headphones,
      bgColor: "bg-sky-50 dark:bg-sky-950/40",
      textColor: "text-sky-600 dark:text-sky-400",
      borderColor: "border-sky-200/60 dark:border-sky-800/40",
    };
  }

  // Legal / Compliance / Governance
  if (
    normalized.includes("legal") ||
    normalized.includes("complian") ||
    normalized.includes("law") ||
    normalized.includes("govern")
  ) {
    return {
      icon: Scale,
      bgColor: "bg-indigo-50 dark:bg-indigo-950/40",
      textColor: "text-indigo-600 dark:text-indigo-400",
      borderColor: "border-indigo-200/60 dark:border-indigo-800/40",
    };
  }

  // Procurement / Purchasing / Sourcing
  if (
    normalized.includes("procur") ||
    normalized.includes("purchas") ||
    normalized.includes("vendor") ||
    normalized.includes("sourc")
  ) {
    return {
      icon: ShoppingBag,
      bgColor: "bg-lime-50 dark:bg-lime-950/40",
      textColor: "text-lime-700 dark:text-lime-400",
      borderColor: "border-lime-200/60 dark:border-lime-800/40",
    };
  }

  // Deterministic fallback based on string hash
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash << 5) - hash + normalized.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % FALLBACK_PALETTES.length;
  return FALLBACK_PALETTES[index] ?? FALLBACK_PALETTES[0]!;
}

/**
 * Returns or automatically generates the enterprise department code.
 * Preserves customFields.code if present, or deterministically generates from department name.
 */
export function getDepartmentCode(
  name: string,
  customFields?: Record<string, unknown> | null,
): string {
  if (
    customFields &&
    typeof customFields.code === "string" &&
    customFields.code.trim()
  ) {
    return customFields.code.trim().toUpperCase();
  }
  const clean = name.trim();
  const lower = clean.toLowerCase();
  if (KNOWN_CODES[lower]) {
    return KNOWN_CODES[lower];
  }
  const words = clean.split(/\s+/);
  const firstWord = words[0];
  const secondWord = words[1];
  if (words.length > 1 && firstWord && secondWord) {
    if (firstWord.length <= 3 && secondWord.length <= 3) {
      const c1 = firstWord[0] ?? "";
      const c2 = secondWord[0] ?? "";
      return (c1 + c2).toUpperCase();
    }
    return firstWord.slice(0, 4).toUpperCase();
  }
  if (clean.length <= 4) return clean.toUpperCase();
  return clean.slice(0, 4).toUpperCase();
}

/**
 * Formats a date string into readable `DD MMM YYYY` (e.g. 15 Jan 2024).
 */
export function formatDepartmentDate(
  dateStr: string | null | undefined,
): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}
