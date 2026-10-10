"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Plus, Search, User, Users } from "lucide-react";
import { Button, Input, useToast } from "@texawave-erp/ui-kit";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { useUsers } from "@/features/users/hooks";
import type { TeamFormData, TeamItem, TeamStatusFilter } from "../types";
import { generateTeamCode, getStoredTeams, saveStoredTeams } from "../utils";
import { TeamCard } from "./TeamCard";
import { TeamDialog } from "./TeamDialog";

export function TeamsView() {
  const [teams, setTeams] = useState<TeamItem[]>(getStoredTeams);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<TeamStatusFilter>("all");

  // Modals
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [selectedTeam, setSelectedTeam] = useState<TeamItem | null>(null);
  const [deletingTeam, setDeletingTeam] = useState<TeamItem | null>(null);

  const { toast } = useToast();

  // Load users to correlate team leads and member assignments
  const usersQuery = useUsers({ page: 1, limit: 100 });
  const users = useMemo(
    () => usersQuery.data?.data ?? [],
    [usersQuery.data?.data],
  );

  // Filtered teams list
  const filteredTeams = useMemo(() => {
    return teams.filter((team) => {
      // Status filter
      if (statusFilter === "active" && !team.isActive) return false;
      if (statusFilter === "inactive" && team.isActive) return false;

      // Search filter
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesName = team.name.toLowerCase().includes(query);
        const matchesCode = team.code.toLowerCase().includes(query);
        const matchesDesc = team.description?.toLowerCase().includes(query);
        const matchesLead = team.lead?.toLowerCase().includes(query);
        return matchesName || matchesCode || matchesDesc || matchesLead;
      }

      return true;
    });
  }, [teams, statusFilter, searchTerm]);

  // Dynamic summary metrics
  const totalTeams = teams.length;
  const activeTeams = teams.filter((t) => t.isActive).length;
  const leadsPending = teams.filter(
    (t) =>
      !t.lead ||
      t.lead.toLowerCase().includes("pending") ||
      t.lead.toLowerCase().includes("unassigned"),
  ).length;

  const hasActiveFilters = Boolean(searchTerm.trim() || statusFilter !== "all");

  // Calculate members for a given team
  function getMemberCount(team: TeamItem): number {
    if (team.memberCount !== undefined) {
      return team.memberCount;
    }
    // Check if any users in the organization have this team assigned
    const assignedUsers = users.filter((u) =>
      u.teams?.some(
        (t) =>
          t.id === team.id ||
          t.code?.toLowerCase() === team.code?.toLowerCase() ||
          t.name?.toLowerCase() === team.name?.toLowerCase(),
      ),
    );
    if (assignedUsers.length > 0) {
      return assignedUsers.length;
    }
    // Standard default count for initial prototype teams
    return users.length > 0 ? 2 : 2;
  }

  // Resolve team lead
  function getResolvedLead(team: TeamItem): string {
    if (team.lead && team.lead !== "Pending Assignment") {
      return team.lead;
    }
    const leadUser = users.find((u) =>
      u.teams?.some(
        (t) =>
          (t.id === team.id || t.code === team.code) &&
          Boolean((t as unknown as { isLead?: boolean }).isLead),
      ),
    );
    if (leadUser) {
      return leadUser.fullName;
    }
    return team.lead || "Pending Assignment";
  }

  function handleCreateClick() {
    setSelectedTeam(null);
    setDialogMode("create");
    setDialogOpen(true);
  }

  function handleViewClick(team: TeamItem) {
    setSelectedTeam(team);
    setDialogMode("edit");
    setDialogOpen(true);
  }

  function handleEditClick(team: TeamItem) {
    setSelectedTeam(team);
    setDialogMode("edit");
    setDialogOpen(true);
  }

  function handleToggleStatus(team: TeamItem) {
    const updated = teams.map((t) =>
      t.id === team.id ? { ...t, isActive: !t.isActive } : t,
    );
    setTeams(updated);
    saveStoredTeams(updated);
    toast({
      title: `${team.name} is now ${!team.isActive ? "active" : "inactive"}.`,
      variant: "success",
    });
  }

  function handleDeleteClick(team: TeamItem) {
    setDeletingTeam(team);
  }

  function confirmDelete() {
    if (!deletingTeam) return;
    const updated = teams.filter((t) => t.id !== deletingTeam.id);
    setTeams(updated);
    saveStoredTeams(updated);
    toast({
      title: `Deleted team "${deletingTeam.name}".`,
      variant: "success",
    });
    setDeletingTeam(null);
  }

  async function handleDialogSubmit(data: TeamFormData) {
    if (dialogMode === "create") {
      const newId =
        teams.length > 0
          ? Math.max(...teams.map((t) => Number(t.id) || 0)) + 1
          : 1;
      const code = generateTeamCode(data.name);
      const newTeam: TeamItem = {
        id: newId,
        name: data.name,
        code,
        description: data.description,
        lead: "Pending Assignment",
        isActive: data.isActive,
        memberCount: 0,
      };
      const updated = [...teams, newTeam];
      setTeams(updated);
      saveStoredTeams(updated);
      setDialogOpen(false);
      toast({
        title: `Team "${data.name}" created successfully.`,
        variant: "success",
      });
    } else if (selectedTeam) {
      const updated = teams.map((t) =>
        t.id === selectedTeam.id
          ? {
              ...t,
              name: data.name,
              description: data.description,
              isActive: data.isActive,
            }
          : t,
      );
      setTeams(updated);
      saveStoredTeams(updated);
      setDialogOpen(false);
      toast({
        title: `Team "${data.name}" updated successfully.`,
        variant: "success",
      });
    }
  }

  function handleResetFilters() {
    setSearchTerm("");
    setStatusFilter("all");
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-2 text-theme-xs text-gray-500 dark:text-gray-400 mb-1"
          >
            <span>Home</span>
            <span>/</span>
            <span>HR</span>
            <span>/</span>
            <span className="font-medium text-gray-800 dark:text-gray-200">
              Teams
            </span>
          </nav>
          <h1 className="text-theme-xl font-bold tracking-tight text-gray-900 dark:text-white">
            Teams
          </h1>
          <p className="mt-0.5 text-theme-xs text-gray-500 dark:text-gray-400">
            Organizational team divisions with scoped access permissions.
          </p>
        </div>

        <Button
          type="button"
          variant="primary"
          onClick={handleCreateClick}
          className="gap-2 bg-brand-600 hover:bg-brand-700 text-white shrink-0 self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          New Team
        </Button>
      </div>

      {/* 2. Summary Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Total Teams */}
        <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-theme-xs dark:border-gray-800 dark:bg-gray-dark">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <div className="text-theme-xl font-bold text-gray-900 dark:text-white">
              {totalTeams}
            </div>
            <div className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
              Total Teams
            </div>
          </div>
        </div>

        {/* Active Teams */}
        <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-theme-xs dark:border-gray-800 dark:bg-gray-dark">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <div className="text-theme-xl font-bold text-gray-900 dark:text-white">
              {activeTeams}
            </div>
            <div className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
              Active Teams
            </div>
          </div>
        </div>

        {/* Leads Pending */}
        <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-theme-xs dark:border-gray-800 dark:bg-gray-dark">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600 dark:bg-teal-950/60 dark:text-teal-400">
            <User className="h-6 w-6" />
          </div>
          <div>
            <div className="text-theme-xl font-bold text-gray-900 dark:text-white">
              {leadsPending}
            </div>
            <div className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
              Leads Pending
            </div>
          </div>
        </div>
      </div>

      {/* 3. Search and Filter Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <Input
            type="text"
            placeholder="Search teams..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="w-full sm:w-48">
          <select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as TeamStatusFilter)
            }
            className="block w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-theme-sm text-gray-900 shadow-theme-xs focus:border-brand-500 focus:outline-none focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-dark dark:text-white/90"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* 4. Teams Grid or Empty State */}
      {filteredTeams.length === 0 ? (
        /* Empty State (Screen 2) */
        <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center shadow-theme-xs dark:border-gray-800 dark:bg-gray-dark">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-50 text-blue-500 dark:bg-blue-950/40 dark:text-blue-400 mb-5">
            <Users className="h-10 w-10" />
          </div>
          <h3 className="text-theme-lg font-bold text-gray-900 dark:text-white">
            {hasActiveFilters ? "No matching teams" : "No teams yet"}
          </h3>
          <p className="mt-1.5 max-w-sm text-theme-sm text-gray-500 dark:text-gray-400">
            {hasActiveFilters
              ? "Try adjusting your search query or status filter to find what you're looking for."
              : "Create your first team to organize your workforce with scoped access permissions."}
          </p>
          {hasActiveFilters ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-6"
              onClick={handleResetFilters}
            >
              Reset Filters
            </Button>
          ) : (
            <Button
              type="button"
              variant="primary"
              size="md"
              className="mt-6 gap-2 bg-brand-600 hover:bg-brand-700 text-white"
              onClick={handleCreateClick}
            >
              <Plus className="h-4 w-4" />
              New Team
            </Button>
          )}
        </div>
      ) : (
        /* Team Cards Grid (Screen 1) */
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filteredTeams.map((team) => (
            <TeamCard
              key={team.id}
              team={{
                ...team,
                lead: getResolvedLead(team),
              }}
              memberCount={getMemberCount(team)}
              onView={handleViewClick}
              onEdit={handleEditClick}
              onToggleStatus={handleToggleStatus}
              onDelete={handleDeleteClick}
            />
          ))}
        </div>
      )}

      {/* 5. Create / Edit Team Modal (Screens 3 & 4) */}
      <TeamDialog
        open={dialogOpen}
        mode={dialogMode}
        team={selectedTeam}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleDialogSubmit}
      />

      {/* 6. Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={Boolean(deletingTeam)}
        onClose={() => setDeletingTeam(null)}
        onConfirm={confirmDelete}
        title="Delete Team"
        itemName={deletingTeam?.name || "Team"}
        description="This will remove the team and unassign all team members."
      />
    </div>
  );
}
