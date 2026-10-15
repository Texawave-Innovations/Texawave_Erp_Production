import { useCallback, useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Handshake,
  CalendarClock,
  Database,
  Phone,
  Users,
  Clock,
  PhoneCall,
  ThumbsUp,
  UserX,
  MessageCircle,
  MessageSquare,
  Linkedin,
  Mail,
  LayoutDashboard,
  Building2,
  Briefcase,
  Package,
  Contact,
  Receipt,
  Target,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Search as SearchIcon,
  Calendar as CalendarIcon,
  FileUp,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { isCrmAdmin } from "./domain/roles";
import { CrmNotificationBell } from "./notifications/CrmNotificationBell";
import { CrmActionPanel } from "./notifications/CrmActionPanel";
import { useCrmNotificationGenerator } from "./notifications/useCrmNotificationGenerator";
import { useNotificationAuditObserver } from "./intelligence/useNotificationAuditObserver";
import { useCrmDomainNotificationGenerator } from "./domain/useCrmDomainNotificationGenerator";
import { CrmCelebrationHost, CrmWelcomeCelebration } from "./celebration";
import {
  CrmDashboardPanelProvider,
  useCrmDashboardPanel,
} from "./intelligence/dashboardPanelContext";
import { CrmDomainDataProvider } from "./domain/useCrmDomainData";
import { CrmNotificationFeedProvider } from "./notifications/notificationFeedContext";
import { CrmBulkImport } from "./bulkImport/CrmBulkImport";

// CRM tab display order (navigation order only — labels, routes, and icons are unchanged):
// Dashboard, Overall Data, Accounts Mining Sheet, Leads, Yet to Happen, Call Back-Send Info,
// Keep in Touch, Not Interested, WhatsApp, LinkedIn.
// Search, Calendar, and Analytics are intentionally not in the top nav — they open inline from
// within the Dashboard tab instead (see CrmDashboard.tsx). Their standalone routes still exist
// for direct navigation but are no longer linked here.

// Semantic accent per tab — purely visual (active/hover background + icon tint). Every value
// below is a complete literal Tailwind class string (required for the JIT scanner).
type TabTone = { active: string; hover: string };
const TAB_TONE: Record<string, TabTone> = {
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

const dashboardTab = {
  id: "dashboard",
  tone: "brand",
  label: (
    <span className="flex items-center gap-1.5">
      <LayoutDashboard size={16} />
      Dashboard
    </span>
  ),
  path: "/crm/dashboard",
};

const mainTabs = [
  {
    id: "overall-data",
    tone: "sky",
    label: (
      <span className="flex items-center gap-1.5">
        <CalendarClock size={16} />
        Overall Data
      </span>
    ),
    path: "/crm/overall-data",
  },
  {
    id: "accounts-mining-sheet",
    tone: "violet",
    label: (
      <span className="flex items-center gap-1.5">
        <Database size={16} />
        Accounts Mining Sheet
      </span>
    ),
    path: "/crm/accounts-mining-sheet",
  },
  {
    id: "cold-calling-status",
    tone: "orange",
    label: (
      <span className="flex items-center gap-1.5">
        <Phone size={16} />
        Cold Calling Status
      </span>
    ),
    path: "/crm/cold-calling-status",
  },
  {
    id: "leads",
    tone: "blue",
    label: (
      <span className="flex items-center gap-1.5">
        <Users size={16} />
        Leads
      </span>
    ),
    path: "/crm/leads",
  },
  {
    id: "yet-to-happen",
    tone: "amber",
    label: (
      <span className="flex items-center gap-1.5">
        <Clock size={16} />
        Yet to Happen
      </span>
    ),
    path: "/crm/yet-to-happen",
  },
  {
    id: "call-back-send-info",
    tone: "orange",
    label: (
      <span className="flex items-center gap-1.5">
        <PhoneCall size={16} />
        Call Back-Send Info
      </span>
    ),
    path: "/crm/call-back-send-info",
  },
  {
    id: "interested",
    tone: "lime",
    label: (
      <span className="flex items-center gap-1.5">
        <ThumbsUp size={16} />
        Interested
      </span>
    ),
    path: "/crm/interested",
  },
  {
    id: "keep-in-touch",
    tone: "teal",
    label: (
      <span className="flex items-center gap-1.5">
        <MessageCircle size={16} />
        Keep in Touch
      </span>
    ),
    path: "/crm/keep-in-touch",
  },
  {
    id: "not-interested",
    tone: "rose",
    label: (
      <span className="flex items-center gap-1.5">
        <UserX size={16} />
        Not Interested
      </span>
    ),
    path: "/crm/not-interested",
  },
  {
    id: "whatsapp",
    tone: "emerald",
    label: (
      <span className="flex items-center gap-1.5">
        <MessageSquare size={16} />
        WhatsApp
      </span>
    ),
    path: "/crm/whatsapp",
  },
  {
    id: "linkedin",
    tone: "indigo",
    label: (
      <span className="flex items-center gap-1.5">
        <Linkedin size={16} />
        LinkedIn
      </span>
    ),
    path: "/crm/linkedin",
  },
  {
    id: "email",
    tone: "slate",
    label: (
      <span className="flex items-center gap-1.5">
        <Mail size={16} />
        Email
      </span>
    ),
    path: "/crm/email",
  },
  // CRM Core Domain — additive tabs appended after the 9 existing sheet tabs above. Order/labels/
  // routes of everything above are unchanged; these are new, relational-data pages (Accounts,
  // Contacts, Opportunities, Pipeline, Stage History, Activities, Meetings, Follow-ups, Notes,
  // Documents, Quotations, Timeline) rather than a new spreadsheet-style tab.
  {
    id: "accounts",
    tone: "cyan",
    label: (
      <span className="flex items-center gap-1.5">
        <Building2 size={16} />
        Accounts
      </span>
    ),
    path: "/crm/accounts",
  },
  {
    id: "pipeline",
    tone: "purple",
    label: (
      <span className="flex items-center gap-1.5">
        <Briefcase size={16} />
        Pipeline
      </span>
    ),
    path: "/crm/pipeline",
  },
  // CRM Core Domain — Products/Contacts/Quotes, appended after Accounts/Pipeline above using the
  // exact same additive pattern; nothing above is reordered or renamed.
  {
    id: "contacts",
    tone: "pink",
    label: (
      <span className="flex items-center gap-1.5">
        <Contact size={16} />
        Contacts
      </span>
    ),
    path: "/crm/contacts",
  },
  {
    id: "products",
    tone: "orange",
    label: (
      <span className="flex items-center gap-1.5">
        <Package size={16} />
        Products
      </span>
    ),
    path: "/crm/products",
  },
  {
    id: "quotes",
    tone: "violet",
    label: (
      <span className="flex items-center gap-1.5">
        <Receipt size={16} />
        Quotation
      </span>
    ),
    path: "/crm/quotes",
  },
  {
    id: "quotas",
    tone: "brand",
    label: (
      <span className="flex items-center gap-1.5">
        <Target size={16} />
        Target
      </span>
    ),
    path: "/crm/quotas",
  },
];

// Admin-only tab — appended after `quotas` for a CRM Admin, omitted entirely for every other
// role (including the dedicated `crm` login), since it lists every deleted CRM record.
const recycleBinTab = {
  id: "recycle-bin",
  tone: "rose",
  label: (
    <span className="flex items-center gap-1.5">
      <Trash2 size={16} />
      Recycle Bin
    </span>
  ),
  path: "/crm/recycle-bin",
};

// Scroll one "page" of tabs at a time, clamped to a comfortable step size.
const SCROLL_STEP = 260;

export default function CRMLayout() {
  // The Dashboard's Search/Calendar toggle buttons render here in the header (next to the
  // notification bell) but the panel they open lives inside CrmDashboard.tsx — the provider keeps
  // the two in sync across the Outlet boundary. See dashboardPanelContext.tsx.
  return (
    <CrmDomainDataProvider>
      <CrmNotificationFeedProvider>
        <CrmDashboardPanelProvider>
          <CRMLayoutBody />
        </CrmDashboardPanelProvider>
      </CrmNotificationFeedProvider>
    </CrmDomainDataProvider>
  );
}

function CRMLayoutBody() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activePanel, setActivePanel } = useCrmDashboardPanel();
  const isDashboardRoute = location.pathname === dashboardTab.path;

  // `activePanel` lives in a context wrapping the whole layout body, so it otherwise survives tab
  // navigation untouched — opening Search on the Dashboard, navigating to another tab, then back
  // to the Dashboard showed the Search panel again instead of the normal dashboard sections. Close
  // it whenever the route leaves the Dashboard tab (not on every render — `openDashboardPanel`
  // below still needs to open it while `navigate()` is mid-flight to the Dashboard route).
  useEffect(() => {
    if (!isDashboardRoute) setActivePanel(null);
  }, [isDashboardRoute]);

  // Search/Calendar open an inline panel that only actually renders inside CrmDashboard.tsx, so
  // from any other tab this jumps to the Dashboard first (where the toggle then takes effect),
  // instead of only working while already on the Dashboard tab.
  const openDashboardPanel = (panel: "search" | "calendar") => {
    if (!isDashboardRoute) {
      navigate(dashboardTab.path);
      setActivePanel(panel);
    } else {
      setActivePanel((p) => (p === panel ? null : panel));
    }
  };
  const visibleTabs = isCrmAdmin(user)
    ? [dashboardTab, ...mainTabs, recycleBinTab]
    : [dashboardTab, ...mainTabs];
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
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
    const resizeObserver = new ResizeObserver(updateScrollState);
    resizeObserver.observe(el);
    window.addEventListener("resize", updateScrollState);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateScrollState);
    };
  }, [updateScrollState]);

  // Keep the active tab in view whenever the CRM route changes.
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const active = el.querySelector<HTMLElement>('a[aria-current="page"]');
    active?.scrollIntoView({
      behavior: "smooth",
      inline: "nearest",
      block: "nearest",
    });
  }, [location.pathname]);

  const scrollByStep = (direction: 1 | -1) => {
    navRef.current?.scrollBy({
      left: direction * SCROLL_STEP,
      behavior: "smooth",
    });
  };

  // CRM-only notification generation — reads the CRM source tabs and keeps
  // `crm/notifications/feed` in sync. Fully isolated from the global notification system.
  useCrmNotificationGenerator();
  // CRM Core Domain — same idea, extended to the new Accounts/Opportunities/Meetings/Follow-ups/
  // Quotations collections. Writes into the same `crm/notifications/feed`, so the bell below
  // needs no changes to show either kind.
  useCrmDomainNotificationGenerator();
  // New Intelligence Layer (Feature 8) — read-only observer of the existing notification feed,
  // logs Acknowledge/Done/Snooze actions to the new, isolated `crm/auditLogs` path.
  useNotificationAuditObserver();

  // CRM-only Inter font scope. `.crm-module` (below) covers everything rendered in the normal DOM
  // tree; Radix dialogs/dropdowns/popovers/selects/tooltips/toasts render via a portal to <body>,
  // outside that subtree, so a `body` class — set only while this layout is mounted, i.e. only
  // while a CRM route is active — is used to reach them too (see index.css). This never touches
  // the Sidebar/Topbar: neither renders any Radix dialog/dropdown/popover/select/tooltip, so no
  // non-CRM overlay can ever match the body-scoped selectors.
  useEffect(() => {
    document.body.classList.add("crm-route-active");
    return () => document.body.classList.remove("crm-route-active");
  }, []);

  return (
    <Layout>
      <div className="crm-module">
        {/* CRM-only success celebration system — one host renders every celebrateCrm(...) call from
            anywhere in the CRM module; the welcome banner fires once per browser session on entry. */}
        <CrmCelebrationHost />
        <CrmWelcomeCelebration />
        {/* Prominent top action panel for overdue/due-today CRM notifications — closing it never
            resolves the notification, it stays Action Required until Acknowledge/Done/Snooze. */}
        <CrmActionPanel />
        <div className="space-y-6 pb-10">
          {/* Header Title — soft premium gradient treatment over the existing brand green */}
          <div className="relative overflow-hidden rounded-3xl border border-brand-200/50 bg-gradient-to-br from-white via-brand-100/70 to-blue-100/50 px-5 py-4 flex items-center justify-between gap-3">
            <span
              aria-hidden
              className="pointer-events-none absolute -left-16 -top-20 h-48 w-48 rounded-full bg-brand-300/40 blur-3xl"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute right-10 -bottom-20 h-48 w-48 rounded-full bg-blue-300/35 blur-3xl"
            />
            <div className="relative flex items-center gap-3">
              <span className="p-3 bg-gradient-to-br from-brand-400 to-brand-600 text-white rounded-2xl shadow-lg shadow-brand-500/25">
                <Handshake className="h-6 w-6" />
              </span>
              <div>
                <h1 className="text-3xl font-bold text-foreground tracking-tight">
                  CRM
                </h1>
                <p className="text-muted-foreground mt-1">
                  Customer relationship tracking & daily activity reporting
                </p>
              </div>
            </div>
            {/* Search/Calendar toggle — always visible in the CRM header, on every tab, not just
              Dashboard. The panel they open only actually renders inline inside CrmDashboard.tsx
              (see dashboardPanelContext), so opening either from elsewhere jumps to Dashboard
              first via openDashboardPanel. */}
            <div className="relative flex items-center gap-2">
              <Button
                size="sm"
                variant={
                  isDashboardRoute && activePanel === "search"
                    ? "default"
                    : "outline"
                }
                className="rounded-xl gap-1.5"
                onClick={() => openDashboardPanel("search")}
              >
                <SearchIcon className="h-3.5 w-3.5" /> Search
              </Button>
              <Button
                size="sm"
                variant={bulkImportOpen ? "default" : "outline"}
                className="rounded-xl gap-1.5"
                onClick={() => setBulkImportOpen(true)}
              >
                <FileUp className="h-3.5 w-3.5" /> Bulk Import
              </Button>
              <Button
                size="sm"
                variant={
                  isDashboardRoute && activePanel === "calendar"
                    ? "default"
                    : "outline"
                }
                className="rounded-xl gap-1.5"
                onClick={() => openDashboardPanel("calendar")}
              >
                <CalendarIcon className="h-3.5 w-3.5" /> Calendar
              </Button>
              {/* CRM-only notification bell — never appears outside the CRM module */}
              <CrmNotificationBell />
            </div>
          </div>

          <CrmBulkImport
            open={bulkImportOpen}
            onOpenChange={setBulkImportOpen}
          />

          {/* Primary Tabs - matches Finance/Sales pill-shaped nav, tinted per-tab for quick scanning */}
          <div className="border-b border-slate-200 pb-2.5">
            <div className="relative flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => scrollByStep(-1)}
                disabled={!canScrollLeft}
                aria-label="Scroll tabs left"
                title="Scroll tabs left"
                className={cn(
                  "shrink-0 z-10 flex items-center justify-center h-9 w-9 rounded-xl border border-brand-500 bg-gradient-to-br from-brand-400 to-brand-500 text-white shadow-sm transition-all duration-200",
                  canScrollLeft
                    ? "hover:from-brand-500 hover:to-brand-600 hover:shadow active:scale-95 cursor-pointer"
                    : "opacity-40 cursor-not-allowed",
                )}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div className="relative flex-1 min-w-0">
                <nav
                  ref={navRef}
                  className="crm-tabs-scroll flex gap-2 overflow-x-auto p-1 -m-1 scroll-smooth"
                >
                  {visibleTabs.map((tab) => {
                    const t = TAB_TONE[tab.tone] ?? TAB_TONE.brand;
                    return (
                      <NavLink
                        key={tab.id}
                        to={tab.path}
                        className={({ isActive }) =>
                          cn(
                            "px-3.5 py-2 text-sm font-medium whitespace-nowrap transition-all duration-200 ease-out transform active:scale-95 flex items-center gap-1.5 rounded-xl border",
                            isActive
                              ? cn(t.active, "font-bold shadow-sm scale-[1.02]")
                              : cn(
                                  "text-slate-600 border-transparent hover:scale-[1.02] hover:shadow-xs",
                                  t.hover,
                                ),
                          )
                        }
                      >
                        {tab.label}
                      </NavLink>
                    );
                  })}
                </nav>

                {/* Overflow fade indicators — very light, never obstruct tab text */}
                <div
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-background to-transparent transition-opacity duration-200",
                    canScrollLeft ? "opacity-100" : "opacity-0",
                  )}
                />
                <div
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent transition-opacity duration-200",
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
                  "shrink-0 z-10 flex items-center justify-center h-9 w-9 rounded-xl border border-brand-600 bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-sm transition-all duration-200",
                  canScrollRight
                    ? "hover:from-brand-600 hover:to-brand-700 hover:shadow active:scale-95 cursor-pointer"
                    : "opacity-40 cursor-not-allowed",
                )}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Tab Content Area */}
          <Outlet />
        </div>
      </div>
    </Layout>
  );
}
