"use client";

import { useMemo } from "react";
import { Laptop, Wrench, Zap } from "lucide-react";
import { StatusBadge } from "@texawave-erp/ui-kit";
import { PageHeader } from "@/components/layout/PageHeader";
import { useUsers } from "@/features/users/hooks";

const TEAMS = [
  {
    id: 1,
    name: "Software Team",
    code: "TEAM-SW",
    description: "Web platform, cloud services, and embedded software systems.",
    icon: Laptop,
    lead: "Super Admin",
    status: "active",
  },
  {
    id: 2,
    name: "Mechanical Team",
    code: "TEAM-ME",
    description: "CAD modeling, structural design, and physical prototyping.",
    icon: Wrench,
    lead: "Pending Lead Assignment",
    status: "active",
  },
  {
    id: 3,
    name: "Electrical Team",
    code: "TEAM-EE",
    description:
      "Circuit board schematic design, power distribution, and firmware integration.",
    icon: Zap,
    lead: "Pending Lead Assignment",
    status: "active",
  },
];

export default function HrTeamsPage() {
  const usersQuery = useUsers({ page: 1, limit: 100 });
  const users = useMemo(
    () => usersQuery.data?.data ?? [],
    [usersQuery.data?.data],
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        breadcrumbs={["HR", "People", "Teams"]}
        title="Teams"
        description="Organizational team divisions with scoped access permissions (Docs/ARCHITECTURE.md §5.5)."
      />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {TEAMS.map((team) => (
          <div
            key={team.id}
            className="flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-5 shadow-theme-xs transition-shadow hover:shadow-theme-sm dark:border-gray-800 dark:bg-gray-dark"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-400">
                  <team.icon className="h-5 w-5" />
                </span>
                <StatusBadge label="Active" colorToken="success" />
              </div>

              <h3 className="mt-4 text-theme-base font-bold text-gray-900 dark:text-white">
                {team.name}
              </h3>
              <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
                {team.description}
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-2.5 border-t border-gray-100 pt-4 text-theme-xs dark:border-gray-800">
              <div className="flex items-center justify-between text-gray-600 dark:text-gray-300">
                <span className="font-medium">Team Code</span>
                <span className="font-mono text-gray-900 dark:text-white font-semibold">
                  {team.code}
                </span>
              </div>
              <div className="flex items-center justify-between text-gray-600 dark:text-gray-300">
                <span className="font-medium">Team Lead</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {team.lead}
                </span>
              </div>
              <div className="flex items-center justify-between text-gray-600 dark:text-gray-300">
                <span className="font-medium">Assigned Members</span>
                <span className="font-bold text-brand-600 dark:text-brand-400">
                  {users.length > 0 ? Math.ceil(users.length / 3) : 0} Members
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
