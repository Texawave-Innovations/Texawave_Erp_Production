// src/modules/projects/mom/pages/MomTemplatesPage.tsx

import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { MomTemplate } from "../types/mom";
import {
  getMomTemplates,
  duplicateMomTemplate,
  createNewTemplateVersion,
  archiveMomTemplate,
  deleteMomTemplate,
  publishMomTemplate,
} from "../services/momTemplateService";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Plus,
  Search,
  Layers,
  Edit,
  Eye,
  Copy,
  Archive,
  Trash2,
  GitBranch,
  CheckCircle2,
  Lock,
  MoreHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { CreateMomTemplateModal } from "../components/CreateMomTemplateModal";

const STATUS_CONFIG = {
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

export const MomTemplatesPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [templates, setTemplates] = useState<MomTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await getMomTemplates();
      setTemplates(data);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load templates");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      const matchSearch =
        !search.trim() ||
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.code.toLowerCase().includes(search.toLowerCase()) ||
        (t.category &&
          t.category.toLowerCase().includes(search.toLowerCase())) ||
        (t.description &&
          t.description.toLowerCase().includes(search.toLowerCase()));

      const matchStatus = statusFilter === "all" || t.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [templates, search, statusFilter]);

  const handleDuplicate = async (t: MomTemplate) => {
    try {
      const cloned = await duplicateMomTemplate(t, user);
      toast.success(`Duplicated "${cloned.name}" as draft`);
      loadTemplates();
    } catch (err: any) {
      toast.error(err?.message || "Failed to duplicate template");
    }
  };

  const handleCreateNewVersion = async (t: MomTemplate) => {
    try {
      const newVer = await createNewTemplateVersion(t, user);
      toast.success(`Created draft version ${newVer.version} for "${t.name}"!`);
      navigate(`/projects/mom/templates/${newVer.id}/builder`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to create new version");
    }
  };

  const handlePublish = async (id: string, name: string) => {
    try {
      await publishMomTemplate(id);
      toast.success(`Template "${name}" is now published and active.`);
      loadTemplates();
    } catch (err: any) {
      toast.error(err?.message || "Failed to publish template");
    }
  };

  const handleArchive = async (id: string, name: string) => {
    try {
      await archiveMomTemplate(id);
      toast.success(`Template "${name}" archived`);
      loadTemplates();
    } catch (err: any) {
      toast.error(err?.message || "Failed to archive template");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete draft template "${name}"?`)) return;
    try {
      await deleteMomTemplate(id);
      toast.success("Template deleted");
      loadTemplates();
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete template");
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Official Green Accent Header */}
      <div
        style={{
          background:
            "linear-gradient(135deg, #4D9F4B 0%, #72B84A 50%, #9FCA48 100%)",
        }}
        className="text-white rounded-3xl p-8 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden"
      >
        <div className="space-y-1.5 z-10">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => navigate("/projects/mom")}
              className="h-7 w-7 bg-white/20 hover:bg-white/30 text-white rounded-lg"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <span className="font-mono text-xs font-black px-2.5 py-0.5 bg-white/20 backdrop-blur-md rounded-xl text-emerald-100 border border-white/20">
              REUSABLE TEMPLATES REPOSITORY
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            Meeting Minutes Templates
          </h1>
          <p className="text-emerald-100/90 text-xs sm:text-sm max-w-xl">
            Configure, version, and standardize structured Minutes of Meeting
            schemas for engineering and operations reviews.
          </p>
        </div>

        <div className="flex items-center gap-3 z-10 shrink-0">
          <Button
            onClick={() => setCreateModalOpen(true)}
            className="bg-white text-emerald-900 hover:bg-emerald-50 font-bold rounded-2xl text-xs shadow-md px-4 py-2"
          >
            <Plus className="h-4 w-4 mr-1.5 text-emerald-700" /> Create Template
          </Button>
        </div>
      </div>

      {/* 2. Filters & Search Bar */}
      <Card className="rounded-2xl border-border bg-card shadow-xs">
        <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative flex-1 w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by template name, code, category..."
              className="pl-9 text-xs h-9 rounded-xl"
            />
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto w-full sm:w-auto">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="text-xs h-9 rounded-xl w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active (Published)</SelectItem>
                <SelectItem value="draft">Drafts</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* 3. Templates Table */}
      <Card className="rounded-2xl border-border bg-card shadow-xs overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="py-20 text-center space-y-3">
              <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
              <p className="text-xs font-bold text-muted-foreground">
                Loading templates...
              </p>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="py-16 text-center space-y-3 px-4">
              <Layers className="h-10 w-10 text-muted-foreground/40 mx-auto" />
              <h3 className="text-sm font-bold text-foreground">
                No Templates Found
              </h3>
              <p className="text-xs text-muted-foreground">
                Create a new template to standardize your project meeting
                minutes.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="border-b border-border text-xs uppercase font-extrabold text-muted-foreground">
                  <TableHead>Template Code</TableHead>
                  <TableHead>Template Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-center">Version</TableHead>
                  <TableHead className="text-center">Sections</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center w-36">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTemplates.map((t) => {
                  const st = STATUS_CONFIG[t.status] || STATUS_CONFIG.draft;
                  return (
                    <TableRow
                      key={t.id}
                      className="border-b border-border hover:bg-muted/30 text-xs"
                    >
                      {/* Code */}
                      <TableCell className="py-3 font-mono font-bold text-primary">
                        {t.code}
                      </TableCell>

                      {/* Name & Description */}
                      <TableCell className="py-3">
                        <div className="space-y-0.5 max-w-sm">
                          <p className="font-bold text-foreground">{t.name}</p>
                          <p className="text-[11px] text-muted-foreground line-clamp-1">
                            {t.description ||
                              "Standardized meeting minutes configuration"}
                          </p>
                        </div>
                      </TableCell>

                      {/* Category */}
                      <TableCell className="py-3 font-medium text-muted-foreground">
                        {t.category || "General"}
                      </TableCell>

                      {/* Version */}
                      <TableCell className="py-3 text-center font-mono font-bold text-slate-700">
                        {t.version}
                      </TableCell>

                      {/* Sections Count */}
                      <TableCell className="py-3 text-center text-muted-foreground font-semibold">
                        {(t.sections || []).length} Sections
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

                      {/* Actions */}
                      <TableCell className="py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            onClick={() =>
                              navigate(
                                `/projects/mom/templates/${t.id}/builder`,
                              )
                            }
                            className="h-7 w-7 text-muted-foreground hover:text-primary"
                            title={
                              t.status === "draft"
                                ? "Edit in Builder"
                                : "View Builder"
                            }
                          >
                            {t.status === "draft" ? (
                              <Edit className="h-3.5 w-3.5" />
                            ) : (
                              <Eye className="h-3.5 w-3.5" />
                            )}
                          </Button>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                className="h-7 w-7 text-muted-foreground"
                              >
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {t.status === "draft" && (
                                <DropdownMenuItem
                                  onClick={() => handlePublish(t.id, t.name)}
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5 mr-2 text-emerald-600" />{" "}
                                  Publish Version
                                </DropdownMenuItem>
                              )}
                              {t.status === "active" && (
                                <DropdownMenuItem
                                  onClick={() => handleCreateNewVersion(t)}
                                >
                                  <GitBranch className="h-3.5 w-3.5 mr-2 text-primary" />{" "}
                                  Create Next Version
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() => handleDuplicate(t)}
                              >
                                <Copy className="h-3.5 w-3.5 mr-2" /> Duplicate
                                Template
                              </DropdownMenuItem>
                              {t.status === "active" && (
                                <DropdownMenuItem
                                  onClick={() => handleArchive(t.id, t.name)}
                                >
                                  <Archive className="h-3.5 w-3.5 mr-2 text-amber-600" />{" "}
                                  Archive Template
                                </DropdownMenuItem>
                              )}
                              {t.status === "draft" && (
                                <DropdownMenuItem
                                  onClick={() => handleDelete(t.id, t.name)}
                                  className="text-rose-600 focus:text-rose-600"
                                >
                                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                                  Template
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Modal */}
      <CreateMomTemplateModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onCreated={() => loadTemplates()}
      />
    </div>
  );
};
