"use client";

import type { Account } from "@texawave-erp/api-types";
import {
  AlertTriangle,
  Briefcase,
  Building2,
  CheckCircle2,
  Clock3,
  FileText,
  Globe,
  History,
  IndianRupee,
  Mail,
  MapPin,
  MessageCircle,
  Package,
  Phone,
  Receipt,
  ShieldAlert,
  Swords,
  Tag,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/legacy-ui/badge";
import { cn } from "@/components/legacy-ui/utils";
import { StatTile } from "@/features/crm/dashboard/components/intelligence-ui";
import type { AccountRelated } from "../../useAccountRelated";
import {
  accountContactHrefs,
  formatRupees,
  InfoField,
  LinkedinIcon,
} from "../accountUi";

const DAY_MS = 86_400_000;

function joinAddress(parts: (string | null)[]): string | undefined {
  return parts.filter(Boolean).join(", ") || undefined;
}

/** Overview tab — KPI tiles, Company Information card, Account Review, Competitive Landscape. */
export function OverviewTab({
  account,
  related,
}: {
  account: Account;
  related: AccountRelated;
}) {
  const hrefs = accountContactHrefs(account);
  // Stable "now" for the review's days-since math (render stays pure).
  const [now] = useState(() => Date.now());
  const {
    contacts,
    opportunities,
    followUps,
    tasks,
    activities,
    quotations,
    meetings,
    notes,
    products,
  } = related;

  const kpis = useMemo(() => {
    const open = opportunities.filter((o) => o.status === "OPEN");
    const won = opportunities.filter((o) => o.status === "WON");
    const lost = opportunities.filter((o) => o.status === "LOST");
    return {
      contacts: contacts.length,
      openDeals: open.length,
      wonDeals: won.length,
      lostDeals: lost.length,
      pipelineValue: open.reduce(
        (s, o) => s + Number(o.estimatedValue || 0),
        0,
      ),
      totalRevenue: won.reduce(
        (s, o) => s + Number(o.closingAmount ?? o.estimatedValue ?? 0),
        0,
      ),
      quotes: quotations.length,
      openActivities:
        followUps.filter(
          (f) =>
            f.effectiveStatus === "PENDING" || f.effectiveStatus === "OVERDUE",
        ).length + tasks.filter((t) => t.status !== "Completed").length,
      completedActivities:
        activities.length +
        tasks.filter((t) => t.status === "Completed").length,
    };
  }, [contacts, opportunities, followUps, tasks, activities, quotations]);

  const review = useMemo(() => {
    const touchpoints = [
      ...activities.map((a) => new Date(a.occurredAt).getTime()),
      ...meetings
        .filter((m) => m.status === "COMPLETED")
        .map((m) => new Date(m.completedAt ?? m.updatedAt).getTime()),
      ...followUps
        .filter((f) => f.status === "COMPLETED")
        .map((f) => new Date(f.updatedAt).getTime()),
      ...notes.map((n) => new Date(n.createdAt).getTime()),
    ];
    const lastInteractionAt = touchpoints.length
      ? Math.max(...touchpoints)
      : undefined;
    const nextFollowUp = followUps
      .filter((f) => f.effectiveStatus === "PENDING")
      .sort(
        (a, b) =>
          new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
      )[0];
    const openOpportunities = opportunities.filter((o) => o.status === "OPEN");
    const overdueFollowUps = followUps.filter(
      (f) => f.effectiveStatus === "OVERDUE",
    ).length;
    const daysSince =
      lastInteractionAt !== undefined
        ? (now - lastInteractionAt) / DAY_MS
        : undefined;

    let status: "Active" | "New" | "Dormant" = "New";
    if (opportunities.length > 0 || activities.length > 0) status = "Active";
    if (
      daysSince !== undefined &&
      daysSince > 30 &&
      openOpportunities.length === 0
    )
      status = "Dormant";

    return {
      lastInteractionAt,
      nextFollowUp,
      openOpportunitiesCount: openOpportunities.length,
      overdueFollowUps,
      status,
      needsAttention:
        overdueFollowUps > 0 || (daysSince !== undefined && daysSince > 30),
      daysSince,
    };
  }, [activities, meetings, followUps, notes, opportunities, now]);

  const competitors = opportunities.filter((o) => o.competitor?.trim());

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        <StatTile
          icon={Users}
          label="Contacts"
          value={kpis.contacts}
          tone="blue"
        />
        <StatTile
          icon={Briefcase}
          label="Open Deals"
          value={kpis.openDeals}
          tone="brand"
        />
        <StatTile
          icon={CheckCircle2}
          label="Won Deals"
          value={kpis.wonDeals}
          tone="emerald"
        />
        <StatTile
          icon={XCircle}
          label="Lost Deals"
          value={kpis.lostDeals}
          tone="red"
        />
        <StatTile
          icon={Receipt}
          label="Quotes"
          value={kpis.quotes}
          tone="purple"
        />
        <StatTile
          icon={IndianRupee}
          label="Pipeline Value"
          value={formatRupees(kpis.pipelineValue)}
          tone="amber"
        />
        <StatTile
          icon={TrendingUp}
          label="Total Revenue (Won)"
          value={formatRupees(kpis.totalRevenue)}
          tone="gold"
        />
        <StatTile
          icon={Package}
          label="Products on Deals"
          value={products.length}
          tone="teal"
        />
        <StatTile
          icon={Clock3}
          label="Open Activities"
          value={kpis.openActivities}
          tone="orange"
        />
        <StatTile
          icon={History}
          label="Completed Activities"
          value={kpis.completedActivities}
          tone="slate"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 rounded-3xl border border-slate-200/80 bg-white shadow-xl overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-brand-600" /> Company
              Information
            </h3>
          </div>
          <div className="p-5 grid sm:grid-cols-2 gap-x-3 gap-y-3">
            <InfoField
              icon={Building2}
              label="Account Name"
              value={account.name}
              tone="brand"
            />
            <InfoField
              icon={Users}
              label="Account Owner"
              value={account.ownerName}
            />
            <InfoField
              icon={MapPin}
              label="Location"
              value={account.hq}
              tone="rose"
              showEmpty
            />
            <InfoField
              icon={Briefcase}
              label="Industry"
              value={account.industry}
              tone="indigo"
              showEmpty
            />
            <InfoField
              icon={Tag}
              label="Customer Type"
              value={account.customerCategory || account.accountType}
              tone="fuchsia"
              showEmpty
            />
            <InfoField
              icon={Globe}
              label="Website"
              value={account.website}
              href={hrefs.website}
              tone="amber"
              showEmpty
            />
            <InfoField
              icon={Phone}
              label="Phone"
              value={account.phone}
              href={hrefs.phone}
              tone="sky"
              showEmpty
            />
            <InfoField
              icon={Mail}
              label="Email"
              value={account.email}
              href={hrefs.email}
              tone="purple"
              showEmpty
            />
            <InfoField
              icon={MessageCircle}
              label="WhatsApp"
              value={account.phone}
              href={hrefs.whatsapp}
              tone="emerald"
              showEmpty
            />
            <InfoField
              icon={LinkedinIcon}
              label="LinkedIn"
              value={account.linkedin ? "View Profile" : undefined}
              href={hrefs.linkedin}
              tone="blue"
              showEmpty
            />
            <InfoField
              icon={Users}
              label="Company Size"
              value={
                account.numberOfEmployees
                  ? `${account.numberOfEmployees} employees`
                  : undefined
              }
            />
            <InfoField
              icon={IndianRupee}
              label="Annual Revenue"
              value={
                account.annualRevenue
                  ? formatRupees(account.annualRevenue)
                  : undefined
              }
              tone="amber"
            />
            <InfoField
              icon={FileText}
              label="Registration / Reference"
              value={account.registrationNumber}
            />
            <InfoField
              icon={MapPin}
              label="Billing Address"
              value={joinAddress([
                account.billingStreet,
                account.billingCity,
                account.billingState,
                account.billingPostalCode,
                account.billingCountry,
              ])}
              tone="rose"
            />
            <InfoField
              icon={MapPin}
              label="Shipping Address"
              value={joinAddress([
                account.shippingStreet,
                account.shippingCity,
                account.shippingState,
                account.shippingPostalCode,
                account.shippingCountry,
              ])}
              tone="rose"
            />
            <InfoField
              icon={Tag}
              label="Customer Class"
              value={
                account.customerClass
                  ? `Class ${account.customerClass}`
                  : undefined
              }
              tone="fuchsia"
            />
            <InfoField
              icon={Briefcase}
              label="Business Type"
              value={account.businessType}
              tone="indigo"
            />
            <InfoField
              icon={Users}
              label="Reseller / Customer Type"
              value={account.resellerType}
            />
            {account.description && (
              <div className="sm:col-span-2">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-900 mb-1">
                  Description
                </p>
                <p className="text-sm text-slate-700">{account.description}</p>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-brand-600" /> Account Review
            </h3>
          </div>
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-900">Customer Status</span>
              <Badge
                className={cn(
                  "text-xs border",
                  review.status === "Active"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : review.status === "Dormant"
                      ? "bg-red-50 text-red-700 border-red-200"
                      : "bg-slate-100 text-slate-900 border-slate-200",
                )}
              >
                {review.status}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-900">Open Opportunities</span>
              <span className="text-sm font-semibold text-slate-800">
                {review.openOpportunitiesCount}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-900">Last Interaction</span>
              <span className="text-sm font-semibold text-slate-800">
                {review.lastInteractionAt
                  ? new Date(review.lastInteractionAt).toLocaleDateString()
                  : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-900">Next Follow-up</span>
              <span className="text-sm font-semibold text-slate-800">
                {review.nextFollowUp
                  ? new Date(
                      review.nextFollowUp.scheduledAt,
                    ).toLocaleDateString()
                  : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-900">Overdue Follow-ups</span>
              <span
                className={cn(
                  "text-sm font-semibold",
                  review.overdueFollowUps > 0
                    ? "text-red-600"
                    : "text-slate-800",
                )}
              >
                {review.overdueFollowUps}
              </span>
            </div>
            {review.needsAttention && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-sm text-amber-800">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <p>
                  {review.overdueFollowUps > 0
                    ? `${review.overdueFollowUps} overdue follow-up${review.overdueFollowUps === 1 ? "" : "s"} need attention.`
                    : `No interaction in ${Math.floor(review.daysSince || 0)} days — consider reaching out.`}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {competitors.length > 0 && (
        <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
            <Swords className="h-4 w-4 text-brand-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Competitive Landscape
            </h3>
          </div>
          <div className="divide-y divide-slate-100">
            {competitors.map((o) => (
              <div
                key={o.id}
                className="p-4 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800">
                    {o.competitor}
                  </p>
                  <p className="text-sm text-slate-900 mt-0.5">
                    Deal: {o.title}
                  </p>
                </div>
                <Badge variant="outline" className="text-xs shrink-0">
                  {o.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
