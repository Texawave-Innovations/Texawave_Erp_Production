import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ref, onValue, remove, update, push, set } from "firebase/database";
import { database } from "@/services/firebase";
import {
  ProposalTemplate,
  TemplateStatus,
  OFFICIAL_TEXAWAVE_PROPOSAL_TEMPLATE,
} from "../proposalTypes";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Layers,
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Eye,
  Copy,
  Archive,
  Trash2,
  ArrowLeft,
  GitBranch,
  Sparkles,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import CreateTemplateModal from "./CreateTemplateModal";

const STATUS_CONFIG: Record<
  TemplateStatus,
  { label: string; className: string }
> = {
  active: {
    label: "Active",
    className: "bg-emerald-100 text-emerald-800 border-emerald-300",
  },
  draft: {
    label: "Draft",
    className: "bg-slate-100 text-slate-700 border-slate-300",
  },
  archived: {
    label: "Archived",
    className: "bg-gray-100 text-gray-500 border-gray-300",
  },
};

export default function ProposalTemplates() {
  const navigate = useNavigate();

  const [templates, setTemplates] = useState<ProposalTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [createModalOpen, setCreateModalOpen] = useState(false);

  useEffect(() => {
    const unsub = onValue(ref(database, "proposal_templates"), async (snap) => {
      if (!snap.exists()) {
        // Automatically seed official TexaWave Proposal Template record into Firebase
        try {
          await set(
            ref(
              database,
              `proposal_templates/${OFFICIAL_TEXAWAVE_PROPOSAL_TEMPLATE.id}`,
            ),
            OFFICIAL_TEXAWAVE_PROPOSAL_TEMPLATE,
          );
          setTemplates([OFFICIAL_TEXAWAVE_PROPOSAL_TEMPLATE]);
        } catch {
          setTemplates([OFFICIAL_TEXAWAVE_PROPOSAL_TEMPLATE]);
        }
        setLoading(false);
        return;
      }
      const data = snap.val();
      const list: ProposalTemplate[] = Object.entries(data).map(
        ([id, item]: [string, any]) => ({
          id,
          ...item,
          name: item.name || item.title || "Untitled Template",
          code: item.code || `TMPL-${id.slice(-4).toUpperCase()}`,
          status: item.status || "active",
          sections: Array.isArray(item.sections) ? item.sections : [],
        }),
      );

      // Ensure the official template exists in the list or seed it
      if (
        !list.some(
          (t) =>
            t.id === OFFICIAL_TEXAWAVE_PROPOSAL_TEMPLATE.id ||
            t.code === OFFICIAL_TEXAWAVE_PROPOSAL_TEMPLATE.code,
        )
      ) {
        set(
          ref(
            database,
            `proposal_templates/${OFFICIAL_TEXAWAVE_PROPOSAL_TEMPLATE.id}`,
          ),
          OFFICIAL_TEXAWAVE_PROPOSAL_TEMPLATE,
        );
        list.unshift(OFFICIAL_TEXAWAVE_PROPOSAL_TEMPLATE);
      }

      list.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
      setTemplates(list);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      const matchSearch =
        !search.trim() ||
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.code.toLowerCase().includes(search.toLowerCase()) ||
        (t.department &&
          t.department.toLowerCase().includes(search.toLowerCase())) ||
        (t.description &&
          t.description.toLowerCase().includes(search.toLowerCase()));

      const matchStatus = statusFilter === "all" || t.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [templates, search, statusFilter]);

  const handleDuplicate = async (t: ProposalTemplate) => {
    try {
      const newRef = push(ref(database, "proposal_templates"));
      const now = new Date().toISOString();
      const cloned: ProposalTemplate = {
        ...t,
        id: newRef.key!,
        name: `${t.name} (Copy)`,
        code: `${t.code}-COPY`,
        status: "draft",
        createdAt: now,
        updatedAt: now,
      };
      await set(newRef, cloned);
      toast.success(`Template duplicated: ${cloned.name}`);
    } catch {
      toast.error("Failed to duplicate template");
    }
  };

  const handleCreateNewVersion = async (t: ProposalTemplate) => {
    try {
      const currentVerNum =
        t.version_number ||
        parseInt(t.version?.replace(/[^0-9]/g, "") || "1") ||
        1;
      const nextVerNum = currentVerNum + 1;
      const nextVer = `V${nextVerNum}`;

      const newRef = push(ref(database, "proposal_templates"));
      const now = new Date().toISOString();
      const newVersionTemplate: ProposalTemplate = {
        ...t,
        id: newRef.key!,
        name: t.name,
        code: t.code,
        version: nextVer,
        version_number: nextVerNum,
        parent_version_id: t.id,
        status: "draft",
        createdAt: now,
        updatedAt: now,
      };
      await set(newRef, newVersionTemplate);
      toast.success(
        `Created new version ${nextVer} in Draft status for ${t.name}!`,
      );
      navigate(`/projects/proposals/templates/${newRef.key}/builder`);
    } catch {
      toast.error("Failed to create new version");
    }
  };

  const handleArchive = async (t: ProposalTemplate) => {
    try {
      await update(ref(database, `proposal_templates/${t.id}`), {
        status: "archived",
        updatedAt: new Date().toISOString(),
      });
      toast.success(`Template ${t.name} archived`);
    } catch {
      toast.error("Failed to archive template");
    }
  };

  const handleDelete = async (t: ProposalTemplate) => {
    if (!confirm(`Delete template "${t.name}"? This cannot be undone.`)) return;
    try {
      await remove(ref(database, `proposal_templates/${t.id}`));
      toast.success("Template deleted");
    } catch {
      toast.error("Failed to delete template");
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div
        style={{
          background:
            "linear-gradient(135deg, #4D9F4B 0%, #72B84A 50%, #9FCA48 100%)",
        }}
        className="text-white rounded-3xl p-8 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-6"
      >
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => navigate("/projects/proposals")}
              className="h-8 w-8 bg-white/20 hover:bg-white/30 text-white rounded-xl"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <span className="p-2 bg-white/10 backdrop-blur-md rounded-2xl text-emerald-200 border border-white/15">
              <Layers className="h-5 w-5" />
            </span>
            <h1 className="text-2xl font-black tracking-tight">
              Proposal Templates
            </h1>
          </div>
          <p className="text-emerald-100/90 text-xs sm:text-sm pl-1">
            Create reusable proposal structures without changing application
            source code.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Button
            onClick={() => setCreateModalOpen(true)}
            className="bg-white text-emerald-900 hover:bg-emerald-50 font-bold rounded-2xl shadow-md px-5 py-2.5 h-auto transition-all duration-200 hover:scale-[1.02] text-xs"
          >
            <Plus className="h-4 w-4 mr-1.5 text-emerald-700" /> Create Template
          </Button>
        </div>
      </div>

      {/* 2. Templates Card & Table */}
      <Card className="border border-slate-200/80 shadow-md rounded-3xl bg-white overflow-hidden">
        <CardHeader className="p-6 bg-slate-50/40 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Layers className="h-5 w-5 text-emerald-600" /> Reusable
                Proposal Templates
              </CardTitle>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Showing {filteredTemplates.length} of {templates.length} total
                templates
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search templates..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 bg-white rounded-xl text-xs h-9 border-slate-200"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/75 hover:bg-slate-50/75 border-b border-slate-100">
                  <TableHead className="font-extrabold text-[11px] text-slate-600 uppercase tracking-wider py-3.5 pl-6">
                    Template Name
                  </TableHead>
                  <TableHead className="font-extrabold text-[11px] text-slate-600 uppercase tracking-wider py-3.5">
                    Template Code
                  </TableHead>
                  <TableHead className="font-extrabold text-[11px] text-slate-600 uppercase tracking-wider py-3.5 text-center">
                    Version
                  </TableHead>
                  <TableHead className="font-extrabold text-[11px] text-slate-600 uppercase tracking-wider py-3.5 text-center">
                    No. of Sections
                  </TableHead>
                  <TableHead className="font-extrabold text-[11px] text-slate-600 uppercase tracking-wider py-3.5">
                    Department / Category
                  </TableHead>
                  <TableHead className="font-extrabold text-[11px] text-slate-600 uppercase tracking-wider py-3.5">
                    Created By
                  </TableHead>
                  <TableHead className="font-extrabold text-[11px] text-slate-600 uppercase tracking-wider py-3.5">
                    Last Updated
                  </TableHead>
                  <TableHead className="font-extrabold text-[11px] text-slate-600 uppercase tracking-wider py-3.5 text-center">
                    Status
                  </TableHead>
                  <TableHead className="font-extrabold text-[11px] text-slate-600 uppercase tracking-wider py-3.5 text-right pr-6">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="text-center py-12 text-slate-400 text-xs"
                    >
                      Loading templates...
                    </TableCell>
                  </TableRow>
                ) : filteredTemplates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-14">
                      <div className="flex flex-col items-center justify-center space-y-2.5">
                        <div className="h-12 w-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                          <Layers className="h-6 w-6" />
                        </div>
                        <p className="text-sm font-bold text-slate-700">
                          No templates found
                        </p>
                        <p className="text-xs text-slate-400 max-w-sm">
                          Create your first proposal template to enable dynamic
                          section configuration.
                        </p>
                        <Button
                          onClick={() => setCreateModalOpen(true)}
                          style={{
                            background:
                              "linear-gradient(135deg, #4D9F4B 0%, #72B84A 50%, #9FCA48 100%)",
                          }}
                          className="text-white font-bold rounded-2xl text-xs mt-2"
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" /> Create Template
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTemplates.map((t) => {
                    const statusCfg =
                      STATUS_CONFIG[t.status] || STATUS_CONFIG.active;
                    const dateFormatted = t.updatedAt
                      ? new Date(t.updatedAt).toLocaleDateString("en-GB")
                      : t.createdAt
                        ? new Date(t.createdAt).toLocaleDateString("en-GB")
                        : "-";

                    return (
                      <TableRow
                        key={t.id}
                        className="hover:bg-slate-50/60 transition-colors border-b border-slate-100/80"
                      >
                        <TableCell className="pl-6 py-3.5 font-bold text-xs text-slate-900">
                          <div className="flex items-center gap-2">
                            <span
                              className="cursor-pointer hover:text-emerald-700 hover:underline"
                              onClick={() =>
                                navigate(
                                  `/projects/proposals/templates/${t.id}/builder`,
                                )
                              }
                            >
                              {t.name}
                            </span>
                          </div>
                          {t.description && (
                            <div className="text-[11px] text-slate-400 font-normal truncate max-w-xs">
                              {t.description}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="py-3.5 font-mono text-xs font-semibold text-emerald-800">
                          {t.code}
                        </TableCell>
                        <TableCell className="py-3.5 text-center">
                          <Badge
                            variant="outline"
                            className="text-[10px] font-bold bg-slate-50 border-slate-200"
                          >
                            {t.version}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-3.5 text-center font-bold text-xs text-slate-700">
                          {t.sections?.length || 0}
                        </TableCell>
                        <TableCell className="py-3.5 text-xs text-slate-600 font-medium">
                          {t.department || t.category || "General"}
                        </TableCell>
                        <TableCell className="py-3.5 text-xs text-slate-600">
                          {t.createdByName || t.createdBy || "Admin"}
                        </TableCell>
                        <TableCell className="py-3.5 text-xs text-slate-500 font-medium">
                          {dateFormatted}
                        </TableCell>
                        <TableCell className="py-3.5 text-center">
                          <Badge
                            className={`text-[10px] font-bold px-2.5 py-0.5 border ${statusCfg.className}`}
                          >
                            {statusCfg.label}
                          </Badge>
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
                                Template Actions
                              </DropdownMenuLabel>
                              <DropdownMenuItem
                                onClick={() =>
                                  navigate(
                                    `/projects/proposals/templates/${t.id}/builder`,
                                  )
                                }
                                className="text-xs cursor-pointer gap-2"
                              >
                                <Edit className="h-3.5 w-3.5 text-slate-600" />{" "}
                                Edit Template
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDuplicate(t)}
                                className="text-xs cursor-pointer gap-2"
                              >
                                <Copy className="h-3.5 w-3.5 text-slate-600" />{" "}
                                Duplicate
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleCreateNewVersion(t)}
                                className="text-xs cursor-pointer gap-2 text-indigo-600"
                              >
                                <GitBranch className="h-3.5 w-3.5 text-indigo-600" />{" "}
                                Create New Version
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  navigate(
                                    `/projects/proposals/templates/${t.id}/builder?preview=true`,
                                  )
                                }
                                className="text-xs cursor-pointer gap-2"
                              >
                                <Eye className="h-3.5 w-3.5 text-slate-600" />{" "}
                                Preview
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleArchive(t)}
                                className="text-xs cursor-pointer gap-2 text-amber-700"
                              >
                                <Archive className="h-3.5 w-3.5 text-amber-600" />{" "}
                                Archive
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDelete(t)}
                                className="text-xs cursor-pointer gap-2 text-rose-600 focus:text-rose-600"
                              >
                                <Trash2 className="h-3.5 w-3.5 text-rose-600" />{" "}
                                Delete
                              </DropdownMenuItem>
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
        </CardContent>
      </Card>

      {/* Create Template Modal */}
      <CreateTemplateModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
      />
    </div>
  );
}
