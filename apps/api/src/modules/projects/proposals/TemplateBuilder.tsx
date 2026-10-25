import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { ref, onValue, update, push, set } from "firebase/database";
import { database } from "@/services/firebase";
import { ProposalTemplate, ProposalSectionConfig } from "../proposalTypes";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft,
  Layers,
  Plus,
  Save,
  Eye,
  GripVertical,
  Edit,
  Copy,
  Trash2,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  FileText,
  Send,
  Loader2,
  GitBranch,
  GitFork,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import SectionConfigDrawer, { CONTENT_TYPE_INFO } from "./SectionConfigDrawer";
import TemplateLivePreview from "./TemplateLivePreview";

export default function TemplateBuilder() {
  const { templateId } = useParams<{ templateId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [template, setTemplate] = useState<ProposalTemplate | null>(null);
  const [sections, setSections] = useState<ProposalSectionConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Section Modal / Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sectionToEdit, setSectionToEdit] =
    useState<ProposalSectionConfig | null>(null);

  // Drag & drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!templateId) return;

    const unsub = onValue(
      ref(database, `proposal_templates/${templateId}`),
      (snap) => {
        if (!snap.exists()) {
          setTemplate(null);
          setLoading(false);
          return;
        }
        const data = snap.val();
        const loadedSections: ProposalSectionConfig[] = Array.isArray(
          data.sections,
        )
          ? data.sections
          : typeof data.sections === "object" && data.sections !== null
            ? Object.values(data.sections)
            : [];

        // Sort by order
        loadedSections.sort((a, b) => (a.order || 0) - (b.order || 0));

        setTemplate({
          id: templateId,
          ...data,
          sections: loadedSections,
        });
        setSections(loadedSections);
        setLoading(false);
      },
    );

    return () => unsub();
  }, [templateId]);

  // Save template to Firebase
  const handleSaveTemplate = async (
    newStatus?: "draft" | "active" | "archived",
  ) => {
    if (!templateId || !template) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const sanitizedSections = sections.map((s, idx) => {
        const item: any = {
          id: s.id || `sec_${idx}`,
          title: s.title || "",
          contentType: s.contentType || "rich_text",
          type: s.contentType || "rich_text",
          isRequired: Boolean(s.isRequired),
          required: Boolean(s.isRequired),
          showSectionNumber: s.showSectionNumber !== false,
          showNumber: s.showSectionNumber !== false,
          pageBreakBefore: Boolean(s.pageBreakBefore),
          allowUserDelete: s.allowUserDelete !== false,
          allowUserDuplicate: s.allowUserDuplicate !== false,
          order: idx,
        };

        if (s.description) item.description = s.description;
        if (s.placeholder) item.placeholder = s.placeholder;
        if (s.defaultContent) item.defaultContent = s.defaultContent;
        if (Array.isArray(s.defaultItems)) item.defaultItems = s.defaultItems;
        if (Array.isArray(s.keyValueFields))
          item.keyValueFields = s.keyValueFields;
        if (Array.isArray(s.tableColumns)) item.tableColumns = s.tableColumns;
        if (s.tableTitle) item.tableTitle = s.tableTitle;
        if (Array.isArray(s.signatureFields))
          item.signatureFields = s.signatureFields;
        if (Array.isArray(s.subsections)) {
          item.subsections = s.subsections;
          item.children = s.subsections;
        }

        return item;
      });

      const updatedData: Record<string, any> = {
        sections: sanitizedSections,
        schema_json: sanitizedSections,
        current_version: template.version || "V1",
        status: newStatus || template.status || "active",
        updated_at: now,
        updatedAt: now,
      };

      if (newStatus === "active" && !template.published_at) {
        updatedData.published_at = now;
        updatedData.publishedAt = now;
      }

      await update(
        ref(database, `proposal_templates/${templateId}`),
        updatedData,
      );
      toast.success(
        newStatus === "active"
          ? "Template published and active for proposal creation!"
          : "Template saved successfully!",
      );
      navigate("/projects/proposals/templates");
    } catch (err: any) {
      toast.error(err?.message || "Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  // Create New Version from current builder state
  const handleCreateNewVersion = async () => {
    if (!template) return;
    setSaving(true);
    try {
      const currentVerNum =
        template.version_number ||
        parseInt(template.version?.replace(/[^0-9]/g, "") || "1") ||
        1;
      const nextVerNum = currentVerNum + 1;
      const nextVer = `V${nextVerNum}`;

      const now = new Date().toISOString();
      const newRef = push(ref(database, "proposal_templates"));
      const newVersionId = newRef.key!;

      const newVersionTemplate: ProposalTemplate = {
        ...template,
        id: newVersionId,
        version: nextVer,
        version_number: nextVerNum,
        parent_version_id: template.id,
        status: "draft",
        sections: sections.map((s, idx) => ({ ...s, order: idx })),
        createdAt: now,
        updatedAt: now,
      };

      // Set new version in database
      await set(newRef, newVersionTemplate);

      toast.success(`Created new version ${nextVer} in Draft status!`);
      navigate(`/projects/proposals/templates/${newVersionId}/builder`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to create new version");
    } finally {
      setSaving(false);
    }
  };

  // Add or update section handler
  const handleSaveSection = (section: ProposalSectionConfig) => {
    if (sectionToEdit) {
      // Editing existing section
      setSections((prev) =>
        prev.map((s) =>
          s.id === section.id ? { ...section, order: s.order } : s,
        ),
      );
      toast.success(`Section "${section.title}" updated`);
    } else {
      // Adding new section
      const newSection: ProposalSectionConfig = {
        ...section,
        order: sections.length,
      };
      setSections((prev) => [...prev, newSection]);
      toast.success(`Section "${section.title}" added`);
    }
    setSectionToEdit(null);
  };

  // Duplicate section
  const handleDuplicateSection = (index: number) => {
    const target = sections[index];
    if (!target) return;
    const duplicated: ProposalSectionConfig = {
      ...target,
      id: `sec_${Date.now()}`,
      title: `${target.title} (Copy)`,
      order: index + 1,
    };

    const newSections = [...sections];
    newSections.splice(index + 1, 0, duplicated);
    const reordered = newSections.map((s, idx) => ({ ...s, order: idx }));
    setSections(reordered);
    toast.success(`Section duplicated: "${target.title}"`);
  };

  // Delete section
  const handleDeleteSection = (index: number) => {
    const target = sections[index];
    if (!target) return;
    if (!window.confirm(`Delete section "${target.title}"?`)) return;

    const newSections = sections.filter((_, idx) => idx !== index);
    const reordered = newSections.map((s, idx) => ({ ...s, order: idx }));
    setSections(reordered);
    toast.success("Section deleted");
  };

  // Move section Up
  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newSections = [...sections];
    const temp = newSections[index - 1];
    newSections[index - 1] = newSections[index];
    newSections[index] = temp;
    setSections(newSections.map((s, idx) => ({ ...s, order: idx })));
  };

  // Move section Down
  const handleMoveDown = (index: number) => {
    if (index === sections.length - 1) return;
    const newSections = [...sections];
    const temp = newSections[index + 1];
    newSections[index + 1] = newSections[index];
    newSections[index] = temp;
    setSections(newSections.map((s, idx) => ({ ...s, order: idx })));
  };

  // Drag & Drop handlers
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newSections = [...sections];
    const draggedItem = newSections[draggedIndex];
    newSections.splice(draggedIndex, 1);
    newSections.splice(index, 0, draggedItem);

    setDraggedIndex(index);
    setSections(newSections.map((s, idx) => ({ ...s, order: idx })));
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500 gap-2 text-xs">
        <Loader2 className="h-4 w-4 animate-spin text-emerald-600" /> Loading
        template builder...
      </div>
    );
  }

  if (!template) {
    return (
      <div className="text-center py-20 space-y-3">
        <p className="text-sm font-bold text-slate-700">
          Template not found or has been deleted.
        </p>
        <Button
          onClick={() => navigate("/projects/proposals/templates")}
          style={{
            background:
              "linear-gradient(135deg, #4D9F4B 0%, #72B84A 50%, #9FCA48 100%)",
          }}
          className="text-white font-bold rounded-2xl text-xs"
        >
          Return to Templates
        </Button>
      </div>
    );
  }

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
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => navigate("/projects/proposals/templates")}
              className="h-8 w-8 bg-white/20 hover:bg-white/30 text-white rounded-xl"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <span className="font-mono text-xs font-black px-2.5 py-1 bg-white/20 backdrop-blur-md rounded-xl text-emerald-100 border border-white/20">
              {template.code}
            </span>
            <Badge className="bg-white/20 text-white border-white/30 text-xs font-bold">
              Version {template.version}
            </Badge>
            <Badge className="bg-emerald-900/40 text-emerald-100 border-emerald-400/30 text-xs font-semibold">
              {template.department || template.category || "General"}
            </Badge>
            <Badge
              className={`text-xs font-bold ${template.status === "active" ? "bg-white text-emerald-900" : "bg-white/20 text-white"}`}
            >
              {template.status.toUpperCase()}
            </Badge>
          </div>
          <h1 className="text-2xl font-black tracking-tight">
            {template.name}
          </h1>
          <p className="text-emerald-100/90 text-xs sm:text-sm pl-1">
            Configure dynamic sections, table columns and live document preview
            without hard-coded headings.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <Button
            variant="outline"
            onClick={handleCreateNewVersion}
            disabled={saving}
            className="bg-indigo-600/80 hover:bg-indigo-600 text-white border-white/20 font-bold rounded-2xl shadow-sm px-4 py-2.5 h-auto transition-all duration-200 text-xs"
            title="Creates a new version while protecting existing issued proposals"
          >
            <GitBranch className="h-4 w-4 mr-1.5 text-white" /> Create New
            Version
          </Button>

          <Button
            variant="outline"
            onClick={() => handleSaveTemplate("draft")}
            disabled={saving}
            className="bg-white/15 hover:bg-white/25 text-white border-white/30 font-bold rounded-2xl shadow-sm px-4 py-2.5 h-auto transition-all duration-200 text-xs"
          >
            <Save className="h-4 w-4 mr-1.5 text-white" /> Save Draft
          </Button>

          <Button
            onClick={() => handleSaveTemplate("active")}
            disabled={saving}
            className="bg-white text-emerald-900 hover:bg-emerald-50 font-bold rounded-2xl shadow-md px-5 py-2.5 h-auto transition-all duration-200 hover:scale-[1.02] text-xs"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin text-emerald-700" />
            ) : (
              <Send className="h-4 w-4 mr-1.5 text-emerald-700" />
            )}
            Publish Template
          </Button>
        </div>
      </div>

      {/* Structural Change Recommendation Banner for Active Templates */}
      {template.status === "active" && (
        <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 flex items-start justify-between gap-4 text-xs">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-900">
                You are modifying an Active Template ({template.version})
              </p>
              <p className="text-amber-800/90 text-[11px] leading-relaxed mt-0.5">
                For structural changes (renaming, adding, or deleting sections),
                it is recommended to click <strong>Create New Version</strong>.
                Existing proposals created under {template.version} will
                continue using their locked snapshot.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={handleCreateNewVersion}
            className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs h-8 shrink-0 font-bold"
          >
            <GitBranch className="h-3.5 w-3.5 mr-1" /> Create New Version
          </Button>
        </div>
      )}

      {/* 2. Main 2-Column Split: Section Builder (Left) & Live Preview (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left / Center: Dynamic Section Builder Canvas */}
        <div className="lg:col-span-6 space-y-4 lg:max-h-[calc(100vh-140px)] lg:overflow-y-auto lg:pr-2 scroll-smooth">
          <Card className="border border-slate-200/80 shadow-md rounded-3xl bg-white overflow-hidden">
            <CardHeader className="p-5 bg-slate-50/50 border-b border-slate-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <Layers className="h-4 w-4 text-emerald-600" /> Document
                  Section Builder
                </CardTitle>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Drag cards to reorder. Click Edit to change title or settings.
                </p>
              </div>
              <Badge
                variant="outline"
                className="text-xs font-mono font-bold bg-white text-slate-700"
              >
                {sections.length} Sections
              </Badge>
            </CardHeader>
            <CardContent className="p-5 space-y-3">
              {sections.length === 0 ? (
                <div className="py-14 text-center border-2 border-dashed border-slate-200 rounded-2xl p-6">
                  <div className="h-10 w-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-2">
                    <Plus className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-bold text-slate-700">
                    No sections added yet
                  </p>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1 mb-4">
                    Start structuring your proposal document by adding modular
                    content sections.
                  </p>
                  <Button
                    onClick={() => {
                      setSectionToEdit(null);
                      setDrawerOpen(true);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs h-9 font-bold"
                  >
                    <Plus className="h-4 w-4 mr-1.5" /> Add First Section
                  </Button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {sections.map((sec, index) => {
                    const typeInfo =
                      CONTENT_TYPE_INFO[sec.contentType] ||
                      CONTENT_TYPE_INFO.rich_text;
                    const Icon = typeInfo.icon;
                    const isDragging = draggedIndex === index;

                    return (
                      <div
                        key={sec.id}
                        draggable
                        onDragStart={() => handleDragStart(index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragEnd={handleDragEnd}
                        onClick={() => {
                          const previewEl = document.getElementById(
                            `template-preview-sec-${sec.id}`,
                          );
                          if (previewEl) {
                            previewEl.scrollIntoView({
                              behavior: "smooth",
                              block: "center",
                            });
                          }
                        }}
                        className={`p-4 rounded-2xl border transition-all bg-white shadow-xs flex items-center justify-between gap-3 group cursor-pointer ${
                          isDragging
                            ? "opacity-40 border-emerald-500 scale-[0.98]"
                            : "border-slate-200/80 hover:border-emerald-400"
                        }`}
                      >
                        {/* Drag Handle & Section Info */}
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <button
                            type="button"
                            className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-600 p-1 -ml-1 rounded-lg"
                            title="Drag to reorder"
                          >
                            <GripVertical className="h-4 w-4" />
                          </button>

                          <div className="p-2 rounded-xl bg-slate-100 text-slate-700 group-hover:bg-emerald-50 group-hover:text-emerald-700 transition-colors shrink-0">
                            <Icon className="h-4 w-4" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-slate-900 truncate">
                                {sec.title}
                              </span>
                              {sec.isRequired && (
                                <Badge className="bg-rose-50 text-rose-700 border-rose-200 text-[9px] px-1.5 py-0 font-bold">
                                  Required
                                </Badge>
                              )}
                              {sec.pageBreakBefore && (
                                <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[9px] px-1.5 py-0 font-bold">
                                  Page Break
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5 flex-wrap">
                              <span className="font-semibold text-slate-600">
                                {typeInfo.label}
                              </span>
                              {sec.contentType === "table" &&
                                sec.tableColumns && (
                                  <span>
                                    • {sec.tableColumns.length} columns
                                  </span>
                                )}
                              {(sec.contentType === "bullet_list" ||
                                sec.contentType === "numbered_list") &&
                                sec.defaultItems && (
                                  <span>
                                    • {sec.defaultItems.length} default items
                                  </span>
                                )}
                              {sec.contentType === "key_value" &&
                                sec.keyValueFields && (
                                  <span>
                                    • {sec.keyValueFields.length} fields
                                  </span>
                                )}
                              {sec.contentType === "section_group" &&
                                sec.subsections && (
                                  <span>
                                    • {sec.subsections.length} subsections
                                  </span>
                                )}
                              {sec.contentType === "signature" &&
                                sec.signatureFields && (
                                  <span>
                                    • {sec.signatureFields.length} signatory
                                    columns
                                  </span>
                                )}
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-1 shrink-0">
                          {/* Reorder Arrows */}
                          <div className="flex flex-col">
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={() => handleMoveUp(index)}
                              className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-25"
                              title="Move Up"
                            >
                              <ArrowUp className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              disabled={index === sections.length - 1}
                              onClick={() => handleMoveDown(index)}
                              className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-25"
                              title="Move Down"
                            >
                              <ArrowDown className="h-3 w-3" />
                            </button>
                          </div>

                          {/* Edit */}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSectionToEdit(sec);
                              setDrawerOpen(true);
                            }}
                            className="h-8 text-xs font-semibold rounded-xl text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 px-2.5"
                          >
                            <Edit className="h-3.5 w-3.5 mr-1" /> Edit
                          </Button>

                          {/* Duplicate */}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDuplicateSection(index)}
                            className="h-8 text-xs font-semibold rounded-xl text-slate-600 hover:bg-slate-100 px-2"
                            title="Duplicate section"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>

                          {/* Delete */}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteSection(index)}
                            className="h-8 text-xs font-semibold rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 px-2"
                            title="Delete section"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Bottom Add Section Action */}
              <div className="pt-3">
                <Button
                  type="button"
                  onClick={() => {
                    setSectionToEdit(null);
                    setDrawerOpen(true);
                  }}
                  className="w-full h-11 rounded-2xl border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/50 hover:bg-emerald-50 text-emerald-800 font-bold text-xs transition-all flex items-center justify-center gap-2"
                >
                  <Plus className="h-4 w-4 text-emerald-600" /> Add Section
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Live Template Preview */}
        <div className="lg:col-span-6 sticky top-6">
          <TemplateLivePreview template={template} sections={sections} />
        </div>
      </div>

      {/* Dynamic Section Configuration Drawer */}
      <SectionConfigDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        sectionToEdit={sectionToEdit}
        onSave={handleSaveSection}
      />
    </div>
  );
}
