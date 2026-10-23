"use client";

import { ActionMenu, Button } from "@texawave-erp/ui-kit";
import {
  Briefcase,
  ChevronRight,
  Edit3,
  Eye,
  Laptop,
  Palette,
  Power,
  ShoppingBag,
  Trash2,
  TrendingUp,
  User,
  Users,
  Wrench,
  Zap,
} from "lucide-react";
import type { TeamItem } from "../types";

export interface TeamCardProps {
  team: TeamItem;
  memberCount: number;
  onView: (team: TeamItem) => void;
  onEdit: (team: TeamItem) => void;
  onToggleStatus: (team: TeamItem) => void;
  onDelete: (team: TeamItem) => void;
}

export function getTeamVisual(name: string) {
  const lower = name.toLowerCase();
  if (
    lower.includes("soft") ||
    lower.includes("tech") ||
    lower.includes("dev") ||
    lower.includes("web") ||
    lower.includes("cloud")
  ) {
    return {
      icon: Laptop,
      bgColor: "bg-blue-50 dark:bg-blue-950/40",
      textColor: "-brand-500 dark:text-blue-400",
      borderColor: "border-blue-200/60 dark:border-blue-800/40",
    };
  }
  if (
    lower.includes("mech") ||
    lower.includes("cad") ||
    lower.includes("prototype")
  ) {
    return {
      icon: Wrench,
      bgColor: "bg-orange-50 dark:bg-orange-950/40",
      textColor: "text-orange-600 dark:text-orange-400",
      borderColor: "border-orange-200/60 dark:border-orange-800/40",
    };
  }
  if (
    lower.includes("elect") ||
    lower.includes("circuit") ||
    lower.includes("power") ||
    lower.includes("firmware")
  ) {
    return {
      icon: Zap,
      bgColor: "bg-cyan-50 dark:bg-cyan-950/40",
      textColor: "text-[#0284c7] dark:text-cyan-400",
      borderColor: "border-cyan-200/60 dark:border-cyan-800/40",
    };
  }
  if (
    lower.includes("sale") ||
    lower.includes("market") ||
    lower.includes("growth")
  ) {
    return {
      icon: TrendingUp,
      bgColor: "bg-amber-50 dark:bg-amber-950/40",
      textColor: "text-amber-600 dark:text-amber-400",
      borderColor: "border-amber-200/60 dark:border-amber-800/40",
    };
  }
  if (
    lower.includes("procur") ||
    lower.includes("purchas") ||
    lower.includes("vendor")
  ) {
    return {
      icon: ShoppingBag,
      bgColor: "bg-teal-50 dark:bg-teal-950/40",
      textColor: "text-teal-600 dark:text-teal-400",
      borderColor: "border-teal-200/60 dark:border-teal-800/40",
    };
  }
  if (
    lower.includes("design") ||
    lower.includes("ui") ||
    lower.includes("ux") ||
    lower.includes("creative")
  ) {
    return {
      icon: Palette,
      bgColor: "bg-rose-50 dark:bg-rose-950/40",
      textColor: "text-rose-600 dark:text-rose-400",
      borderColor: "border-rose-200/60 dark:border-rose-800/40",
    };
  }
  if (lower.includes("operation") || lower.includes("biz")) {
    return {
      icon: Briefcase,
      bgColor: "bg-slate-50 dark:bg-slate-800/40",
      textColor: "text-slate-700 dark:text-slate-300",
      borderColor: "border-slate-200/60 dark:border-slate-700",
    };
  }
  return {
    icon: Users,
    bgColor: "bg-sky-50 dark:bg-sky-950/40",
    textColor: "text-[#0a3271] dark:text-sky-300",
    borderColor: "border-sky-200/60 dark:border-sky-800/40",
  };
}

export function TeamCard({
  team,
  memberCount,
  onView,
  onEdit,
  onToggleStatus,
  onDelete,
}: TeamCardProps) {
  const visual = getTeamVisual(team.name);
  const Icon = visual.icon;

  const isPendingLead =
    !team.lead ||
    team.lead.toLowerCase().includes("pending") ||
    team.lead.toLowerCase().includes("unassigned");

  return (
    <div className="group relative flex h-full flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition-all duration-200 hover:border-sky-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-sky-700">
      {/* Top Header Section */}
      <div>
        <div className="flex items-start justify-between gap-3">
          {/* Domain Visual Icon Box */}
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border font-bold shadow-2xs transition-transform duration-150 group-hover:scale-105 ${visual.bgColor} ${visual.textColor} ${visual.borderColor}`}
            aria-hidden="true"
          >
            <Icon className="h-6 w-6" />
          </div>

          {/* Right Badges: Code & Status */}
          <div className="flex flex-col items-end gap-1.5">
            <span className="rounded-md border border-sky-200/80 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-[#0284c7] dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-300">
              #{team.code}
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                team.isActive
                  ? "border border-emerald-200/80 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                  : "border border-slate-200/80 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
              }`}
            >
              {team.isActive ? "Active" : "Inactive"}
            </span>
          </div>
        </div>

        {/* Team Identity */}
        <div className="mt-3.5 min-w-0">
          <h3
            className="truncate text-base font-bold text-slate-900 transition-colors group-hover:text-brand-500 dark:text-white dark:group-hover:text-[#38bdf8]"
            title={team.name}
          >
            {team.name}
          </h3>
          <p className="mt-1 line-clamp-2 min-h-9 text-xs text-slate-500 dark:text-slate-400">
            {team.description || "No description provided."}
          </p>
        </div>
      </div>

      {/* Details & Actions */}
      <div>
        {/* Compact Details Section */}
        <div className="mt-5 space-y-2 border-t border-slate-100 pt-3.5 text-xs dark:border-slate-800">
          {/* Team Lead */}
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-slate-500 dark:text-slate-400">
              Team Lead
            </span>
            {isPendingLead ? (
              <span className="rounded-md border border-amber-200/80 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
                Pending Assignment
              </span>
            ) : (
              <span className="flex items-center gap-1.5 truncate font-semibold text-slate-900 dark:text-white">
                <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span className="truncate">{team.lead}</span>
              </span>
            )}
          </div>

          {/* Assigned Members */}
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-slate-500 dark:text-slate-400">
              Assigned Members
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200/60 bg-sky-50 px-2.5 py-0.5 text-xs font-semibold text-[#0a3271] dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-200">
              <Users className="h-3 w-3 text-[#0284c7]" />
              <span>{memberCount} Members</span>
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-4 flex items-center justify-between gap-2.5 border-t border-slate-100 pt-3 dark:border-slate-800">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="flex-1 justify-center gap-1.5 rounded-xl border border-sky-200/80 bg-sky-50/70 text-xs font-semibold text-brand-500 hover:bg-sky-100 hover:text-[#1357ca] dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-300 dark:hover:bg-sky-900/50 cursor-pointer"
            onClick={() => onView(team)}
          >
            <Eye className="h-3.5 w-3.5" />
            <span>View Team</span>
            <ChevronRight className="h-3.5 w-3.5 opacity-70" />
          </Button>

          <ActionMenu
            triggerIcon="horizontal"
            ariaLabel={`Actions for ${team.name}`}
            items={[
              {
                label: "Edit Team",
                icon: <Edit3 className="h-4 w-4" />,
                onClick: () => onEdit(team),
              },
              {
                label: team.isActive ? "Deactivate Team" : "Activate Team",
                icon: <Power className="h-4 w-4" />,
                onClick: () => onToggleStatus(team),
              },
              {
                label: "Delete Team",
                icon: <Trash2 className="h-4 w-4" />,
                variant: "destructive",
                onClick: () => onDelete(team),
              },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
