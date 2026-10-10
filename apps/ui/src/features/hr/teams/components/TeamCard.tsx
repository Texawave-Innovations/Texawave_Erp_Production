"use client";

import { Button, StatusBadge } from "@texawave-erp/ui-kit";
import {
  Briefcase,
  CheckCircle,
  Edit3,
  Laptop,
  Palette,
  Power,
  Trash2,
  TrendingUp,
  Users,
  Wrench,
  Zap,
} from "lucide-react";
import { ActionMenu } from "@/components/ActionMenu";
import type { TeamItem } from "../types";

export interface TeamCardProps {
  team: TeamItem;
  memberCount: number;
  onView: (team: TeamItem) => void;
  onEdit: (team: TeamItem) => void;
  onToggleStatus: (team: TeamItem) => void;
  onDelete: (team: TeamItem) => void;
}

function TeamDomainIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const lower = name.toLowerCase();
  if (
    lower.includes("soft") ||
    lower.includes("tech") ||
    lower.includes("dev") ||
    lower.includes("web") ||
    lower.includes("cloud")
  ) {
    return <Laptop className={className} />;
  }
  if (
    lower.includes("mech") ||
    lower.includes("cad") ||
    lower.includes("prototype")
  ) {
    return <Wrench className={className} />;
  }
  if (
    lower.includes("elect") ||
    lower.includes("circuit") ||
    lower.includes("power") ||
    lower.includes("firmware")
  ) {
    return <Zap className={className} />;
  }
  if (
    lower.includes("sale") ||
    lower.includes("market") ||
    lower.includes("growth")
  ) {
    return <TrendingUp className={className} />;
  }
  if (
    lower.includes("design") ||
    lower.includes("ui") ||
    lower.includes("ux") ||
    lower.includes("creative")
  ) {
    return <Palette className={className} />;
  }
  if (
    lower.includes("qa") ||
    lower.includes("test") ||
    lower.includes("quality")
  ) {
    return <CheckCircle className={className} />;
  }
  if (lower.includes("operation") || lower.includes("biz")) {
    return <Briefcase className={className} />;
  }
  return <Users className={className} />;
}

export function TeamCard({
  team,
  memberCount,
  onView,
  onEdit,
  onToggleStatus,
  onDelete,
}: TeamCardProps) {
  const isPendingLead =
    !team.lead ||
    team.lead.toLowerCase().includes("pending") ||
    team.lead.toLowerCase().includes("unassigned");

  return (
    <div className="flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-5 shadow-theme-xs transition-all duration-200 hover:shadow-theme-sm dark:border-gray-800 dark:bg-gray-dark">
      <div>
        {/* Top Header: Domain Icon & Status */}
        <div className="flex items-center justify-between">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
            <TeamDomainIcon name={team.name} className="h-5 w-5" />
          </span>
          <StatusBadge
            label={team.isActive ? "Active" : "Inactive"}
            colorToken={team.isActive ? "success" : "gray"}
          />
        </div>

        {/* Team Identity */}
        <h3 className="mt-4 text-theme-base font-bold text-gray-900 dark:text-white">
          {team.name}
        </h3>
        <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400 line-clamp-2 min-h-9">
          {team.description || "No description provided."}
        </p>
      </div>

      <div>
        {/* Compact Details Section */}
        <div className="mt-5 flex flex-col gap-2.5 border-t border-gray-100 pt-4 text-theme-xs dark:border-gray-800">
          <div className="flex items-center justify-between">
            <span className="font-medium text-gray-500 dark:text-gray-400">
              Team Code
            </span>
            <span className="font-mono font-semibold text-gray-900 dark:text-white">
              {team.code}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="font-medium text-gray-500 dark:text-gray-400">
              Team Lead
            </span>
            <span
              className={
                isPendingLead
                  ? "font-medium text-gray-600 dark:text-gray-400"
                  : "font-semibold text-gray-900 dark:text-white"
              }
            >
              {team.lead || "Pending Assignment"}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="font-medium text-gray-500 dark:text-gray-400">
              Assigned Members
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
              {memberCount} Members
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="flex-1 w-full justify-center"
            onClick={() => onView(team)}
          >
            View Team
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
