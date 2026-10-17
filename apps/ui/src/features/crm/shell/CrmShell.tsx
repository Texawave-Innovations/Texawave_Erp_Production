"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Briefcase,
  Building2,
  Calendar as CalendarIcon,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Clock,
  Contact,
  Database,
  FileUp,
  Handshake,
  LayoutDashboard,
  Mail,
  MessageCircle,
  MessageSquare,
  Package,
  Phone,
  PhoneCall,
  Receipt,
  Search as SearchIcon,
  Target,
  ThumbsUp,
  Trash2,
  UserX,
  Users,
} from "lucide-react";
import { hasPermission } from "@texawave-erp/core";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { CrmNotificationBell } from "@/features/crm/notifications/components/CrmNotificationBell";
import {
  CrmCelebrationHost,
  CrmWelcomeCelebration,
} from "@/features/crm/celebration";
import { CrmToasters } from "@/features/crm/shell/CrmToasters";

type TabIcon = ComponentType<{ size?: number; className?: string }>;

/** lucide-react v1 dropped brand icons; legacy used Linkedin. */
function LinkedinIcon({
  size = 16,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect width="4" height="12" x="2" y="9" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

type TabTone =
  | "brand"
  | "sky"
  | "violet"
  | "blue"
  | "amber"
  | "orange"
  | "teal"
  | "rose"
  | "emerald"
  | "indigo"
  | "cyan"
  | "purple"
  | "pink"
  | "lime"
  | "slate";

// Every value is a complete literal class string (Tailwind scanner requirement).
const TAB_TONE: Record<TabTone, { active: string; hover: string }> = {
  brand: {
    active:
      "bg-gradient-to-br from-brand-100 to-brand-50 text-brand-700 border-brand-200 [&_svg]:text-brand-600",
    hover:
      "hover:bg-brand-50/70 hover:text-brand-600 hover:border-brand-200/50",
  },
  sky: {
    active:
      "bg-gradient-to-br from-sky-100 to-sky-50 text-sky-700 border-sky-200 [&_svg]:text-sky-600",
    hover: "hover:bg-sky-50/70 hover:text-sky-600 hover:border-sky-200/50",
  },
  violet: {
    active:
      "bg-gradient-to-br from-violet-100 to-violet-50 text-violet-700 border-violet-200 [&_svg]:text-violet-600",
    hover:
      "hover:bg-violet-50/70 hover:text-violet-600 hover:border-violet-200/50",
  },
  blue: {
    active:
      "bg-gradient-to-br from-blue-100 to-blue-50 text-blue-700 border-blue-200 [&_svg]:text-blue-600",
    hover: "hover:bg-blue-50/70 hover:text-blue-600 hover:border-blue-200/50",
  },
  amber: {
    active:
      "bg-gradient-to-br from-amber-100 to-amber-50 text-amber-700 border-amber-200 [&_svg]:text-amber-600",
    hover:
      "hover:bg-amber-50/70 hover:text-amber-600 hover:border-amber-200/50",
  },
  orange: {
    active:
      "bg-gradient-to-br from-orange-100 to-orange-50 text-orange-700 border-orange-200 [&_svg]:text-orange-600",
    hover:
      "hover:bg-orange-50/70 hover:text-orange-600 hover:border-orange-200/50",
  },
  teal: {
    active:
      "bg-gradient-to-br from-teal-100 to-teal-50 text-teal-700 border-teal-200 [&_svg]:text-teal-600",
    hover: "hover:bg-teal-50/70 hover:text-teal-600 hover:border-teal-200/50",
  },
  rose: {
    active:
      "bg-gradient-to-br from-rose-100 to-rose-50 text-rose-700 border-rose-200 [&_svg]:text-rose-600",
    hover: "hover:bg-rose-50/70 hover:text-rose-600 hover:border-rose-200/50",
  },
  emerald: {
    active:
      "bg-gradient-to-br from-emerald-100 to-emerald-50 text-emerald-700 border-emerald-200 [&_svg]:text-emerald-600",
    hover:
      "hover:bg-emerald-50/70 hover:text-emerald-600 hover:border-emerald-200/50",
  },
  indigo: {
    active:
      "bg-gradient-to-br from-indigo-100 to-indigo-50 text-indigo-700 border-indigo-200 [&_svg]:text-indigo-600",
    hover:
      "hover:bg-indigo-50/70 hover:text-indigo-600 hover:border-indigo-200/50",
  },
  cyan: {
    active:
      "bg-gradient-to-br from-cyan-100 to-cyan-50 text-cyan-700 border-cyan-200 [&_svg]:text-cyan-600",
    hover: "hover:bg-cyan-50/70 hover:text-cyan-600 hover:border-cyan-200/50",
  },
  purple: {
    active:
      "bg-gradient-to-br from-purple-100 to-purple-50 text-purple-700 border-purple-200 [&_svg]:text-purple-600",
    hover:
      "hover:bg-purple-50/70 hover:text-purple-600 hover:border-purple-200/50",
  },
  pink: {
    active:
      "bg-gradient-to-br from-pink-100 to-pink-50 text-pink-700 border-pink-200 [&_svg]:text-pink-600",
    hover: "hover:bg-pink-50/70 hover:text-pink-600 hover:border-pink-200/50",
  },
  lime: {
    active:
      "bg-gradient-to-br from-lime-100 to-lime-50 text-lime-700 border-lime-200 [&_svg]:text-lime-600",
    hover: "hover:bg-lime-50/70 hover:text-lime-600 hover:border-lime-200/50",
  },
  slate: {
    active:
      "bg-gradient-to-br from-slate-200 to-slate-100 text-slate-700 border-slate-300 [&_svg]:text-slate-600",
    hover:
      "hover:bg-slate-100/70 hover:text-slate-600 hover:border-slate-200/50",
  },
};

interface CrmTab {
  id: string;
  tone: TabTone;
  label: string;
  icon: TabIcon;
  path: string;
  /** Same permission the menu catalogue gates this entry on. */
  permission: string;
}

// Legacy CRMLayout.tsx tab order: Dashboard first, then the sheet tabs, then
// the CRM-core tabs, Target, and (admin only) Recycle Bin.
const TABS: CrmTab[] = [
  {
    id: "dashboard",
    tone: "brand",
    label: "Dashboard",
    icon: LayoutDashboard,
    path: "/crm/dashboard",
    permission: "crm.dashboard.read",
  },
  {
    id: "overall-data",
    tone: "sky",
    label: "Overall Data",
    icon: CalendarClock,
    path: "/crm/overall-data",
    permission: "crm.overalldata.read",
  },
  {
    id: "accounts-mining-sheet",
    tone: "violet",
    label: "Accounts Mining Sheet",
    icon: Database,
    path: "/crm/accounts-mining-sheet",
    permission: "crm.miningrow.read",
  },
  {
    id: "cold-calling-status",
    tone: "orange",
    label: "Cold Calling Status",
    icon: Phone,
    path: "/crm/cold-calling-status",
    permission: "crm.coldcalling.read",
  },
  {
    id: "leads",
    tone: "blue",
    label: "Leads",
    icon: Users,
    path: "/crm/leads",
    permission: "crm.lead.read",
  },
  {
    id: "yet-to-happen",
    tone: "amber",
    label: "Yet to Happen",
    icon: Clock,
    path: "/crm/yet-to-happen",
    permission: "crm.followup.read",
  },
  {
    id: "callback-send-info",
    tone: "orange",
    label: "Call Back-Send Info",
    icon: PhoneCall,
    path: "/crm/callback-send-info",
    permission: "crm.account.read",
  },
  {
    id: "interested",
    tone: "lime",
    label: "Interested",
    icon: ThumbsUp,
    path: "/crm/interested",
    permission: "crm.account.read",
  },
  {
    id: "keep-in-touch",
    tone: "teal",
    label: "Keep in Touch",
    icon: MessageCircle,
    path: "/crm/keep-in-touch",
    permission: "crm.account.read",
  },
  {
    id: "not-interested",
    tone: "rose",
    label: "Not Interested",
    icon: UserX,
    path: "/crm/not-interested",
    permission: "crm.account.read",
  },
  {
    id: "whatsapp",
    tone: "emerald",
    label: "WhatsApp",
    icon: MessageSquare,
    path: "/crm/whatsapp",
    permission: "crm.activity.read",
  },
  {
    id: "linkedin",
    tone: "indigo",
    label: "LinkedIn",
    icon: LinkedinIcon,
    path: "/crm/linkedin",
    permission: "crm.activity.read",
  },
  {
    id: "email",
    tone: "slate",
    label: "Email",
    icon: Mail,
    path: "/crm/email",
    permission: "crm.activity.read",
  },
  {
    id: "accounts",
    tone: "cyan",
    label: "Accounts",
    icon: Building2,
    path: "/crm/accounts",
    permission: "crm.account.read",
  },
  {
    id: "pipeline",
    tone: "purple",
    label: "Pipeline",
    icon: Briefcase,
    path: "/crm/pipeline",
    permission: "crm.opportunity.read",
  },
  {
    id: "contacts",
    tone: "pink",
    label: "Contacts",
    icon: Contact,
    path: "/crm/contacts",
    permission: "crm.contact.read",
  },
  {
    id: "products",
    tone: "orange",
    label: "Products",
    icon: Package,
    path: "/crm/products",
    permission: "crm.product.read",
  },
  {
    id: "quotes",
    tone: "violet",
    label: "Quotation",
    icon: Receipt,
    path: "/crm/quotes",
    permission: "crm.quotation.read",
  },
  {
    id: "quotas",
    tone: "brand",
    label: "Target",
    icon: Target,
    path: "/crm/quotas",
    permission: "crm.quota.read",
  },
  {
    id: "recycle-bin",
    tone: "rose",
    label: "Recycle Bin",
    icon: Trash2,
    path: "/crm/recycle-bin",
    permission: "crm.recyclebin.read",
  },
];

const SCROLL_STEP = 260;

// crm.lead/opportunity/contact permissions are scoped (.own/.team/.all) in the
// catalogue, so a plain-code check never matches users who hold them.
const SCOPED_CODES = new Set([
  "crm.lead.read",
  "crm.opportunity.read",
  "crm.contact.read",
]);
function tabPermissionCodes(code: string): string[] {
  return SCOPED_CODES.has(code)
    ? [code, `${code}.own`, `${code}.team`, `${code}.all`]
    : [code];
}

function HeaderAction({
  href,
  active,
  icon: Icon,
  children,
}: {
  href: string;
  active: boolean;
  icon: TabIcon;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-brand-500 bg-brand-500 text-white"
          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
      )}
    >
      <Icon className="h-3.5 w-3.5" /> {children}
    </Link>
  );
}

/** Legacy CRMLayout.tsx chrome: gradient title card, header actions, tinted tab bar. */
export function CrmShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const permissions = useAuthStore((s) => s.permissions);
  const visibleTabs = TABS.filter((t) =>
    hasPermission(permissions, tabPermissionCodes(t.permission)),
  );
  const canBell = hasPermission(permissions, "crm.notification.read");
  const canSearch = hasPermission(permissions, "crm.search.read");
  const canCalendar = hasPermission(permissions, "crm.calendar.read");
  const canImport = hasPermission(permissions, "crm.import.write");

  const navRef = useRef<HTMLElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = navRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener("scroll", updateScrollState, { passive: true });
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    window.addEventListener("resize", updateScrollState);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      ro.disconnect();
      window.removeEventListener("resize", updateScrollState);
    };
  }, [updateScrollState, visibleTabs.length]);

  useEffect(() => {
    navRef.current
      ?.querySelector<HTMLElement>('a[aria-current="page"]')
      ?.scrollIntoView({
        behavior: "smooth",
        inline: "nearest",
        block: "nearest",
      });
  }, [pathname]);

  // Scope portaled overlays (dialogs/popovers) to the legacy look too.
  useEffect(() => {
    document.body.classList.add("crm-route-active");
    return () => document.body.classList.remove("crm-route-active");
  }, []);

  const scrollByStep = (dir: 1 | -1) =>
    navRef.current?.scrollBy({ left: dir * SCROLL_STEP, behavior: "smooth" });
  const isActive = (path: string) =>
    pathname === path || pathname.startsWith(`${path}/`);

  return (
    <div className="space-y-6 pb-10">
      {/* CRM-only success celebration system + toast outlets (legacy CRMLayout / App.tsx). */}
      <CrmCelebrationHost />
      <CrmWelcomeCelebration />
      <CrmToasters />
      <div className="relative flex items-center justify-between gap-3 overflow-hidden rounded-3xl border border-brand-200/50 bg-gradient-to-br from-white via-brand-100/70 to-blue-100/50 px-5 py-4">
        <span
          aria-hidden
          className="pointer-events-none absolute -left-16 -top-20 h-48 w-48 rounded-full bg-brand-300/40 blur-3xl"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-20 right-10 h-48 w-48 rounded-full bg-blue-300/35 blur-3xl"
        />
        <div className="relative flex items-center gap-3">
          <span className="rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 p-3 text-white shadow-lg shadow-brand-500/25">
            <Handshake className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              CRM
            </h1>
            <p className="mt-1 text-slate-500">
              Customer relationship tracking &amp; daily activity reporting
            </p>
          </div>
        </div>
        <div className="relative flex items-center gap-2">
          {canSearch && (
            <HeaderAction
              href={isActive("/crm/search") ? "/crm/dashboard" : "/crm/search"}
              active={isActive("/crm/search")}
              icon={SearchIcon}
            >
              Search
            </HeaderAction>
          )}
          {canImport && (
            <HeaderAction
              href="/crm/bulk-import"
              active={isActive("/crm/bulk-import")}
              icon={FileUp}
            >
              Bulk Import
            </HeaderAction>
          )}
          {canCalendar && (
            <HeaderAction
              href={
                isActive("/crm/calendar") ? "/crm/dashboard" : "/crm/calendar"
              }
              active={isActive("/crm/calendar")}
              icon={CalendarIcon}
            >
              Calendar
            </HeaderAction>
          )}
          {canBell && <CrmNotificationBell />}
        </div>
      </div>

      <div className="border-b border-slate-200 pb-2.5">
        <div className="relative flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => scrollByStep(-1)}
            disabled={!canScrollLeft}
            aria-label="Scroll tabs left"
            title="Scroll tabs left"
            className={cn(
              "z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-brand-500 bg-gradient-to-br from-brand-400 to-brand-500 text-white shadow-sm transition-all duration-200",
              canScrollLeft
                ? "cursor-pointer hover:from-brand-500 hover:to-brand-600 hover:shadow active:scale-95"
                : "cursor-not-allowed opacity-40",
            )}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="relative min-w-0 flex-1">
            <nav
              ref={navRef}
              className="crm-tabs-scroll -m-1 flex scroll-smooth gap-2 overflow-x-auto p-1"
            >
              {visibleTabs.map((tab) => {
                const t = TAB_TONE[tab.tone];
                const active = isActive(tab.path);
                const Icon = tab.icon;
                return (
                  <Link
                    key={tab.id}
                    href={tab.path}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex transform items-center gap-1.5 whitespace-nowrap rounded-xl border px-3.5 py-2 text-sm font-medium transition-all duration-200 ease-out active:scale-95",
                      active
                        ? cn(t.active, "scale-[1.02] font-bold shadow-sm")
                        : cn(
                            "border-transparent text-slate-600 hover:scale-[1.02]",
                            t.hover,
                          ),
                    )}
                  >
                    <Icon size={16} />
                    {tab.label}
                  </Link>
                );
              })}
            </nav>
            <div
              aria-hidden
              className={cn(
                "pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-white to-transparent transition-opacity duration-200",
                canScrollLeft ? "opacity-100" : "opacity-0",
              )}
            />
            <div
              aria-hidden
              className={cn(
                "pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white to-transparent transition-opacity duration-200",
                canScrollRight ? "opacity-100" : "opacity-0",
              )}
            />
          </div>
          <button
            type="button"
            onClick={() => scrollByStep(1)}
            disabled={!canScrollRight}
            aria-label="Scroll tabs right"
            title="Scroll tabs right"
            className={cn(
              "z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-brand-600 bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-sm transition-all duration-200",
              canScrollRight
                ? "cursor-pointer hover:from-brand-600 hover:to-brand-700 hover:shadow active:scale-95"
                : "cursor-not-allowed opacity-40",
            )}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {children}
    </div>
  );
}
