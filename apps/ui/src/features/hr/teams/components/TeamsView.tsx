"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Edit3,
  LayoutGrid,
  List,
  Plus,
  Power,
  RotateCcw,
  Trash2,
  User,
  Users,
  UsersRound,
} from "lucide-react";
import {
  ActionMenu,
  Button,
  DataTable,
  DeleteConfirmDialog,
  SearchInput,
  Select,
  useToast,
} from "@texawave-erp/ui-kit";
import { HrPageHeader } from "@/features/hr/components";
import { useUsers } from "@/features/users/hooks";
import type { TeamFormData, TeamItem, TeamStatusFilter } from "../types";
import { generateTeamCode, getStoredTeams, saveStoredTeams } from "../utils";
import { TeamCard, getTeamVisual } from "./TeamCard";
import { TeamDialog } from "./TeamDialog";

type SortOption = "name" | "code" | "members";

/**
 * Enterprise HR Teams Management View.
 * Features 3 executive metric tiles, integrated search & status toolbar,
 * sort controls, Table vs Cards view modes, and domain-tailored visual cards.
 */
export function TeamsView() {
  const [teams, setTeams] = useState<TeamItem[]>(getStoredTeams);

  // Filters & Sorters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<TeamStatusFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("name");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

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

  // Calculate members for a given team
  function getMemberCount(team: TeamItem): number {
    if (team.memberCount !== undefined) {
      return team.memberCount;
    }
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
    return users.length > 0 ? 2 : 2;
  }

  // Filtered and sorted teams list
  const filteredTeams = useMemo(() => {
    let result = teams.filter((team) => {
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

    result = [...result].sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "code") return a.code.localeCompare(b.code);
      if (sortBy === "members") {
        return getMemberCount(b) - getMemberCount(a);
      }
      return 0;
    });

    return result;
  }, [teams, statusFilter, searchTerm, sortBy, users]);

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

  function handleCreateClick() {
    setSelectedTeam(null);
    setDialogMode("create");
    setDialogOpen(true);
  }

  function handleEditClick(team: TeamItem) {
    setSelectedTeam(team);
    setDialogMode("edit");
    setDialogOpen(true);
  }

  function handleViewClick(team: TeamItem) {
    handleEditClick(team);
  }

  function handleToggleStatus(team: TeamItem) {
    const updated = teams.map((t) =>
      t.id === team.id ? { ...t, isActive: !t.isActive } : t,
    );
    setTeams(updated);
    saveStoredTeams(updated);
    toast({
      title: `Team "${team.name}" ${team.isActive ? "deactivated" : "activated"}.`,
      variant: "success",
    });
  }

  function handleDeleteClick(team: TeamItem) {
    setDeletingTeam(team);
  }

  function handleDeleteConfirm() {
    if (!deletingTeam) return;
    const updated = teams.filter((t) => t.id !== deletingTeam.id);
    setTeams(updated);
    saveStoredTeams(updated);
    toast({
      title: `Team "${deletingTeam.name}" deleted.`,
      variant: "success",
    });
    setDeletingTeam(null);
  }

  function handleFormSubmit(data: TeamFormData) {
    if (dialogMode === "create") {
      const code = data.code || generateTeamCode(data.name);
      const newTeam: TeamItem = {
        id: Date.now(),
        name: data.name.trim(),
        code,
        description: data.description.trim(),
        lead: "Pending Assignment",
        isActive: data.isActive,
        memberCount: 0,
      };
      const updated = [newTeam, ...teams];
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
              name: data.name.trim(),
              description: data.description.trim(),
              lead: selectedTeam.lead || "Pending Assignment",
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
    setSortBy("name");
  }

  return (
    <div className="flex flex-col gap-5">
      {/* 1. Page Header (Standard HrPageHeader) */}
      <HrPageHeader
        title="Teams"
        description="Organizational team divisions with scoped access permissions and leadership roles."
        icon={UsersRound}
        badge={
          <span className="rounded-full bg-white/20 backdrop-blur-xs px-3 py-1 text-xs font-semibold text-white">
            {teams.length} teams
          </span>
        }
        action={
          <Button
            type="button"
            size="sm"
            onClick={handleCreateClick}
            className="gap-2 bg-white/20 hover:bg-white/30 text-white border-white/30 rounded-xl px-4 py-2.5 font-medium cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>New Team</span>
          </Button>
        }
      />

      {/* 2. Executive Stat Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Total Teams Tile */}
        <div className="flex items-center justify-between rounded-2xl border border-sky-200/80 bg-linear-to-r from-[#edf6ff] to-[#f0f8ff] p-5 shadow-xs dark:border-sky-900/40 dark:from-slate-900 dark:to-slate-800">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#0a3271] dark:text-sky-300">
              Total Teams
            </p>
            <h3 className="mt-1 text-3xl font-extrabold text-[#0a3271] dark:text-white">
              {totalTeams}
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Active and pending divisions
            </p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-300/80 bg-white text-brand-500 shadow-xs dark:border-sky-800 dark:bg-slate-800 dark:text-sky-300">
            <Users className="h-6 w-6" />
          </div>
        </div>

        {/* Active Teams Tile */}
        <div className="flex items-center justify-between rounded-2xl border border-cyan-200/80 bg-linear-to-r from-[#eefcff] to-brand-mint-subtle p-5 shadow-xs dark:border-cyan-900/40 dark:from-slate-900 dark:to-slate-800">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-brand-cyan-accessible dark:text-cyan-300">
              Active Units
            </p>
            <h3 className="mt-1 text-3xl font-extrabold text-brand-cyan-accessible dark:text-white">
              {activeTeams}
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Operational working groups
            </p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/80 bg-white text-[#0284c7] shadow-xs dark:border-cyan-800 dark:bg-slate-800 dark:text-cyan-300">
            <CheckCircle2 className="h-6 w-6" />
          </div>
        </div>

        {/* Leads Pending Tile */}
        <div className="flex items-center justify-between rounded-2xl border border-amber-200/80 bg-linear-to-r from-[#fffbeb] to-[#fefce8] p-5 shadow-xs dark:border-amber-900/40 dark:from-slate-900 dark:to-slate-800">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
              Leads Pending
            </p>
            <h3 className="mt-1 text-3xl font-extrabold text-amber-800 dark:text-white">
              {leadsPending}
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Unassigned leadership roles
            </p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-300/80 bg-white text-amber-600 shadow-xs dark:border-amber-800 dark:bg-slate-800 dark:text-amber-400">
            <User className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* 3. Executive Integrated Toolbar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
        {/* Search Input */}
        <div className="flex-1 min-w-60">
          <SearchInput
            placeholder="Search teams by name, code or lead..."
            aria-label="Search teams"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onClear={() => setSearchTerm("")}
            clearable
          />
        </div>

        {/* Filters, Sorters & View Mode */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Status Filter */}
          <div className="w-32 sm:w-36">
            <Select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as TeamStatusFilter)
              }
              className="h-10 text-xs"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </div>

          {/* Sort By Dropdown */}
          <div className="w-36 sm:w-40">
            <Select
              aria-label="Sort by"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="h-10 text-xs"
            >
              <option value="name">Sort: Name</option>
              <option value="code">Sort: Code</option>
              <option value="members">Sort: Members</option>
            </Select>
          </div>

          {/* Reset Filters Button */}
          {hasActiveFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              title="Reset all filters"
              className="h-10 gap-1.5 rounded-xl border border-rose-200/80 px-3 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-950/40 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset</span>
            </Button>
          )}

          {/* View Mode Toggle: Cards vs Table */}
          <div className="flex items-center rounded-xl border border-slate-200/90 bg-slate-100/80 p-1 dark:border-slate-800 dark:bg-slate-800/80">
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-all cursor-pointer ${
                viewMode === "cards"
                  ? "bg-white text-brand-500 shadow-xs dark:bg-slate-900 dark:text-white"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
              title="Cards View"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Cards</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-all cursor-pointer ${
                viewMode === "table"
                  ? "bg-white text-brand-500 shadow-xs dark:bg-slate-900 dark:text-white"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
              title="Table View"
            >
              <List className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Table</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4. Teams Main Content: Cards Grid or Table View */}
      {filteredTeams.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200/90 bg-white px-6 py-16 text-center shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-50 text-[#0284c7] dark:bg-sky-950/60 dark:text-sky-300">
            <UsersRound className="h-8 w-8 stroke-[1.5]" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            {hasActiveFilters ? "No matching teams" : "No teams created yet"}
          </h3>
          <p className="mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">
            {hasActiveFilters
              ? "Try adjusting your search query or status filter to find what you're looking for."
              : "Create your first team to organize your workforce with scoped access permissions."}
          </p>
          {hasActiveFilters ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-5 rounded-xl"
              onClick={handleResetFilters}
            >
              Reset Filters
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              className="mt-5 gap-2 rounded-xl bg-linear-to-r from-[#1769F5] to-[#0284c7] text-white font-semibold cursor-pointer"
              onClick={handleCreateClick}
            >
              <Plus className="h-4 w-4" />
              <span>Create Team</span>
            </Button>
          )}
        </div>
      ) : viewMode === "cards" ? (
        /* Cards View (Grid Mode) */
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filteredTeams.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              memberCount={getMemberCount(team)}
              onView={handleViewClick}
              onEdit={handleEditClick}
              onToggleStatus={handleToggleStatus}
              onDelete={handleDeleteClick}
            />
          ))}
        </div>
      ) : (
        /* Table View (Alternative High-Density Mode) */
        <div className="rounded-2xl border border-slate-200/90 bg-white p-1 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <DataTable<TeamItem>
            caption="Organizational teams"
            columns={[
              {
                header: "Code",
                cell: (team) => (
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    #{team.code}
                  </span>
                ),
              },
              {
                header: "Team Name",
                cell: (team) => {
                  const visual = getTeamVisual(team.name);
                  const Icon = visual.icon;
                  return (
                    <div className="flex items-center gap-3">
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border shadow-2xs ${visual.bgColor} ${visual.textColor} ${visual.borderColor}`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <span className="block truncate font-bold text-slate-900 dark:text-white">
                          {team.name}
                        </span>
                        {team.description && (
                          <span className="block truncate text-[11px] text-slate-400">
                            {team.description}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                },
              },
              {
                header: "Team Lead",
                cell: (team) => {
                  const isPending =
                    !team.lead ||
                    team.lead.toLowerCase().includes("pending") ||
                    team.lead.toLowerCase().includes("unassigned");
                  return isPending ? (
                    <span className="rounded-md border border-amber-200/80 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
                      Pending Assignment
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
                      <User className="h-3.5 w-3.5 text-slate-400" />
                      <span>{team.lead}</span>
                    </span>
                  );
                },
              },
              {
                header: "Members",
                cell: (team) => (
                  <span className="inline-flex items-center gap-1 rounded-lg border border-sky-200/60 bg-sky-50 px-2.5 py-0.5 text-xs font-semibold text-[#0a3271] dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-200">
                    <Users className="h-3 w-3 text-[#0284c7]" />
                    <span>{getMemberCount(team)} Members</span>
                  </span>
                ),
              },
              {
                header: "Status",
                cell: (team) => (
                  <span
                    className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      team.isActive
                        ? "border border-emerald-200/80 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                        : "border border-slate-200/80 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
                    }`}
                  >
                    {team.isActive ? "Active" : "Inactive"}
                  </span>
                ),
              },
              {
                header: "Action",
                className: "w-20 text-right",
                headerClassName: "w-20 text-right",
                cell: (team) => (
                  <div className="flex justify-end">
                    <ActionMenu
                      ariaLabel={`Actions for ${team.name}`}
                      items={[
                        {
                          label: "Edit Team",
                          icon: <Edit3 className="h-4 w-4" />,
                          onClick: () => handleEditClick(team),
                        },
                        {
                          label: team.isActive
                            ? "Deactivate Team"
                            : "Activate Team",
                          icon: <Power className="h-4 w-4" />,
                          onClick: () => handleToggleStatus(team),
                        },
                        {
                          label: "Delete Team",
                          icon: <Trash2 className="h-4 w-4" />,
                          variant: "destructive",
                          onClick: () => handleDeleteClick(team),
                        },
                      ]}
                    />
                  </div>
                ),
              },
            ]}
            rows={filteredTeams}
            getRowKey={(team) => String(team.id)}
          />
        </div>
      )}

      {/* 5. Team Create / Edit Dialog */}
      <TeamDialog
        open={dialogOpen}
        mode={dialogMode}
        team={selectedTeam}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleFormSubmit}
      />

      {/* 6. Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={Boolean(deletingTeam)}
        onClose={() => setDeletingTeam(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Team"
        itemName={deletingTeam?.name ?? ""}
      />
    </div>
  );
}
