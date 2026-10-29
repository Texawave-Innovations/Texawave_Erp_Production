// src/modules/projects/mom/pages/MomRegisterPage.tsx

import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { MomRegisterItem, MomStatus, MomDocument } from "../types/mom";
import {
  getMomRegisterList,
  deleteMom,
  getMomById,
  archiveMom,
  restoreMom,
  startWorkingRevision,
} from "../services/momService";
import { hasMomPermission } from "../services/momPermissions";
import { MomPreviewModal } from "../components/MomPreviewModal";
import { MomRevisionHistoryModal } from "../components/MomRevisionHistoryModal";
import { getAllRecords } from "@/services/firebase";
import { Project } from "../../types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ClipboardList,
  Plus,
  Search,
  Layers,
  Edit,
  Eye,
  Trash2,
  Clock,
  CheckCircle2,
  RotateCcw,
  AlertCircle,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Download,
  Archive,
  History,
  GitBranch,
} from "lucide-react";
import { toast } from "sonner";

const STATUS_CONFIG: Record<MomStatus, { label: string; className: string }> = {
  draft: {
    label: "Draft",
    className: "bg-slate-100 text-slate-700 border-slate-300",
  },
  finalized: {
    label: "Finalized",
    className: "bg-emerald-100 text-emerald-800 border-emerald-300",
  },
  archived: {
    label: "Archived",
    className: "bg-gray-100 text-gray-500 border-gray-300",
  },
};

export const MomRegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [items, setItems] = useState<MomRegisterItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Preview Modal State
  const [previewDoc, setPreviewDoc] = useState<MomDocument | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewAutoDownload, setPreviewAutoDownload] = useState(false);

  // History & Revisions Modal State
  const [historyDoc, setHistoryDoc] = useState<MomDocument | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const handleOpenPreview = async (
    id: string,
    autoDownload: boolean = false,
  ) => {
    try {
      const fullDoc = await getMomById(id, user);
      if (fullDoc) {
        setPreviewDoc(fullDoc);
        setPreviewAutoDownload(autoDownload);
        setPreviewOpen(true);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to load preview");
    }
  };

  const handleOpenHistory = async (id: string) => {
    try {
      const fullDoc = await getMomById(id, user);
      if (fullDoc) {
        setHistoryDoc(fullDoc);
        setHistoryOpen(true);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to load history");
    }
  };

  const handleArchiveItem = async (id: string, reference: string) => {
    if (
      !confirm(`Are you sure you want to archive meeting record ${reference}?`)
    )
      return;
    try {
      await archiveMom(id, user);
      toast.success(`Archived ${reference}`);
      loadData();
    } catch (err: any) {
      toast.error(err?.message || "Failed to archive meeting record");
    }
  };

  const handleRestoreItem = async (id: string, reference: string) => {
    try {
      await restoreMom(id, user);
      toast.success(`Restored ${reference}`);
      loadData();
    } catch (err: any) {
      toast.error(err?.message || "Failed to restore meeting record");
    }
  };

  // Revision Modal State
  const [revisionTargetMom, setRevisionTargetMom] =
    useState<MomRegisterItem | null>(null);
  const [revisionReasonText, setRevisionReasonText] = useState("");
  const [creatingRevision, setCreatingRevision] = useState(false);

  const handleStartMomRevision = async () => {
    if (!revisionTargetMom) return;
    if (!revisionReasonText.trim()) {
      toast.error("Please specify a reason for creating a new revision.");
      return;
    }

    setCreatingRevision(true);
    try {
      const updated = await startWorkingRevision(
        revisionTargetMom.id,
        user,
        revisionReasonText.trim(),
      );
      toast.success(
        `Revision ${updated.workingRevision} initialized for ${revisionTargetMom.reference}`,
      );
      const targetId = revisionTargetMom.id;
      setRevisionTargetMom(null);
      setRevisionReasonText("");
      navigate(`/projects/mom/${targetId}/edit`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to create revision");
    } finally {
      setCreatingRevision(false);
    }
  };

  // Filters state
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Sorting & Pagination
  const [sortField, setSortField] = useState<
    "meetingDate" | "reference" | "meetingTitle" | "updatedAt"
  >("meetingDate");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [momsData, projectsData] = await Promise.all([
        getMomRegisterList(user),
        getAllRecords("projects"),
      ]);
      setItems(momsData);
      setProjects(projectsData || []);
    } catch (err: any) {
      console.error("Error loading MoM register:", err);
      setError(err?.message || "Failed to load Minutes of Meeting register");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // Filtering
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Search
      const searchLower = search.trim().toLowerCase();
      const matchSearch =
        !searchLower ||
        item.reference.toLowerCase().includes(searchLower) ||
        item.meetingTitle.toLowerCase().includes(searchLower) ||
        item.projectName.toLowerCase().includes(searchLower) ||
        item.projectCode.toLowerCase().includes(searchLower);

      // Project filter
      const matchProject =
        projectFilter === "all" || item.projectId === projectFilter;

      // Status filter
      const matchStatus =
        statusFilter === "all" || item.status === statusFilter;

      // Date range filter
      let matchDate = true;
      if (startDate && item.meetingDate) {
        matchDate = matchDate && item.meetingDate >= startDate;
      }
      if (endDate && item.meetingDate) {
        matchDate = matchDate && item.meetingDate <= endDate;
      }

      return matchSearch && matchProject && matchStatus && matchDate;
    });
  }, [items, search, projectFilter, statusFilter, startDate, endDate]);

  // Sorting
  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      let valA = a[sortField] || "";
      let valB = b[sortField] || "";
      const comp = valA.localeCompare(valB);
      return sortOrder === "asc" ? comp : -comp;
    });
  }, [filteredItems, sortField, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(sortedItems.length / pageSize) || 1;
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedItems.slice(start, start + pageSize);
  }, [sortedItems, currentPage, pageSize]);

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const handleDelete = async (id: string, refNum: string) => {
    if (!confirm(`Are you sure you want to delete meeting record ${refNum}?`))
      return;
    try {
      await deleteMom(id, user);
      toast.success(`Deleted ${refNum}`);
      loadData();
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete meeting record");
    }
  };

  // Metrics
  const totalMeetings = items.length;
  const draftMeetings = items.filter((i) => i.status === "draft").length;
  const finalizedMeetings = items.filter(
    (i) => i.status === "finalized",
  ).length;

  return (
    <div className="space-y-6">
      {/* 1. Official Green Accent Header Banner */}
      <div
        style={{
          background:
            "linear-gradient(135deg, #4D9F4B 0%, #72B84A 50%, #9FCA48 100%)",
        }}
        className="text-white rounded-3xl p-8 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden"
      >
        <div className="space-y-1.5 z-10">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-black px-2.5 py-0.5 bg-white/20 backdrop-blur-md rounded-xl text-emerald-100 border border-white/20">
              CROSS-PROJECT REGISTER
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            Minutes of Meeting (MoM)
          </h1>
          <p className="text-emerald-100/90 text-xs sm:text-sm max-w-xl">
            Centralized register of official project meeting minutes, recorded
            deliberations, decisions, and manual action items.
          </p>
        </div>

        <div className="flex items-center gap-3 z-10 shrink-0">
          <Button
            onClick={() => navigate("/projects/mom/templates")}
            className="bg-emerald-800/80 hover:bg-emerald-800 text-white font-bold rounded-2xl text-xs border border-white/20 px-4 py-2"
          >
            <Layers className="h-4 w-4 mr-1.5 text-emerald-200" /> Manage
            Templates
          </Button>
          <Button
            onClick={() => navigate("/projects/mom/create")}
            className="bg-white text-emerald-900 hover:bg-emerald-50 font-bold rounded-2xl text-xs shadow-md px-4 py-2"
          >
            <Plus className="h-4 w-4 mr-1.5 text-emerald-700" /> Create MoM
          </Button>
        </div>
      </div>

      {/* 2. Stat Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="rounded-2xl border-border bg-card shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase">
                Total Meetings
              </p>
              <p className="text-2xl font-black text-foreground mt-0.5">
                {totalMeetings}
              </p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <ClipboardList className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border bg-card shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase">
                Finalized Records
              </p>
              <p className="text-2xl font-black text-emerald-700 mt-0.5">
                {finalizedMeetings}
              </p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border bg-card shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase">
                Active Drafts
              </p>
              <p className="text-2xl font-black text-amber-700 mt-0.5">
                {draftMeetings}
              </p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. Search & Multi-Filters Toolbar */}
      <Card className="rounded-2xl border-border bg-card shadow-xs">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            {/* Search Input */}
            <div className="relative md:col-span-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search reference, meeting title, project..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9 text-xs h-9 rounded-xl"
              />
            </div>

            {/* Project Filter */}
            <div className="md:col-span-3">
              <Select
                value={projectFilter}
                onValueChange={(val) => {
                  setProjectFilter(val);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="text-xs h-9 rounded-xl">
                  <SelectValue placeholder="All Projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.projectCode ? `[${p.projectCode}] ` : ""}
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status Filter */}
            <div className="md:col-span-2">
              <Select
                value={statusFilter}
                onValueChange={(val) => {
                  setStatusFilter(val);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="text-xs h-9 rounded-xl">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="finalized">Finalized</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date Range Filters */}
            <div className="md:col-span-3 flex items-center gap-1.5">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="text-xs h-9 rounded-xl"
                title="Meeting Date From"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="text-xs h-9 rounded-xl"
                title="Meeting Date To"
              />
            </div>
          </div>

          {(search ||
            projectFilter !== "all" ||
            statusFilter !== "all" ||
            startDate ||
            endDate) && (
            <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
              <span>
                Showing {filteredItems.length} of {items.length} matching
                meetings
              </span>
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setProjectFilter("all");
                  setStatusFilter("all");
                  setStartDate("");
                  setEndDate("");
                  setCurrentPage(1);
                }}
                className="text-primary font-bold hover:underline cursor-pointer"
              >
                Clear all filters
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. MoM Register Table */}
      <Card className="rounded-2xl border-border bg-card shadow-xs overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="py-20 text-center space-y-3">
              <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
              <p className="text-xs font-bold text-muted-foreground">
                Loading meeting records...
              </p>
            </div>
          ) : error ? (
            <div className="py-16 text-center space-y-3 px-4">
              <AlertCircle className="h-8 w-8 text-rose-500 mx-auto" />
              <p className="text-sm font-bold text-foreground">{error}</p>
              <Button
                size="sm"
                variant="outline"
                onClick={loadData}
                className="rounded-xl text-xs font-bold"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Retry
              </Button>
            </div>
          ) : paginatedItems.length === 0 ? (
            <div className="py-16 text-center space-y-3 px-4">
              <ClipboardList className="h-10 w-10 text-muted-foreground/40 mx-auto" />
              <h3 className="text-sm font-bold text-foreground">
                {items.length === 0
                  ? "No Meeting Minutes Recorded Yet"
                  : "No Matching Meetings Found"}
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {items.length === 0
                  ? "Start by creating an official minutes of meeting document for your project."
                  : "Try modifying your search keywords or clearing active filters to view records."}
              </p>
              {items.length === 0 ? (
                <Button
                  onClick={() => navigate("/projects/mom/create")}
                  style={{
                    background:
                      "linear-gradient(135deg, #4D9F4B 0%, #72B84A 50%, #9FCA48 100%)",
                  }}
                  className="text-white font-bold rounded-xl text-xs shadow-xs"
                >
                  <Plus className="h-4 w-4 mr-1" /> Create First MoM
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setProjectFilter("all");
                    setStatusFilter("all");
                    setStartDate("");
                    setEndDate("");
                  }}
                  className="rounded-xl text-xs font-bold"
                >
                  Reset Filters
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow className="border-b border-border text-xs uppercase font-extrabold text-muted-foreground">
                    <TableHead
                      className="cursor-pointer hover:text-foreground"
                      onClick={() => toggleSort("reference")}
                    >
                      <div className="flex items-center gap-1">
                        MoM Reference <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:text-foreground"
                      onClick={() => toggleSort("meetingTitle")}
                    >
                      <div className="flex items-center gap-1">
                        Meeting Title <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead
                      className="cursor-pointer hover:text-foreground text-center"
                      onClick={() => toggleSort("meetingDate")}
                    >
                      <div className="flex items-center justify-center gap-1">
                        Meeting Date <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Revision</TableHead>
                    <TableHead
                      className="cursor-pointer hover:text-foreground text-center"
                      onClick={() => toggleSort("updatedAt")}
                    >
                      <div className="flex items-center justify-center gap-1">
                        Last Updated <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </TableHead>
                    <TableHead className="text-center w-28">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedItems.map((item) => {
                    const st =
                      STATUS_CONFIG[item.status] || STATUS_CONFIG.draft;
                    return (
                      <TableRow
                        key={item.id}
                        className="border-b border-border hover:bg-muted/30 transition-colors text-xs"
                      >
                        {/* Reference */}
                        <TableCell className="py-3 font-mono font-bold text-primary">
                          <span
                            onClick={() => navigate(`/projects/mom/${item.id}`)}
                            className="cursor-pointer hover:underline"
                          >
                            {item.reference}
                          </span>
                        </TableCell>

                        {/* Title */}
                        <TableCell className="py-3">
                          <div className="space-y-0.5 max-w-xs sm:max-w-md">
                            <p
                              onClick={() =>
                                navigate(`/projects/mom/${item.id}`)
                              }
                              className="font-bold text-foreground truncate cursor-pointer hover:text-primary transition-colors"
                            >
                              {item.meetingTitle}
                            </p>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {item.attendeesCount} Attendee
                              {item.attendeesCount !== 1 ? "s" : ""}{" "}
                              {item.clientName ? `• ${item.clientName}` : ""}
                            </p>
                          </div>
                        </TableCell>

                        {/* Project */}
                        <TableCell className="py-3">
                          <div className="space-y-0.5">
                            <span className="font-mono text-[10px] font-black text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                              {item.projectCode || "PRJ"}
                            </span>
                            <p className="font-bold text-foreground text-xs truncate max-w-[180px]">
                              {item.projectName}
                            </p>
                          </div>
                        </TableCell>

                        {/* Meeting Date */}
                        <TableCell className="py-3 text-center text-muted-foreground font-semibold">
                          <p className="font-bold text-foreground">
                            {item.meetingDate || "—"}
                          </p>
                          {item.startTime && item.endTime && (
                            <p className="text-[10px] text-muted-foreground">
                              {item.startTime} - {item.endTime}
                            </p>
                          )}
                        </TableCell>

                        {/* Status */}
                        <TableCell className="py-3 text-center">
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-bold px-2 py-0.5 border ${st.className}`}
                          >
                            {st.label}
                          </Badge>
                        </TableCell>

                        {/* Revision */}
                        <TableCell className="py-3 text-center font-mono font-bold text-muted-foreground">
                          Rev {item.currentRevision}
                        </TableCell>

                        {/* Last Updated */}
                        <TableCell className="py-3 text-center text-muted-foreground">
                          <p className="text-[11px] font-medium">
                            {item.updatedAt
                              ? new Date(item.updatedAt).toLocaleDateString(
                                  "en-GB",
                                )
                              : "—"}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate max-w-[120px] mx-auto">
                            {item.updatedByName}
                          </p>
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="py-3 text-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 rounded-xl hover:bg-slate-100"
                              >
                                <MoreHorizontal className="h-4 w-4 text-slate-600" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="w-52 rounded-xl shadow-lg border-slate-100"
                            >
                              <DropdownMenuLabel className="text-[10px] font-bold uppercase text-slate-400">
                                Actions
                              </DropdownMenuLabel>
                              <DropdownMenuItem
                                onClick={() => handleOpenPreview(item.id, true)}
                                className="text-xs cursor-pointer gap-2"
                              >
                                <Download className="h-3.5 w-3.5 text-slate-600" />{" "}
                                Download PDF
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  navigate(`/projects/mom/${item.id}/edit`)
                                }
                                className="text-xs cursor-pointer gap-2"
                              >
                                <Edit className="h-3.5 w-3.5 text-slate-600" />{" "}
                                Edit Document
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  handleOpenPreview(item.id, false)
                                }
                                className="text-xs cursor-pointer gap-2 font-semibold text-slate-800"
                              >
                                <Eye className="h-3.5 w-3.5 text-emerald-600" />{" "}
                                Preview Document
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleOpenHistory(item.id)}
                                className="text-xs cursor-pointer gap-2 text-emerald-700 font-semibold"
                              >
                                <History className="h-3.5 w-3.5 text-emerald-600" />{" "}
                                View History & Revisions
                              </DropdownMenuItem>
                              {item.status === "finalized" && (
                                <DropdownMenuItem
                                  onClick={() => {
                                    setRevisionTargetMom(item);
                                    setRevisionReasonText("");
                                  }}
                                  className="text-xs cursor-pointer gap-2 text-primary font-bold bg-primary/5 hover:bg-primary/10"
                                >
                                  <GitBranch className="h-3.5 w-3.5 text-primary" />{" "}
                                  Create Revision
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              {item.status !== "archived" &&
                                hasMomPermission(user, "archive") && (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleArchiveItem(item.id, item.reference)
                                    }
                                    className="text-xs cursor-pointer gap-2 text-amber-700"
                                  >
                                    <Archive className="h-3.5 w-3.5 text-amber-600" />{" "}
                                    Archive MoM
                                  </DropdownMenuItem>
                                )}
                              {item.status === "archived" &&
                                hasMomPermission(user, "restore") && (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleRestoreItem(item.id, item.reference)
                                    }
                                    className="text-xs cursor-pointer gap-2 text-teal-700 font-semibold"
                                  >
                                    <RotateCcw className="h-3.5 w-3.5 text-teal-600" />{" "}
                                    Restore MoM
                                  </DropdownMenuItem>
                                )}
                              <DropdownMenuItem
                                onClick={() =>
                                  handleDelete(item.id, item.reference)
                                }
                                className="text-xs cursor-pointer gap-2 text-rose-600 focus:text-rose-600"
                              >
                                <Trash2 className="h-3.5 w-3.5 text-rose-600" />{" "}
                                Delete MoM
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination Controls */}
          {sortedItems.length > pageSize && (
            <div className="p-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Showing {(currentPage - 1) * pageSize + 1} to{" "}
                {Math.min(currentPage * pageSize, sortedItems.length)} of{" "}
                {sortedItems.length} records
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="h-8 w-8 p-0 rounded-lg"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="px-2 font-bold text-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={currentPage === totalPages}
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  className="h-8 w-8 p-0 rounded-lg"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview Modal */}
      <MomPreviewModal
        document={previewDoc}
        open={previewOpen}
        autoDownload={previewAutoDownload}
        onClose={() => {
          setPreviewOpen(false);
          setPreviewAutoDownload(false);
        }}
      />

      {/* Revision History & Audit Trail Modal */}
      <MomRevisionHistoryModal
        document={historyDoc}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
      />

      {/* Create MoM Revision Dialog */}
      <Dialog
        open={Boolean(revisionTargetMom)}
        onOpenChange={(o) => !o && setRevisionTargetMom(null)}
      >
        <DialogContent className="max-w-md p-6 rounded-3xl">
          <DialogHeader className="space-y-1 pb-2 border-b border-border">
            <DialogTitle className="text-base font-black text-foreground flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-emerald-600" />
              Create Document Revision
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Document <strong>{revisionTargetMom?.reference}</strong> is
              finalized. Creating a revision initializes{" "}
              <strong>
                Rev {(revisionTargetMom?.currentRevision || 1) + 1}
              </strong>{" "}
              as a working draft while preserving official Rev{" "}
              {revisionTargetMom?.currentRevision || 1}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">
                Reason for Revision <span className="text-rose-500">*</span>
              </Label>
              <Input
                value={revisionReasonText}
                onChange={(e) => setRevisionReasonText(e.target.value)}
                placeholder="e.g. Corrected action items, deliverable dates, or client notes"
                className="text-xs"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && revisionReasonText.trim()) {
                    handleStartMomRevision();
                  }
                }}
              />
              <p className="text-[11px] text-muted-foreground">
                This reason is recorded in the permanent audit trail.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRevisionTargetMom(null)}
              className="rounded-xl text-xs font-bold"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={creatingRevision || !revisionReasonText.trim()}
              onClick={handleStartMomRevision}
              style={{
                background:
                  "linear-gradient(135deg, #4D9F4B 0%, #72B84A 50%, #9FCA48 100%)",
              }}
              className="rounded-xl text-xs font-bold text-white shadow-xs"
            >
              <GitBranch className="h-3.5 w-3.5 mr-1" />
              {creatingRevision
                ? "Creating..."
                : `Start Rev ${(revisionTargetMom?.currentRevision || 1) + 1}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
