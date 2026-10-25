import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ref, onValue, remove, update, push, set } from "firebase/database";
import { database } from "@/services/firebase";
import {
  ProposalDocument,
  ProposalStatus,
  UserProposalRole,
  hasProposalPermission,
  ProposalActivity,
} from "../proposalTypes";
import { Project } from "../types";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProposalPreviewModal } from "./ProposalPreviewModal";
import { ExtendFollowupModal } from "./ExtendFollowupModal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FileText,
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Edit,
  Eye,
  Copy,
  Download,
  Archive,
  Trash2,
  FileCheck,
  Clock,
  Send,
  Layers,
  FolderKanban,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Settings,
  ShieldCheck,
  UserCheck,
  User,
  History,
  MessageSquare,
  Calendar,
  ChevronDown,
  Check,
  CheckCircle,
  RotateCcw,
  XCircle,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const STATUS_CONFIG: Record<
  ProposalStatus,
  { label: string; className: string }
> = {
  draft: {
    label: "Draft",
    className: "bg-slate-100 text-slate-700 border-slate-300",
  },
  under_review: {
    label: "Under Review",
    className: "bg-amber-100 text-amber-800 border-amber-300",
  },
  changes_requested: {
    label: "Changes Requested",
    className: "bg-orange-100 text-orange-800 border-orange-300",
  },
  approved: {
    label: "Approved",
    className: "bg-emerald-100 text-emerald-800 border-emerald-300",
  },
  sent: {
    label: "Sent to Client",
    className: "bg-blue-100 text-blue-800 border-blue-300",
  },
  accepted: {
    label: "Accepted",
    className: "bg-emerald-100 text-emerald-800 border-emerald-300",
  },
  rejected: {
    label: "Rejected",
    className: "bg-rose-100 text-rose-800 border-rose-300",
  },
  archived: {
    label: "Archived",
    className: "bg-gray-100 text-gray-500 border-gray-300",
  },
};

export default function ProposalsHub() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Phase 12: Active Role Context (admin | manager | employee)
  const [currentRole, setCurrentRole] = useState<UserProposalRole>("admin");

  const [proposals, setProposals] = useState<ProposalDocument[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // Active View Tab: 'proposals' | 'history'
  const [activeHubTab, setActiveHubTab] = useState<"proposals" | "history">(
    "proposals",
  );
  const [selectedHistoryProposalId, setSelectedHistoryProposalId] =
    useState<string>("");
  const [historyComboboxOpen, setHistoryComboboxOpen] = useState(false);

  // Proposal Document Preview Modal state (Popup similar to sales quotation)
  const [previewModalProposal, setPreviewModalProposal] =
    useState<ProposalDocument | null>(null);
  const [autoDownloadProposal, setAutoDownloadProposal] = useState(false);

  // Extend Follow-up Due Date Modal state
  const [extendModalProposal, setExtendModalProposal] =
    useState<ProposalDocument | null>(null);

  // Filters state
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("");

  // Quick Status Modal state
  const [quickStatusModal, setQuickStatusModal] = useState<{
    open: boolean;
    proposal: ProposalDocument | null;
    targetStatus: ProposalStatus;
    actionLabel: string;
    description: string;
    requireComment?: boolean;
    commentLabel?: string;
    commentPlaceholder?: string;
    btnColor?: string;
  }>({
    open: false,
    proposal: null,
    targetStatus: "draft",
    actionLabel: "",
    description: "",
  });
  const [quickStatusComment, setQuickStatusComment] = useState("");
  const [actorName, setActorName] = useState(
    user?.name || user?.username || "Current User",
  );
  const [actorRole, setActorRole] = useState("Project Lead");
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Sync user info if user loaded later
  useEffect(() => {
    if (user?.name || user?.username) {
      setActorName(user.name || user.username);
    }
  }, [user]);

  // Handle follow-up date extension with required reason logged to activities
  const handleConfirmExtendFollowup = async (
    newDate: string,
    reason: string,
  ) => {
    if (!extendModalProposal) return;
    const oldDueDate =
      extendModalProposal.dueDate || extendModalProposal.due_date || "None";
    const oldFormatted =
      oldDueDate !== "None"
        ? new Date(oldDueDate).toLocaleDateString("en-GB")
        : "None";
    const newFormatted = new Date(newDate).toLocaleDateString("en-GB");

    const activity: ProposalActivity = {
      id: `act_${Date.now()}`,
      user: user?.name || user?.username || "Admin",
      userName: user?.name || user?.username || "Admin",
      userRole:
        currentRole === "admin"
          ? "Admin"
          : currentRole === "manager"
            ? "Project Lead"
            : "Reviewer",
      action: `Follow-up Extended from ${oldFormatted} to ${newFormatted}`,
      previousStatus: extendModalProposal.status,
      newStatus: extendModalProposal.status,
      timestamp: new Date().toISOString(),
      comments: reason,
    };

    const currentActivities = Array.isArray(extendModalProposal.activities)
      ? [...extendModalProposal.activities]
      : [];
    currentActivities.push(activity);

    const newExtensionCount =
      (extendModalProposal.followUpExtensionCount || 0) + 1;

    try {
      await update(
        ref(database, `proposal_documents/${extendModalProposal.id}`),
        {
          dueDate: newDate,
          due_date: newDate,
          followUpNotes: reason,
          followUpExtensionCount: newExtensionCount,
          activities: currentActivities,
          updatedAt: new Date().toISOString(),
        },
      );
      toast.success(`Follow-up extended to ${newFormatted}`);
      setExtendModalProposal(null);
    } catch (err: any) {
      toast.error(
        "Failed to extend follow-up date: " + (err?.message || "Unknown error"),
      );
    }
  };

  useEffect(() => {
    // 1. Subscribe to proposals
    const unsubProposals = onValue(
      ref(database, "proposal_documents"),
      (snap) => {
        if (!snap.exists()) {
          setProposals([]);
          setLoading(false);
          return;
        }
        const data = snap.val();
        const list: ProposalDocument[] = Object.entries(data).map(
          ([id, item]: [string, any]) => ({
            id,
            ...item,
            proposalNumber: item.proposalNumber || "PROP-",
            status: item.status || "draft",
          }),
        );
        list.sort((a, b) =>
          (b.createdAt || "").localeCompare(a.createdAt || ""),
        );
        setProposals(list);
        setLoading(false);
      },
    );

    // 2. Fetch projects for dropdown filtering
    const unsubProjects = onValue(ref(database, "projects"), (snap) => {
      const val = snap.val() || {};
      const list: Project[] = Object.entries(val).map(
        ([id, p]: [string, any]) => ({
          id,
          ...p,
          name: p?.name || "Untitled Project",
        }),
      );
      setProjects(list);
    });

    return () => {
      unsubProposals();
      unsubProjects();
    };
  }, []);

  // Summary counts
  const totalProposals = proposals.length;
  const draftCount = proposals.filter((p) => p.status === "draft").length;
  const underReviewCount = proposals.filter(
    (p) => p.status === "under_review",
  ).length;
  const approvedCount = proposals.filter((p) => p.status === "approved").length;
  const sentCount = proposals.filter((p) => p.status === "sent").length;

  // Follow-up due count (today or overdue for active proposals)
  const todayStr = new Date().toISOString().split("T")[0];
  const dueFollowupsCount = proposals.filter((p) => {
    const d = p.dueDate || p.due_date;
    return (
      d &&
      d <= todayStr &&
      !["approved", "accepted", "rejected", "archived"].includes(p.status)
    );
  }).length;

  const summaryCards = [
    {
      label: "Total Proposals",
      value: totalProposals,
      sub: `${draftCount} in draft`,
      icon: FileText,
      color: "text-indigo-600",
      bg: "bg-indigo-100/80",
      onClick: () => setStatusFilter("all"),
    },
    {
      label: "Follow-ups Due",
      value: dueFollowupsCount,
      sub: "Action required now",
      icon: AlertCircle,
      color: dueFollowupsCount > 0 ? "text-rose-600" : "text-emerald-700",
      bg: dueFollowupsCount > 0 ? "bg-rose-100/80" : "bg-emerald-100/80",
      onClick: () => setStatusFilter("followup_due"),
    },
    {
      label: "Under Review",
      value: underReviewCount,
      sub: "Pending sign-off",
      icon: Layers,
      color: "text-amber-600",
      bg: "bg-amber-100/80",
      onClick: () => setStatusFilter("under_review"),
    },
    {
      label: "Approved",
      value: approvedCount,
      sub: "Ready for delivery",
      icon: FileCheck,
      color: "text-emerald-700",
      bg: "bg-emerald-100/80",
      onClick: () => setStatusFilter("approved"),
    },
    {
      label: "Sent to Client",
      value: sentCount,
      sub: "Delivered to client",
      icon: Send,
      color: "text-blue-600",
      bg: "bg-blue-100/80",
      onClick: () => setStatusFilter("sent"),
    },
  ];

  // Distinct clients list
  const uniqueClients = useMemo(() => {
    const setOfClients = new Set<string>();
    proposals.forEach((p) => {
      if (p.clientName) setOfClients.add(p.clientName);
    });
    return Array.from(setOfClients);
  }, [proposals]);

  // Filtered proposals list
  const filteredProposals = useMemo(() => {
    return proposals.filter((p) => {
      const matchSearch =
        !search.trim() ||
        p.proposalNumber?.toLowerCase().includes(search.toLowerCase()) ||
        p.title?.toLowerCase().includes(search.toLowerCase()) ||
        p.projectName?.toLowerCase().includes(search.toLowerCase()) ||
        p.clientName?.toLowerCase().includes(search.toLowerCase()) ||
        p.templateTitle?.toLowerCase().includes(search.toLowerCase());

      const matchStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "followup_due"
            ? Boolean(
                (p.dueDate || p.due_date) &&
                (p.dueDate || p.due_date)! <= todayStr &&
                !["approved", "accepted", "rejected", "archived"].includes(
                  p.status,
                ),
              )
            : p.status === statusFilter;
      const matchClient =
        clientFilter === "all" || p.clientName === clientFilter;
      const matchProject =
        projectFilter === "all" ||
        p.projectId === projectFilter ||
        p.projectName === projectFilter;
      const matchDate =
        !dateFilter || (p.createdAt && p.createdAt.startsWith(dateFilter));

      return (
        matchSearch && matchStatus && matchClient && matchProject && matchDate
      );
    });
  }, [
    proposals,
    search,
    statusFilter,
    clientFilter,
    projectFilter,
    dateFilter,
  ]);

  const handleArchive = async (p: ProposalDocument) => {
    try {
      await update(ref(database, `proposal_documents/${p.id}`), {
        status: "archived",
        updatedAt: new Date().toISOString(),
      });
      toast.success(`Proposal "${p.proposalNumber}" archived`);
    } catch {
      toast.error("Failed to archive proposal");
    }
  };

  const handleDelete = async (p: ProposalDocument) => {
    if (
      !window.confirm(
        `Are you sure you want to delete proposal "${p.proposalNumber}"? This cannot be undone.`,
      )
    )
      return;
    try {
      await remove(ref(database, `proposal_documents/${p.id}`));
      toast.success("Proposal deleted");
    } catch {
      toast.error("Failed to delete proposal");
    }
  };

  const handleDuplicate = async (p: ProposalDocument) => {
    try {
      const newRef = push(ref(database, "proposal_documents"));
      const now = new Date().toISOString();
      const cloned: ProposalDocument = {
        ...p,
        id: newRef.key!,
        proposalNumber: `${p.proposalNumber}-COPY`,
        title: `${p.title} (Copy)`,
        status: "draft",
        createdAt: now,
        updatedAt: now,
        activities: [
          {
            id: `act_${Date.now()}`,
            user: p.preparedBy || "Arun",
            action: `Proposal duplicated from ${p.proposalNumber}`,
            newStatus: "draft",
            timestamp: now,
          },
        ],
      };
      await set(newRef, cloned);
      toast.success(`Duplicated proposal: ${cloned.proposalNumber}`);
    } catch {
      toast.error("Failed to duplicate proposal");
    }
  };

  const handleDownloadPDF = (p: ProposalDocument) => {
    navigate(`/projects/proposals/${p.id}/edit`);
    toast.info(`Opening ${p.proposalNumber} for PDF generation.`);
    setAutoDownloadProposal(true);
    setPreviewModalProposal(p);
  };

  const openQuickStatusModal = (
    proposal: ProposalDocument,
    targetStatus: ProposalStatus,
    actionLabel: string,
    description: string,
    requireComment = false,
    btnColor = "bg-emerald-600 hover:bg-emerald-700",
    commentLabel?: string,
    commentPlaceholder?: string,
  ) => {
    setQuickStatusModal({
      open: true,
      proposal,
      targetStatus,
      actionLabel,
      description,
      requireComment,
      commentLabel,
      commentPlaceholder,
      btnColor,
    });
    setQuickStatusComment("");
    setActorName(user?.name || user?.username || "Current User");
    setActorRole(
      currentRole === "admin"
        ? "Admin"
        : currentRole === "manager"
          ? "Project Lead"
          : "Reviewer",
    );
  };

  const handleConfirmQuickStatus = async () => {
    const { proposal, targetStatus, actionLabel, requireComment } =
      quickStatusModal;
    if (!proposal) return;

    if (requireComment && !quickStatusComment.trim()) {
      toast.error(
        targetStatus === "rejected"
          ? "Please enter the reason why the proposal was rejected."
          : "Please enter review comments or justification.",
      );
      return;
    }

    setUpdatingStatus(true);
    try {
      const now = new Date().toISOString();
      const existingActivities: ProposalActivity[] = Array.isArray(
        proposal.activities,
      )
        ? proposal.activities
        : typeof proposal.activities === "object" &&
            proposal.activities !== null
          ? Object.values(proposal.activities)
          : [];

      const newAct: ProposalActivity = {
        id: `act_${Date.now()}`,
        user: actorName.trim() || user?.name || user?.username || "User",
        userName: actorName.trim() || user?.name || user?.username || "User",
        userRole: actorRole.trim() || currentRole,
        action: actionLabel,
        previousStatus: proposal.status,
        newStatus: targetStatus,
        timestamp: now,
        comments: quickStatusComment.trim() || undefined,
      };

      await update(ref(database, `proposal_documents/${proposal.id}`), {
        status: targetStatus,
        activities: [...existingActivities, newAct],
        updated_at: now,
        updatedAt: now,
      });

      toast.success(
        `Proposal ${proposal.proposalNumber} status updated to ${targetStatus.replace("_", " ").toUpperCase()}!`,
      );
      setQuickStatusModal((prev) => ({ ...prev, open: false }));
    } catch (err: any) {
      toast.error(err?.message || "Failed to update proposal status");
    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Top Banner Header */}
      <div
        style={{
          background:
            "linear-gradient(135deg, #4D9F4B 0%, #72B84A 50%, #9FCA48 100%)",
        }}
        className="text-white rounded-3xl p-8 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-6"
      >
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="p-2.5 bg-white/10 backdrop-blur-md rounded-2xl text-emerald-200 border border-white/15">
              <FileText className="h-6 w-6" />
            </span>
            <h1 className="text-2xl font-black tracking-tight">
              Proposal Documents
            </h1>
          </div>
          <p className="text-emerald-100/90 text-xs sm:text-sm pl-1">
            Create, manage and generate client proposals using reusable document
            templates.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          {/* RBAC Role Switcher Selector */}
          <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-white/25 text-xs text-white">
            <ShieldCheck className="h-4 w-4 text-emerald-200" />
            <span className="font-bold text-[11px]">Role:</span>
            <select
              value={currentRole}
              onChange={(e) => {
                const newRole = e.target.value as UserProposalRole;
                setCurrentRole(newRole);
                toast.info(`Switched active view to ${newRole.toUpperCase()}`);
              }}
              className="bg-emerald-950/40 text-white font-bold text-xs rounded-xl px-2 py-1 border border-white/20 focus:outline-none cursor-pointer"
            >
              <option value="admin" className="text-slate-900 bg-white">
                Admin (Full Access)
              </option>
              <option value="manager" className="text-slate-900 bg-white">
                Manager / Reviewer
              </option>
              <option value="employee" className="text-slate-900 bg-white">
                Employee (Author)
              </option>
            </select>
          </div>

          {/* Document Settings (Admin Only) */}
          {hasProposalPermission(currentRole, "manage_settings") && (
            <Button
              variant="outline"
              onClick={() => navigate("/projects/proposals/settings")}
              className="bg-white/15 hover:bg-white/25 text-white border-white/30 font-bold rounded-2xl shadow-sm px-3.5 py-2.5 h-auto transition-all duration-200 text-xs"
              title="Proposal Document Settings"
            >
              <Settings className="h-4 w-4 mr-1.5 text-white" /> Settings
            </Button>
          )}

          {/* Manage Templates (Admin Only) */}
          {hasProposalPermission(currentRole, "manage_templates") && (
            <Button
              variant="outline"
              onClick={() => navigate("/projects/proposals/templates")}
              className="bg-white/15 hover:bg-white/25 text-white border-white/30 font-bold rounded-2xl shadow-sm px-4 py-2.5 h-auto transition-all duration-200 text-xs"
            >
              <Layers className="h-4 w-4 mr-1.5 text-white" /> Manage Templates
            </Button>
          )}

          {/* Create Proposal (Admin, Manager, Employee) */}
          {hasProposalPermission(currentRole, "create_proposal") && (
            <Button
              onClick={() => navigate("/projects/proposals/create")}
              className="bg-white text-emerald-900 hover:bg-emerald-50 font-bold rounded-2xl shadow-md px-5 py-2.5 h-auto transition-all duration-200 hover:scale-[1.02] text-xs"
            >
              <Plus className="h-4 w-4 mr-1.5 text-emerald-700" /> Create
              Proposal
            </Button>
          )}
        </div>
      </div>

      {/* 2. Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {summaryCards.map((s) => {
          const Icon = s.icon;
          return (
            <Card
              key={s.label}
              onClick={s.onClick}
              className="cursor-pointer shadow-lg border-slate-200/80 rounded-3xl overflow-hidden bg-white hover:shadow-xl hover:scale-[1.01] transition-all duration-200 group"
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2 bg-slate-50/50 p-4 border-b border-slate-100">
                <CardTitle className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 truncate">
                  {s.label}
                </CardTitle>
                <div
                  className={`p-2.5 rounded-2xl group-hover:scale-110 transition-transform ${s.bg} ${s.color}`}
                >
                  <Icon className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-3">
                <div className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  {s.value}
                </div>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5 truncate">
                  {s.sub}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* 3. Proposals & Workflow History Dual Tabs Section */}
      <Card className="border border-slate-200/80 shadow-md rounded-3xl bg-white overflow-hidden">
        <CardHeader className="p-6 bg-slate-50/40 border-b border-slate-100 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                {activeHubTab === "proposals" ? (
                  <>
                    <FileText className="h-5 w-5 text-emerald-600" /> All
                    Proposals Directory
                  </>
                ) : (
                  <>
                    <History className="h-5 w-5 text-emerald-600" /> Proposal
                    Workflow History
                  </>
                )}
              </CardTitle>
              <p className="text-xs text-slate-500 font-medium mt-1">
                {activeHubTab === "proposals"
                  ? `Showing ${filteredProposals.length} of ${proposals.length} total proposals`
                  : "Complete chronological audit trail of all state transitions and review comments"}
              </p>
            </div>

            {/* Hub Tabs Navigation Toggle */}
            <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200/80 shrink-0 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setActiveHubTab("proposals")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeHubTab === "proposals"
                    ? "bg-white text-emerald-800 shadow-xs border border-slate-200/60"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <FileText className="h-4 w-4 text-emerald-600" />
                <span>All Proposals</span>
                <span className="ml-1 px-1.5 py-0.2 bg-slate-100 text-[10px] rounded-full text-slate-600 font-mono">
                  {proposals.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!selectedHistoryProposalId && proposals.length > 0) {
                    setSelectedHistoryProposalId(proposals[0].id);
                  }
                  setActiveHubTab("history");
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeHubTab === "history"
                    ? "bg-white text-emerald-800 shadow-xs border border-slate-200/60"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <History className="h-4 w-4 text-emerald-600" />
                <span>Workflow & Audit History</span>
              </button>
            </div>
          </div>

          {/* TAB 1: Filters Bar (Only visible when activeHubTab === 'proposals') */}
          {activeHubTab === "proposals" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 pt-4">
              {/* Search */}
              <div className="relative col-span-1 sm:col-span-2 md:col-span-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search proposals..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 bg-white rounded-xl text-xs h-9 border-slate-200"
                />
              </div>

              {/* Status filter */}
              <div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="all">All Statuses</option>
                  <option value="followup_due">
                    ⚠️ Follow-up Due (Action Required)
                  </option>
                  <option value="draft">Draft</option>
                  <option value="under_review">Under Review</option>
                  <option value="changes_requested">Changes Requested</option>
                  <option value="approved">Approved</option>
                  <option value="sent">Sent to Client</option>
                  <option value="accepted">Accepted</option>
                  <option value="rejected">Rejected</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              {/* Client filter */}
              <div>
                <select
                  value={clientFilter}
                  onChange={(e) => setClientFilter(e.target.value)}
                  className="w-full h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="all">All Clients</option>
                  {uniqueClients.map((client) => (
                    <option key={client} value={client}>
                      {client}
                    </option>
                  ))}
                </select>
              </div>

              {/* Project filter */}
              <div>
                <select
                  value={projectFilter}
                  onChange={(e) => setProjectFilter(e.target.value)}
                  className="w-full h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="all">All Projects</option>
                  {projects.map((proj) => (
                    <option key={proj.id} value={proj.id}>
                      {proj.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Filter */}
              <div>
                <Input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="bg-white rounded-xl text-xs h-9 border-slate-200 text-slate-700"
                />
              </div>
            </div>
          )}
        </CardHeader>

        <CardContent className="p-0">
          {/* TAB 1 CONTENT: Proposals Table */}
          {activeHubTab === "proposals" && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/70 border-b border-slate-100">
                  <TableRow>
                    <TableHead className="pl-6 text-xs font-bold text-slate-600">
                      Proposal #
                    </TableHead>
                    <TableHead className="text-xs font-bold text-slate-600">
                      Project Name
                    </TableHead>
                    <TableHead className="text-xs font-bold text-slate-600">
                      Client
                    </TableHead>
                    <TableHead className="text-xs font-bold text-slate-600">
                      Template Used
                    </TableHead>
                    <TableHead className="text-xs font-bold text-slate-600 text-center">
                      Version
                    </TableHead>
                    <TableHead className="text-xs font-bold text-slate-600">
                      Created By
                    </TableHead>
                    <TableHead className="text-xs font-bold text-slate-600">
                      Created Date
                    </TableHead>
                    <TableHead className="text-xs font-bold text-slate-600">
                      Follow-up Due
                    </TableHead>
                    <TableHead className="text-xs font-bold text-slate-600 text-center">
                      Status
                    </TableHead>
                    <TableHead className="text-xs font-bold text-slate-600 text-right pr-6">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProposals.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="h-64 text-center">
                        <div className="flex flex-col items-center justify-center space-y-3">
                          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-slate-400">
                            <FileText className="h-8 w-8" />
                          </div>
                          <p className="text-sm font-bold text-slate-700">
                            No proposals found
                          </p>
                          <p className="text-xs text-slate-400 max-w-sm">
                            {search ||
                            statusFilter !== "all" ||
                            clientFilter !== "all" ||
                            projectFilter !== "all" ||
                            dateFilter
                              ? "No records match your active search and filter criteria."
                              : "Get started by creating your first configurable proposal document."}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredProposals.map((p) => {
                      const statusCfg =
                        STATUS_CONFIG[p.status] || STATUS_CONFIG.draft;
                      const dateFormatted = p.createdAt
                        ? new Date(p.createdAt).toLocaleDateString("en-GB")
                        : "-";

                      // Compute follow-up due date status
                      const todayStr = new Date().toISOString().split("T")[0];
                      const dueDate = p.dueDate || p.due_date;
                      let dueBadge: React.ReactNode = null;
                      if (dueDate) {
                        const isResolved = [
                          "approved",
                          "accepted",
                          "rejected",
                          "archived",
                        ].includes(p.status);
                        const extensionNote = p.followUpNotes
                          ? `Note: "${p.followUpNotes}"`
                          : "";
                        const extensionCountNote = p.followUpExtensionCount
                          ? `(Extended ${p.followUpExtensionCount}x)`
                          : "";
                        const tooltipTitle =
                          `Click to extend follow-up deadline. ${extensionCountNote} ${extensionNote}`.trim();

                        if (isResolved) {
                          dueBadge = (
                            <span className="text-[11px] text-slate-400 font-mono">
                              {new Date(dueDate).toLocaleDateString("en-GB")}
                            </span>
                          );
                        } else if (dueDate < todayStr) {
                          dueBadge = (
                            <button
                              type="button"
                              onClick={() => setExtendModalProposal(p)}
                              title={tooltipTitle}
                              className="inline-flex items-center gap-1 bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-200 text-[9.5px] font-black px-2 py-0.5 rounded-full transition-transform hover:scale-105 cursor-pointer shadow-2xs"
                            >
                              <AlertCircle className="h-3 w-3 text-rose-600" />
                              <span>
                                Overdue (
                                {new Date(dueDate).toLocaleDateString("en-GB")})
                              </span>
                              {p.followUpExtensionCount ? (
                                <span className="text-[8.5px] bg-rose-200 text-rose-900 px-1 rounded-full font-bold">
                                  {p.followUpExtensionCount}x
                                </span>
                              ) : null}
                            </button>
                          );
                        } else if (dueDate === todayStr) {
                          dueBadge = (
                            <button
                              type="button"
                              onClick={() => setExtendModalProposal(p)}
                              title={tooltipTitle}
                              className="inline-flex items-center gap-1 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 text-[9.5px] font-black px-2 py-0.5 rounded-full transition-transform hover:scale-105 cursor-pointer shadow-2xs"
                            >
                              <Clock className="h-3 w-3 text-amber-700" />
                              <span>Due Today</span>
                              {p.followUpExtensionCount ? (
                                <span className="text-[8.5px] bg-amber-200 text-amber-950 px-1 rounded-full font-bold">
                                  {p.followUpExtensionCount}x
                                </span>
                              ) : null}
                            </button>
                          );
                        } else {
                          dueBadge = (
                            <button
                              type="button"
                              onClick={() => setExtendModalProposal(p)}
                              title={tooltipTitle}
                              className="inline-flex items-center gap-1 bg-slate-50 hover:bg-emerald-50 text-slate-600 hover:text-emerald-800 border border-slate-200 hover:border-emerald-300 text-[9.5px] font-semibold px-2 py-0.5 rounded-full transition-transform hover:scale-105 cursor-pointer shadow-2xs"
                            >
                              <Clock className="h-3 w-3 text-slate-400" />
                              <span>
                                {new Date(dueDate).toLocaleDateString("en-GB")}
                              </span>
                              {p.followUpExtensionCount ? (
                                <span className="text-[8.5px] bg-slate-200 text-slate-700 px-1 rounded-full font-bold">
                                  {p.followUpExtensionCount}x
                                </span>
                              ) : null}
                            </button>
                          );
                        }
                      } else {
                        dueBadge = (
                          <button
                            type="button"
                            onClick={() => setExtendModalProposal(p)}
                            title="Set follow-up due date"
                            className="text-[11px] text-slate-400 hover:text-emerald-700 hover:underline cursor-pointer"
                          >
                            + Set date
                          </button>
                        );
                      }

                      return (
                        <TableRow
                          key={p.id}
                          className="hover:bg-slate-50/60 transition-colors border-b border-slate-100/80"
                        >
                          <TableCell className="pl-6 py-3.5 font-mono text-xs font-bold text-emerald-800">
                            {p.proposalNumber}
                          </TableCell>
                          <TableCell className="py-3.5">
                            <div className="font-bold text-xs text-slate-800">
                              {p.projectName || "-"}
                            </div>
                            {p.projectCode && (
                              <div className="text-[10px] text-slate-400">
                                {p.projectCode}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="py-3.5 text-xs text-slate-700 font-medium">
                            {p.clientName || "-"}
                          </TableCell>
                          <TableCell className="py-3.5 text-xs text-slate-600">
                            {p.templateTitle || "Standard Proposal"}
                          </TableCell>
                          <TableCell className="py-3.5 text-center">
                            <Badge
                              variant="outline"
                              className="text-[10px] font-semibold bg-slate-50 border-slate-200"
                            >
                              {p.templateVersion || "v1.0"}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-3.5 text-xs text-slate-600">
                            {p.createdByName || p.createdBy || "Admin"}
                          </TableCell>
                          <TableCell className="py-3.5 text-xs text-slate-500 font-medium">
                            {dateFormatted}
                          </TableCell>
                          <TableCell className="py-3.5">{dueBadge}</TableCell>
                          <TableCell className="py-3.5 text-center">
                            {/* Interactive Quick Status Dropdown */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full border transition-transform hover:scale-105 cursor-pointer shadow-2xs ${statusCfg.className}`}
                                  title="Click to change status"
                                >
                                  <span>{statusCfg.label}</span>
                                  <ChevronDown className="h-3 w-3 opacity-60" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="center"
                                className="w-48 rounded-xl shadow-lg border-slate-100 p-1"
                              >
                                <DropdownMenuLabel className="text-[9.5px] font-bold uppercase text-slate-400">
                                  Update Status
                                </DropdownMenuLabel>

                                {(p.status === "draft" ||
                                  p.status === "changes_requested") && (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      openQuickStatusModal(
                                        p,
                                        "under_review",
                                        "Submitted for Review",
                                        "Submit this proposal for internal management review.",
                                      )
                                    }
                                    className="text-xs cursor-pointer gap-2 font-medium text-amber-700"
                                  >
                                    <Send className="h-3.5 w-3.5 text-amber-600" />{" "}
                                    Submit for Review
                                  </DropdownMenuItem>
                                )}

                                {p.status === "under_review" && (
                                  <>
                                    <DropdownMenuItem
                                      onClick={() =>
                                        openQuickStatusModal(
                                          p,
                                          "approved",
                                          "Approved by Reviewer",
                                          "Approve this proposal document as commercially and technically verified.",
                                        )
                                      }
                                      className="text-xs cursor-pointer gap-2 font-medium text-emerald-700"
                                    >
                                      <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />{" "}
                                      Approve Proposal
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() =>
                                        openQuickStatusModal(
                                          p,
                                          "changes_requested",
                                          "Requested Changes",
                                          "Provide feedback and return this proposal for author revisions.",
                                          true,
                                          "bg-orange-600 hover:bg-orange-700",
                                        )
                                      }
                                      className="text-xs cursor-pointer gap-2 font-medium text-orange-700"
                                    >
                                      <RotateCcw className="h-3.5 w-3.5 text-orange-600" />{" "}
                                      Request Changes
                                    </DropdownMenuItem>
                                  </>
                                )}

                                {p.status === "approved" && (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      openQuickStatusModal(
                                        p,
                                        "sent",
                                        "Sent to Client",
                                        "Confirm that this proposal has been officially delivered to the client.",
                                      )
                                    }
                                    className="text-xs cursor-pointer gap-2 font-medium text-blue-700"
                                  >
                                    <Send className="h-3.5 w-3.5 text-blue-600" />{" "}
                                    Mark Sent to Client
                                  </DropdownMenuItem>
                                )}

                                {p.status === "sent" && (
                                  <>
                                    <DropdownMenuItem
                                      onClick={() =>
                                        openQuickStatusModal(
                                          p,
                                          "accepted",
                                          "Client Accepted Proposal",
                                          "Record client acceptance of this proposal. Document any updates, agreed variations, PO number, or remarks below.",
                                          false,
                                          "bg-emerald-600 hover:bg-emerald-700",
                                          "Reason / Any Updates",
                                          "Enter any updates, agreed adjustments, client PO reference, milestone schedules, or confirmation notes...",
                                        )
                                      }
                                      className="text-xs cursor-pointer gap-2 font-medium text-emerald-700"
                                    >
                                      <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />{" "}
                                      Mark as Accepted
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() =>
                                        openQuickStatusModal(
                                          p,
                                          "rejected",
                                          "Client Rejected Proposal",
                                          "Record that the client did not approve this proposal. Please specify the reason why it was rejected.",
                                          true,
                                          "bg-rose-600 hover:bg-rose-700",
                                          "Reason why Rejected",
                                          "Please specify the reason why the client rejected this proposal (e.g., budget exceeded, scope mismatch, chosen competitor)...",
                                        )
                                      }
                                      className="text-xs cursor-pointer gap-2 font-medium text-rose-700"
                                    >
                                      <XCircle className="h-3.5 w-3.5 text-rose-600" />{" "}
                                      Mark as Rejected
                                    </DropdownMenuItem>
                                  </>
                                )}

                                {p.status !== "draft" && (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      openQuickStatusModal(
                                        p,
                                        "draft",
                                        "Reverted to Draft",
                                        "Revert this proposal back to Draft status for further internal edits.",
                                      )
                                    }
                                    className="text-xs cursor-pointer gap-2 font-medium text-slate-600"
                                  >
                                    <Clock className="h-3.5 w-3.5 text-slate-500" />{" "}
                                    Revert to Draft
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                          <TableCell className="py-3.5 text-right pr-6">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 rounded-xl hover:bg-slate-100"
                                >
                                  <MoreHorizontal className="h-4 w-4 text-slate-600" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                className="w-48 rounded-xl shadow-lg border-slate-100"
                              >
                                <DropdownMenuLabel className="text-[10px] font-bold uppercase text-slate-400">
                                  Actions
                                </DropdownMenuLabel>
                                <DropdownMenuItem
                                  onClick={() =>
                                    navigate(`/projects/proposals/${p.id}/edit`)
                                  }
                                  className="text-xs cursor-pointer gap-2"
                                >
                                  <Edit className="h-3.5 w-3.5 text-slate-600" />{" "}
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setAutoDownloadProposal(false);
                                    setPreviewModalProposal(p);
                                  }}
                                  className="text-xs cursor-pointer gap-2 font-semibold text-slate-800"
                                >
                                  <Eye className="h-3.5 w-3.5 text-emerald-600" />{" "}
                                  Preview Document
                                </DropdownMenuItem>

                                {p.status === "sent" && (
                                  <>
                                    <DropdownMenuItem
                                      onClick={() =>
                                        openQuickStatusModal(
                                          p,
                                          "accepted",
                                          "Client Accepted Proposal",
                                          "Record client acceptance of this proposal. Document any updates, agreed variations, PO number, or remarks below.",
                                          false,
                                          "bg-emerald-600 hover:bg-emerald-700",
                                          "Reason / Any Updates",
                                          "Enter any updates, agreed adjustments, client PO reference, milestone schedules, or confirmation notes...",
                                        )
                                      }
                                      className="text-xs cursor-pointer gap-2 text-emerald-700 font-semibold"
                                    >
                                      <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />{" "}
                                      Mark Accepted
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() =>
                                        openQuickStatusModal(
                                          p,
                                          "rejected",
                                          "Client Rejected Proposal",
                                          "Record that the client did not approve this proposal. Please specify the reason why it was rejected.",
                                          true,
                                          "bg-rose-600 hover:bg-rose-700",
                                          "Reason why Rejected",
                                          "Please specify the reason why the client rejected this proposal (e.g., budget exceeded, scope mismatch, chosen competitor)...",
                                        )
                                      }
                                      className="text-xs cursor-pointer gap-2 text-rose-700 font-semibold"
                                    >
                                      <XCircle className="h-3.5 w-3.5 text-rose-600" />{" "}
                                      Mark Rejected
                                    </DropdownMenuItem>
                                  </>
                                )}

                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedHistoryProposalId(p.id);
                                    setActiveHubTab("history");
                                  }}
                                  className="text-xs cursor-pointer gap-2 text-emerald-700 font-semibold"
                                >
                                  <History className="h-3.5 w-3.5 text-emerald-600" />{" "}
                                  View History
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleDuplicate(p)}
                                  className="text-xs cursor-pointer gap-2"
                                >
                                  <Copy className="h-3.5 w-3.5 text-slate-600" />{" "}
                                  Duplicate
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setExtendModalProposal(p)}
                                  className="text-xs cursor-pointer gap-2 text-emerald-800 font-medium"
                                >
                                  <Calendar className="h-3.5 w-3.5 text-emerald-600" />{" "}
                                  Extend Follow-up
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleDownloadPDF(p)}
                                  className="text-xs cursor-pointer gap-2"
                                >
                                  <Download className="h-3.5 w-3.5 text-slate-600" />{" "}
                                  Download PDF
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {hasProposalPermission(
                                  currentRole,
                                  "delete_proposal",
                                ) && (
                                  <>
                                    <DropdownMenuItem
                                      onClick={() => handleArchive(p)}
                                      className="text-xs cursor-pointer gap-2 text-amber-700"
                                    >
                                      <Archive className="h-3.5 w-3.5 text-amber-600" />{" "}
                                      Archive
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => handleDelete(p)}
                                      className="text-xs cursor-pointer gap-2 text-rose-600 focus:text-rose-600"
                                    >
                                      <Trash2 className="h-3.5 w-3.5 text-rose-600" />{" "}
                                      Delete
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {/* TAB 2 CONTENT: Proposal Workflow History View */}
          {activeHubTab === "history" &&
            (() => {
              const currentProposal =
                proposals.find((p) => p.id === selectedHistoryProposalId) ||
                proposals[0];
              const activities = currentProposal?.activities || [];

              return (
                <div className="p-6 space-y-6">
                  {/* Proposal Picker & Header Bar */}
                  <div className="p-5 bg-slate-50/80 rounded-2xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black uppercase text-slate-500 shrink-0">
                          Selected Proposal:
                        </span>

                        {/* Searchable Combobox Popover */}
                        <Popover
                          open={historyComboboxOpen}
                          onOpenChange={setHistoryComboboxOpen}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={historyComboboxOpen}
                              className="h-10 justify-between rounded-xl border border-slate-300 bg-white px-3 font-mono text-xs font-bold text-emerald-800 hover:bg-slate-50 focus:ring-2 focus:ring-emerald-500/20 max-w-xl w-full sm:w-[460px] text-left shadow-xs"
                            >
                              <span className="truncate">
                                {currentProposal ? (
                                  <>
                                    <span className="text-emerald-800 font-black mr-1.5">
                                      {currentProposal.proposalNumber}
                                    </span>
                                    <span className="text-slate-400 mr-1.5">
                                      —
                                    </span>
                                    <span className="text-slate-700 font-medium">
                                      {currentProposal.title ||
                                        currentProposal.projectName ||
                                        "Proposal"}
                                    </span>
                                    <span className="text-slate-400 font-normal ml-1.5">
                                      ({currentProposal.status})
                                    </span>
                                  </>
                                ) : (
                                  "Search & select proposal..."
                                )}
                              </span>
                              <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-slate-400" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            className="w-full sm:w-[460px] p-0 rounded-2xl shadow-xl border-slate-200"
                            align="start"
                          >
                            <Command>
                              <CommandInput
                                placeholder="Search by number, title, project or client..."
                                className="h-9 text-xs"
                              />
                              <CommandList className="max-h-72 overflow-y-auto p-1">
                                <CommandEmpty className="py-6 text-center text-xs text-slate-500">
                                  No matching proposals found.
                                </CommandEmpty>
                                <CommandGroup>
                                  {proposals.map((p) => {
                                    const isSelected =
                                      currentProposal?.id === p.id;
                                    return (
                                      <CommandItem
                                        key={p.id}
                                        value={`${p.proposalNumber} ${p.title} ${p.projectName || ""} ${p.clientName || ""} ${p.status}`}
                                        onSelect={() => {
                                          setSelectedHistoryProposalId(p.id);
                                          setHistoryComboboxOpen(false);
                                        }}
                                        className="cursor-pointer rounded-xl px-3 py-2 text-xs flex items-center justify-between aria-selected:bg-emerald-50 aria-selected:text-emerald-950"
                                      >
                                        <div className="flex flex-col space-y-0.5 max-w-[380px]">
                                          <div className="flex items-center gap-1.5">
                                            <span className="font-mono font-bold text-emerald-800">
                                              {p.proposalNumber}
                                            </span>
                                            <span className="text-slate-400 text-[10px]">
                                              •
                                            </span>
                                            <span className="text-slate-800 font-semibold truncate text-[11px]">
                                              {p.title ||
                                                p.projectName ||
                                                "Proposal"}
                                            </span>
                                          </div>
                                          <div className="text-[10px] text-slate-400 flex items-center gap-2">
                                            <span>
                                              Client:{" "}
                                              <strong className="text-slate-600">
                                                {p.clientName || "N/A"}
                                              </strong>
                                            </span>
                                            <span>•</span>
                                            <span>
                                              Status:{" "}
                                              <strong className="text-slate-600">
                                                {p.status}
                                              </strong>
                                            </span>
                                          </div>
                                        </div>
                                        {isSelected && (
                                          <Check className="h-4 w-4 text-emerald-600 shrink-0 ml-2" />
                                        )}
                                      </CommandItem>
                                    );
                                  })}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                      {currentProposal && (
                        <p className="text-xs text-slate-500 font-medium flex items-center gap-3 flex-wrap">
                          <span>
                            Client:{" "}
                            <strong className="text-slate-800">
                              {currentProposal.clientName || "N/A"}
                            </strong>
                          </span>
                          <span>•</span>
                          <span>
                            Project:{" "}
                            <strong className="text-slate-800">
                              {currentProposal.projectName || "N/A"}
                            </strong>
                          </span>
                          {(currentProposal.dueDate ||
                            currentProposal.due_date) && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5 text-amber-600" />
                                Follow-up Due:{" "}
                                <strong className="text-slate-800 font-mono">
                                  {new Date(
                                    currentProposal.dueDate ||
                                      currentProposal.due_date!,
                                  ).toLocaleDateString("en-GB")}
                                </strong>
                                {(currentProposal.dueDate ||
                                  currentProposal.due_date)! < todayStr &&
                                  ![
                                    "approved",
                                    "accepted",
                                    "rejected",
                                    "archived",
                                  ].includes(currentProposal.status) && (
                                    <span className="text-[10px] font-bold text-rose-600 ml-1">
                                      (Overdue)
                                    </span>
                                  )}
                              </span>
                            </>
                          )}
                        </p>
                      )}
                    </div>

                    {currentProposal && (
                      <div className="flex items-center gap-3 self-start md:self-auto">
                        <Badge
                          className={`text-xs font-bold px-3 py-1 border ${STATUS_CONFIG[currentProposal.status]?.className || "bg-slate-100 text-slate-700"}`}
                        >
                          {STATUS_CONFIG[currentProposal.status]?.label ||
                            currentProposal.status}
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            navigate(
                              `/projects/proposals/${currentProposal.id}/edit`,
                            )
                          }
                          className="rounded-xl text-xs font-bold gap-1.5 h-8 bg-white hover:bg-slate-50 border-slate-200"
                        >
                          <Edit className="h-3.5 w-3.5 text-slate-600" /> Open
                          in Editor
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Workflow History Card matching Reference Image */}
                  <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                          <History className="h-4 w-4" />
                        </div>
                        <div>
                          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                            Proposal Workflow History
                          </h3>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Complete chronological audit trail of all state
                            transitions and review comments.
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className="bg-emerald-50 text-emerald-800 border-emerald-200 font-bold text-xs px-3 py-0.5 rounded-full"
                      >
                        {activities.length} Logged Events
                      </Badge>
                    </div>

                    {activities.length === 0 ? (
                      <div className="py-12 text-center text-slate-400 space-y-2">
                        <History className="h-8 w-8 mx-auto text-slate-300" />
                        <p className="text-xs font-bold text-slate-600">
                          No activity events logged yet
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Events will appear here automatically when this
                          proposal transitions through review stages.
                        </p>
                      </div>
                    ) : (
                      <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                        {activities
                          .slice()
                          .reverse()
                          .map((act) => {
                            const dateObj = new Date(act.timestamp);
                            const formattedTime = !isNaN(dateObj.getTime())
                              ? dateObj.toLocaleDateString("en-GB", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                }) +
                                " " +
                                dateObj.toLocaleTimeString("en-GB", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : act.timestamp;

                            return (
                              <div key={act.id} className="relative group">
                                {/* Dot Icon on Vertical Line */}
                                <div className="absolute -left-6 top-3 h-3 w-3 rounded-full border-2 border-white bg-slate-400 group-hover:bg-emerald-500 shadow-xs transition-colors" />

                                {/* Event Bubble Card */}
                                <div className="rounded-2xl border border-slate-200/80 bg-white p-4 space-y-2 hover:border-slate-300 hover:shadow-xs transition-all">
                                  <div className="flex items-center justify-between flex-wrap gap-2">
                                    <span className="font-mono text-[11px] font-bold text-slate-600">
                                      {formattedTime}
                                    </span>
                                    {act.newStatus && (
                                      <Badge
                                        variant="outline"
                                        className={`text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full ${
                                          act.newStatus === "approved" ||
                                          act.newStatus === "accepted"
                                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                            : act.newStatus === "under_review"
                                              ? "bg-amber-50 text-amber-800 border-amber-200"
                                              : act.newStatus === "sent"
                                                ? "bg-blue-50 text-blue-800 border-blue-200"
                                                : act.newStatus ===
                                                    "changes_requested"
                                                  ? "bg-orange-50 text-orange-800 border-orange-200"
                                                  : act.newStatus === "rejected"
                                                    ? "bg-rose-50 text-rose-800 border-rose-200"
                                                    : "bg-slate-100 text-slate-700 border-slate-200"
                                        }`}
                                      >
                                        {act.newStatus.replace("_", " ")}
                                      </Badge>
                                    )}
                                  </div>

                                  <p className="text-xs font-bold text-slate-900">
                                    {act.action}
                                  </p>

                                  <p className="text-[11px] text-slate-500 flex items-center gap-1">
                                    <User className="h-3 w-3 text-slate-400" />
                                    <span>
                                      Actor:{" "}
                                      <strong className="text-slate-800">
                                        {act.user || act.userName || "User"}
                                      </strong>{" "}
                                      {act.userRole && `(${act.userRole})`}
                                    </span>
                                  </p>

                                  {act.comments && (
                                    <div className="mt-2 p-3 bg-slate-50 rounded-xl border border-slate-200/70 text-xs text-slate-700 flex items-start gap-2">
                                      <MessageSquare className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                                      <span className="italic">
                                        "{act.comments}"
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
        </CardContent>
      </Card>

      {/* Quick Status Update Modal */}
      <Dialog
        open={quickStatusModal.open}
        onOpenChange={(open) => {
          if (!open) setQuickStatusModal((prev) => ({ ...prev, open: false }));
        }}
      >
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader className="space-y-1.5">
            <DialogTitle className="text-base font-black text-slate-900 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-600" />
              {quickStatusModal.targetStatus === "rejected" ? (
                <XCircle className="h-4 w-4 text-rose-600" />
              ) : quickStatusModal.targetStatus === "accepted" ? (
                <CheckCircle className="h-4 w-4 text-emerald-600" />
              ) : (
                <Sparkles className="h-4 w-4 text-emerald-600" />
              )}
              {quickStatusModal.actionLabel}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {quickStatusModal.description}
            </DialogDescription>
          </DialogHeader>

          {quickStatusModal.proposal && (
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1 my-2">
              <p className="text-xs font-bold text-slate-800">
                {quickStatusModal.proposal.proposalNumber} —{" "}
                {quickStatusModal.proposal.title || "Proposal"}
              </p>
              <p className="text-[11px] text-slate-500">
                Client:{" "}
                <strong>{quickStatusModal.proposal.clientName || "N/A"}</strong>{" "}
                • Moving to status:{" "}
                <strong className="text-emerald-700 uppercase">
                  {quickStatusModal.targetStatus.replace("_", " ")}
                </strong>
              </p>
            </div>
          )}

          <div className="space-y-4 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">User / Actor</label>
                <Input
                  value={actorName}
                  onChange={(e) => setActorName(e.target.value)}
                  placeholder="e.g. Arun / Reviewer"
                  className="rounded-xl text-xs h-9"
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Role</label>
                <Input
                  value={actorRole}
                  onChange={(e) => setActorRole(e.target.value)}
                  placeholder="e.g. Lead Engineer / Manager"
                  className="rounded-xl text-xs h-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 flex items-center justify-between">
                <span>
                  {quickStatusModal.commentLabel ||
                    "Comments / Review Feedback"}
                </span>
                {quickStatusModal.requireComment && (
                  <span className="text-[10px] text-rose-500 font-bold">
                    * Required
                  </span>
                )}
              </label>
              <Textarea
                rows={3}
                value={quickStatusComment}
                onChange={(e) => setQuickStatusComment(e.target.value)}
                placeholder={
                  quickStatusModal.commentPlaceholder ||
                  (quickStatusModal.targetStatus === "changes_requested"
                    ? "Specify required modifications, missing deliverables, or commercial corrections..."
                    : "Optional note or approval sign-off remarks...")
                }
                className="text-xs rounded-2xl resize-none"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setQuickStatusModal((prev) => ({ ...prev, open: false }))
              }
              className="rounded-xl text-xs"
              disabled={updatingStatus}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmQuickStatus}
              disabled={
                updatingStatus ||
                (quickStatusModal.requireComment && !quickStatusComment.trim())
              }
              className={`rounded-xl text-xs font-bold text-white shadow-md ${quickStatusModal.btnColor || "bg-emerald-600 hover:bg-emerald-700"}`}
            >
              {updatingStatus
                ? "Updating..."
                : quickStatusModal.targetStatus === "rejected"
                  ? "Confirm Rejection"
                  : quickStatusModal.targetStatus === "accepted"
                    ? "Confirm Acceptance"
                    : "Confirm Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document Quick Preview Popup Modal (Similar to Sales Quotation) */}
      <ProposalPreviewModal
        proposal={previewModalProposal}
        open={Boolean(previewModalProposal)}
        autoDownload={autoDownloadProposal}
        onClose={() => {
          setPreviewModalProposal(null);
          setAutoDownloadProposal(false);
        }}
        onEdit={(p) => navigate(`/projects/proposals/${p.id}/edit`)}
      />

      {/* Extend Follow-up Due Date Modal */}
      <ExtendFollowupModal
        open={Boolean(extendModalProposal)}
        onClose={() => setExtendModalProposal(null)}
        proposal={extendModalProposal}
        onConfirm={handleConfirmExtendFollowup}
      />
    </div>
  );
}
