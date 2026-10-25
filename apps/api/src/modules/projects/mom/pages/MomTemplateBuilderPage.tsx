// src/modules/projects/mom/pages/MomTemplateBuilderPage.tsx

import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  MomTemplate,
  MomSectionConfig,
  MomSectionType,
  DEFAULT_MOM_COMPANY_HEADER,
} from "../types/mom";
import {
  getMomTemplateById,
  updateDraftTemplate,
  publishMomTemplate,
  createNewTemplateVersion,
  duplicateMomTemplate,
} from "../services/momTemplateService";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowLeft,
  Save,
  CheckCircle2,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Eye,
  Layers,
  Lock,
  GitBranch,
  Copy,
  AlertCircle,
  FileText,
  Users,
  Calendar,
  ListOrdered,
  Table,
  AlignLeft,
} from "lucide-react";
import { toast } from "sonner";

const SECTION_TYPE_META: Record<
  MomSectionType,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    description: string;
  }
> = {
  company_header: {
    label: "Company Header",
    icon: FileText,
    description:
      "Corporate logo, company name, address, and contact information.",
  },
  meeting_details: {
    label: "Meeting Details",
    icon: Calendar,
    description:
      "Subject, project reference, date, start/end time, location, and timezone.",
  },
  people_lists: {
    label: "People Lists",
    icon: Users,
    description: "Attendees present/remote and recorded absentees.",
  },
  agenda_list: {
    label: "Numbered / Bulleted List",
    icon: ListOrdered,
    description: "Meeting agenda topics or sequential discussion roadmap.",
  },
  meeting_notes_table: {
    label: "Meeting Notes Table",
    icon: Table,
    description: "Table with Agenda Item, Discussion Points, and Action Items.",
  },
  free_text: {
    label: "Free-Text Section",
    icon: AlignLeft,
    description:
      "Configurable multi-paragraph notes, executive summary, or conclusions.",
  },
};

export const MomTemplateBuilderPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [template, setTemplate] = useState<MomTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Editable Form State
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [sections, setSections] = useState<MomSectionConfig[]>([]);

  // Preview Mode Toggle
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (!id) return;
    const fetchTemplate = async () => {
      setLoading(true);
      try {
        const t = await getMomTemplateById(id);
        if (t) {
          setTemplate(t);
          setName(t.name);
          setCode(t.code);
          setDescription(t.description || "");
          setCategory(t.category || "");
          setSections(Array.isArray(t.sections) ? t.sections : []);
        } else {
          toast.error("Template not found");
        }
      } catch (err: any) {
        toast.error(err?.message || "Failed to load template");
      } finally {
        setLoading(false);
      }
    };
    fetchTemplate();
  }, [id]);

  const isPublished = template?.status === "active";
  const isArchived = template?.status === "archived";
  const isReadOnly = isPublished || isArchived;

  // Section Manipulation
  const handleUpdateSection = (
    secId: string,
    updates: Partial<MomSectionConfig>,
  ) => {
    if (isReadOnly) return;
    setSections(
      sections.map((s) => (s.id === secId ? { ...s, ...updates } : s)),
    );
  };

  const handleMoveSection = (index: number, direction: "up" | "down") => {
    if (isReadOnly) return;
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= sections.length) return;

    const newSections = [...sections];
    const temp = newSections[index];
    newSections[index] = newSections[targetIdx];
    newSections[targetIdx] = temp;

    setSections(newSections.map((s, idx) => ({ ...s, order: idx + 1 })));
  };

  const handleDeleteSection = (secId: string) => {
    if (isReadOnly) return;
    const filtered = sections.filter((s) => s.id !== secId);
    setSections(filtered.map((s, idx) => ({ ...s, order: idx + 1 })));
  };

  const handleAddSection = (type: MomSectionType) => {
    if (isReadOnly) return;
    const meta = SECTION_TYPE_META[type];
    const newSection: MomSectionConfig = {
      id: `sec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type,
      title: meta.label,
      order: sections.length + 1,
      visible: true,
      required: false,
      description: meta.description,
      defaultContent: type === "free_text" ? "Enter notes here..." : undefined,
    };
    setSections([...sections, newSection]);
    toast.success(`Added "${meta.label}" section`);
  };

  const handleSaveDraft = async () => {
    if (!id || !template) return;
    setSaving(true);
    try {
      await updateDraftTemplate(id, {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        description: description.trim(),
        category: category.trim(),
        sections,
      });
      toast.success("Template draft saved successfully!");
    } catch (err: any) {
      toast.error(err?.message || "Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!id || !template) return;
    setPublishing(true);
    try {
      await updateDraftTemplate(id, {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        description: description.trim(),
        category: category.trim(),
        sections,
      });
      await publishMomTemplate(id);
      setTemplate({ ...template, status: "active" });
      toast.success(
        `Template ${name} published as ${template.version}! Version is now immutable.`,
      );
    } catch (err: any) {
      toast.error(err?.message || "Failed to publish template");
    } finally {
      setPublishing(false);
    }
  };

  const handleCreateNewVersion = async () => {
    if (!template) return;
    try {
      const newVer = await createNewTemplateVersion(template, user);
      toast.success(`Created new draft version ${newVer.version}!`);
      navigate(`/projects/mom/templates/${newVer.id}/builder`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to create new version");
    }
  };

  const handleDuplicate = async () => {
    if (!template) return;
    try {
      const cloned = await duplicateMomTemplate(template, user);
      toast.success(`Duplicated as "${cloned.name}"`);
      navigate(`/projects/mom/templates/${cloned.id}/builder`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to duplicate template");
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center space-y-3">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
        <p className="text-xs font-bold text-muted-foreground">
          Loading template builder...
        </p>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="py-20 text-center space-y-3">
        <AlertCircle className="h-10 w-10 text-rose-500 mx-auto" />
        <p className="text-sm font-bold text-foreground">Template not found</p>
        <Button
          onClick={() => navigate("/projects/mom/templates")}
          variant="outline"
          size="sm"
        >
          Return to Templates
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16">
      {/* Top Bar */}
      <div className="bg-card p-4 rounded-2xl border border-border shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/projects/mom/templates")}
            className="rounded-xl text-xs font-bold gap-1 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Templates
          </Button>
          <div className="h-4 w-px bg-border hidden sm:block" />
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-lg border border-primary/20">
              {template.code}
            </span>
            <Badge
              variant="outline"
              className={`text-[10px] font-bold px-2 py-0.5 border ${
                template.status === "active"
                  ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                  : template.status === "draft"
                    ? "bg-slate-100 text-slate-700 border-slate-300"
                    : "bg-gray-100 text-gray-500 border-gray-300"
              }`}
            >
              {template.status.toUpperCase()} ({template.version})
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
            className="rounded-xl text-xs font-bold h-9"
          >
            <Eye className="h-3.5 w-3.5 mr-1" />
            {showPreview ? "Hide Preview" : "Preview Layout"}
          </Button>

          {isPublished ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDuplicate}
                className="rounded-xl text-xs font-bold h-9"
              >
                <Copy className="h-3.5 w-3.5 mr-1" /> Duplicate
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleCreateNewVersion}
                style={{
                  background:
                    "linear-gradient(135deg, #4D9F4B 0%, #72B84A 50%, #9FCA48 100%)",
                }}
                className="rounded-xl text-xs font-bold text-white shadow-xs h-9"
              >
                <GitBranch className="h-3.5 w-3.5 mr-1" /> Create Next Version
                (V{template.version_number + 1}.0)
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={saving || publishing}
                onClick={handleSaveDraft}
                className="rounded-xl text-xs font-bold h-9"
              >
                <Save className="h-3.5 w-3.5 mr-1" />
                {saving ? "Saving..." : "Save Draft"}
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={saving || publishing}
                onClick={handlePublish}
                style={{
                  background:
                    "linear-gradient(135deg, #4D9F4B 0%, #72B84A 50%, #9FCA48 100%)",
                }}
                className="rounded-xl text-xs font-bold text-white shadow-xs h-9"
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                {publishing ? "Publishing..." : `Publish ${template.version}`}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Immutability Banner */}
      {isPublished && (
        <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-2xl flex items-center gap-2.5 text-xs text-emerald-800">
          <Lock className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>
            This template version (<strong>{template.version}</strong>) is
            published and locked to guarantee immutability for existing
            documents. To make adjustments, click{" "}
            <strong>Create Next Version</strong>.
          </span>
        </div>
      )}

      {/* Main Builder Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Config Pane */}
        <div
          className={`${showPreview ? "lg:col-span-6" : "lg:col-span-12"} space-y-6`}
        >
          {/* Template Details Card */}
          <Card className="rounded-2xl border-border bg-card shadow-xs">
            <CardContent className="p-5 space-y-4">
              <h3 className="text-sm font-bold text-foreground">
                Template Metadata
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs font-bold text-foreground">
                    Template Name
                  </Label>
                  <Input
                    disabled={isReadOnly}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="text-xs h-9 rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-foreground">
                    Code
                  </Label>
                  <Input
                    disabled={isReadOnly}
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    className="text-xs h-9 rounded-xl font-mono uppercase"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-foreground">
                  Category
                </Label>
                <Input
                  disabled={isReadOnly}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="text-xs h-9 rounded-xl"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-foreground">
                  Description
                </Label>
                <Textarea
                  disabled={isReadOnly}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="text-xs min-h-[60px] rounded-xl resize-y"
                />
              </div>
            </CardContent>
          </Card>

          {/* Sections List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  Configured Sections
                </h3>
                <p className="text-xs text-muted-foreground">
                  Arrange, rename, toggle visibility, and set required
                  constraints.
                </p>
              </div>

              {!isReadOnly && (
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAddSection("free_text")}
                    className="rounded-xl text-xs font-bold h-8"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add Section
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              {sections.map((sec, index) => {
                const meta =
                  SECTION_TYPE_META[sec.type] || SECTION_TYPE_META.free_text;
                const IconComponent = meta.icon;

                return (
                  <Card
                    key={sec.id}
                    className="rounded-2xl border-border bg-card shadow-xs"
                  >
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                            <IconComponent className="h-4 w-4" />
                          </div>
                          <div>
                            <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase">
                              Section {index + 1} • {meta.label}
                            </span>
                            {isReadOnly ? (
                              <p className="font-bold text-foreground text-sm">
                                {sec.title}
                              </p>
                            ) : (
                              <Input
                                value={sec.title}
                                onChange={(e) =>
                                  handleUpdateSection(sec.id, {
                                    title: e.target.value,
                                  })
                                }
                                className="text-xs font-bold h-8 mt-0.5 rounded-lg w-64"
                              />
                            )}
                          </div>
                        </div>

                        {!isReadOnly && (
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              disabled={index === 0}
                              onClick={() => handleMoveSection(index, "up")}
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              title="Move section up"
                            >
                              <ArrowUp className="h-3 w-3" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              disabled={index === sections.length - 1}
                              onClick={() => handleMoveSection(index, "down")}
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              title="Move section down"
                            >
                              <ArrowDown className="h-3 w-3" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => handleDeleteSection(sec.id)}
                              className="h-7 w-7 text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                              title="Delete section"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Controls: Visibility & Required */}
                      <div className="flex items-center gap-6 pt-2 border-t border-border text-xs">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <Switch
                            disabled={isReadOnly}
                            checked={sec.visible !== false}
                            onCheckedChange={(checked) =>
                              handleUpdateSection(sec.id, { visible: checked })
                            }
                          />
                          <span className="font-medium text-foreground">
                            Visible in Document
                          </span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <Switch
                            disabled={isReadOnly}
                            checked={sec.required === true}
                            onCheckedChange={(checked) =>
                              handleUpdateSection(sec.id, { required: checked })
                            }
                          />
                          <span className="font-medium text-foreground">
                            Required to Finalize
                          </span>
                        </label>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Preview Pane (Toggleable) */}
        {showPreview && (
          <div className="lg:col-span-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">
                Live Schema Preview
              </h3>
              <span className="text-xs text-muted-foreground">
                Simulated Output
              </span>
            </div>

            <div className="bg-white rounded-2xl border border-slate-300 p-6 shadow-md text-black space-y-6 max-h-[800px] overflow-y-auto">
              <div
                style={{
                  background:
                    "linear-gradient(135deg, #4D9F4B 0%, #72B84A 50%, #9FCA48 100%)",
                }}
                className="h-1.5 w-full rounded-t-xl -mt-6 -mx-6 mb-4"
              />

              {sections
                .filter((s) => s.visible !== false)
                .map((sec, idx) => (
                  <div
                    key={sec.id}
                    className="space-y-1.5 pb-4 border-b border-slate-200"
                  >
                    <p className="text-[11px] uppercase font-bold text-emerald-800">
                      {idx + 1}.0 {sec.title}{" "}
                      {sec.required && <span className="text-rose-500">*</span>}
                    </p>
                    {sec.type === "company_header" && (
                      <div className="flex items-center justify-between text-xs py-1">
                        <div>
                          <p className="font-bold">
                            {DEFAULT_MOM_COMPANY_HEADER.companyName}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            {DEFAULT_MOM_COMPANY_HEADER.email}
                          </p>
                        </div>
                        <img
                          src={DEFAULT_MOM_COMPANY_HEADER.logoUrl}
                          alt="Logo"
                          className="h-8 object-contain"
                        />
                      </div>
                    )}
                    {sec.type === "meeting_details" && (
                      <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2 rounded border border-slate-200">
                        <div>Subject: Project Alignment Review</div>
                        <div>Date: 2026-09-05</div>
                      </div>
                    )}
                    {sec.type === "people_lists" && (
                      <div className="text-[11px] text-slate-600 italic">
                        [Attendees (Present / Remote) & Recorded Absentees]
                      </div>
                    )}
                    {sec.type === "agenda_list" && (
                      <ol className="list-decimal pl-4 text-[11px] space-y-0.5">
                        <li>Milestone Review</li>
                        <li>Technical Architecture</li>
                        <li>Next Steps</li>
                      </ol>
                    )}
                    {sec.type === "meeting_notes_table" && (
                      <div className="border border-slate-300 rounded text-[11px] p-2 bg-slate-50 text-center text-slate-500">
                        [Table: Agenda Item | Discussion Points | Action Items]
                      </div>
                    )}
                    {sec.type === "free_text" && (
                      <p className="text-xs text-slate-700 whitespace-pre-line">
                        {sec.defaultContent || "Free text content..."}
                      </p>
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
