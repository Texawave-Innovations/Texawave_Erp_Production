import React, { useState, useEffect } from "react";
import {
  ProposalSectionConfig,
  SectionContentType,
  TableColumnDef,
  KeyValueFieldDef,
  SignatureFieldDef,
} from "../proposalTypes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  FileText,
  AlignLeft,
  Type,
  AlignJustify,
  List,
  ListOrdered,
  LayoutGrid,
  Table,
  Layers,
  CheckSquare,
  Image,
  PenTool,
  Scissors,
  MoveVertical,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

interface SectionConfigDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectionToEdit?: ProposalSectionConfig | null;
  onSave: (section: ProposalSectionConfig) => void;
  isSubsection?: boolean;
}

export const CONTENT_TYPE_INFO: Record<
  SectionContentType,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    description: string;
  }
> = {
  rich_text: {
    label: "Rich Text",
    icon: FileText,
    description:
      "Formatted multi-paragraph text with headings, bold, bullet points & placeholders",
  },
  paragraph: {
    label: "Paragraph",
    icon: AlignJustify,
    description: "Standard single or multi-line plain text body block",
  },
  short_text: {
    label: "Short Text Input",
    icon: Type,
    description:
      "Single-line input for titles, project IDs, customer contact person or tags",
  },
  long_text: {
    label: "Long Text Input",
    icon: AlignLeft,
    description: "Multi-line textarea for descriptions, terms or remarks",
  },
  bullet_list: {
    label: "Bullet List",
    icon: List,
    description:
      "Unordered bulleted points (e.g. key deliverables, scope exclusions)",
  },
  numbered_list: {
    label: "Numbered List",
    icon: ListOrdered,
    description: "Ordered sequence of steps, phases, or milestone roadmap",
  },
  key_value: {
    label: "Key-Value Fields",
    icon: LayoutGrid,
    description:
      "Paired property list (e.g. Timeline: 4 Weeks, Warranty: 12 Months)",
  },
  table: {
    label: "Table",
    icon: Table,
    description:
      "Dynamic table with configurable columns for commercials, bill of materials, etc.",
  },
  section_group: {
    label: "Section Group",
    icon: Layers,
    description:
      "Container section grouping multiple nested subsections together",
  },
  checklist: {
    label: "Checklist",
    icon: CheckSquare,
    description:
      "Interactive checklist with completion checkmarks for requirements or sign-offs",
  },
  image: {
    label: "Image",
    icon: Image,
    description:
      "Architecture diagram, site photo, technical drawing or brand banner",
  },
  signature: {
    label: "Signature",
    icon: PenTool,
    description:
      "Official authorization block with signature, signatory name, title and date",
  },
  page_break: {
    label: "Page Break",
    icon: Scissors,
    description: "Forces subsequent sections onto a fresh printed PDF page",
  },
  spacer: {
    label: "Spacer",
    icon: MoveVertical,
    description: "Adds visual vertical breathing space between document blocks",
  },
};

export default function SectionConfigDrawer({
  open,
  onOpenChange,
  sectionToEdit,
  onSave,
  isSubsection = false,
}: SectionConfigDrawerProps) {
  const [title, setTitle] = useState("");
  const [contentType, setContentType] =
    useState<SectionContentType>("rich_text");
  const [description, setDescription] = useState("");
  const [placeholder, setPlaceholder] = useState("");
  const [defaultContent, setDefaultContent] = useState("");

  // General Layout Settings
  const [showSectionNumber, setShowSectionNumber] = useState(true);
  const [isRequired, setIsRequired] = useState(false);
  const [allowUserDelete, setAllowUserDelete] = useState(true);
  const [pageBreakBefore, setPageBreakBefore] = useState(false);
  const [pageBreakAfter, setPageBreakAfter] = useState(false);

  // 1. Bullet / Numbered List Config
  const [defaultItems, setDefaultItems] = useState<string[]>([""]);
  const [minItems, setMinItems] = useState<number>(1);
  const [maxItems, setMaxItems] = useState<number>(10);
  const [allowAddRow, setAllowAddRow] = useState<boolean>(true);
  const [allowDeleteRow, setAllowDeleteRow] = useState<boolean>(true);

  // 2. Key-Value Fields Config
  const [keyValueFields, setKeyValueFields] = useState<KeyValueFieldDef[]>([
    {
      id: "kv_1",
      label: "Project Title",
      type: "text",
      required: true,
      placeholder: "Enter project title",
    },
    {
      id: "kv_2",
      label: "PRD Code",
      type: "text",
      required: false,
      placeholder: "e.g. PRD-2026-001",
    },
    {
      id: "kv_3",
      label: "Client",
      type: "text",
      required: true,
      placeholder: "Client company name",
    },
    {
      id: "kv_4",
      label: "Version",
      type: "text",
      required: true,
      defaultValue: "V1.0",
    },
    {
      id: "kv_5",
      label: "Prepared By",
      type: "text",
      required: false,
      placeholder: "Author Name",
    },
    {
      id: "kv_6",
      label: "Reviewed By",
      type: "text",
      required: false,
      placeholder: "Reviewer Name",
    },
    {
      id: "kv_7",
      label: "Approved By",
      type: "text",
      required: false,
      placeholder: "Approver Name",
    },
    { id: "kv_8", label: "Date", type: "date", required: true },
  ]);

  // 3. Table Config
  const [tableTitle, setTableTitle] = useState("");
  const [tableColumns, setTableColumns] = useState<TableColumnDef[]>([
    { id: "col_1", name: "Milestone", type: "text", required: true },
    { id: "col_2", name: "Duration", type: "text", required: false },
    { id: "col_3", name: "End Date", type: "date", required: false },
    { id: "col_4", name: "Amount (₹)", type: "currency", required: false },
  ]);
  const [allowAddTableRow, setAllowAddTableRow] = useState(true);
  const [allowDeleteTableRow, setAllowDeleteTableRow] = useState(true);

  // 4. Section Group (Subsections)
  const [subsections, setSubsections] = useState<ProposalSectionConfig[]>([
    {
      id: "sub_1",
      title: "In Scope",
      contentType: "bullet_list",
      order: 0,
      isEnabled: true,
      defaultItems: [
        "System architecture design",
        "Core prototype development",
      ],
    },
    {
      id: "sub_2",
      title: "Out of Scope",
      contentType: "bullet_list",
      order: 1,
      isEnabled: true,
      defaultItems: [
        "Third-party hardware procurement",
        "On-site continuous operations",
      ],
    },
  ]);

  const [subDrawerOpen, setSubDrawerOpen] = useState(false);
  const [editingSubsection, setEditingSubsection] =
    useState<ProposalSectionConfig | null>(null);

  // 5. Signature Config
  const [signatureFields, setSignatureFields] = useState<SignatureFieldDef[]>([
    { id: "sig_1", label: "Name", type: "name", required: true },
    { id: "sig_2", label: "Role", type: "role", required: true },
    { id: "sig_3", label: "Signature", type: "signature", required: true },
    { id: "sig_4", label: "Date", type: "date", required: true },
    { id: "sig_5", label: "Company Seal", type: "seal", required: false },
  ]);

  // 6. Image Config
  const [imageUrl, setImageUrl] = useState("");
  const [imageCaption, setImageCaption] = useState("");
  const [imageAlignment, setImageAlignment] = useState<
    "left" | "center" | "right"
  >("center");
  const [imageMaxWidth, setImageMaxWidth] = useState("100%");

  useEffect(() => {
    if (sectionToEdit) {
      setTitle(sectionToEdit.title || "");
      setContentType(sectionToEdit.contentType || "rich_text");
      setDescription(sectionToEdit.description || "");
      setPlaceholder(sectionToEdit.placeholder || "");
      setDefaultContent(sectionToEdit.defaultContent || "");
      setShowSectionNumber(sectionToEdit.showSectionNumber !== false);
      setIsRequired(!!sectionToEdit.isRequired);
      setAllowUserDelete(sectionToEdit.allowUserDelete !== false);
      setPageBreakBefore(!!sectionToEdit.pageBreakBefore);
      setPageBreakAfter(!!sectionToEdit.pageBreakAfter);

      if (sectionToEdit.defaultItems)
        setDefaultItems(sectionToEdit.defaultItems);
      if (sectionToEdit.minItems !== undefined)
        setMinItems(sectionToEdit.minItems);
      if (sectionToEdit.maxItems !== undefined)
        setMaxItems(sectionToEdit.maxItems);
      if (sectionToEdit.allowAddRow !== undefined)
        setAllowAddRow(sectionToEdit.allowAddRow);
      if (sectionToEdit.allowDeleteRow !== undefined)
        setAllowDeleteRow(sectionToEdit.allowDeleteRow);

      if (sectionToEdit.keyValueFields)
        setKeyValueFields(sectionToEdit.keyValueFields);

      setTableTitle(sectionToEdit.tableTitle || "");
      if (sectionToEdit.tableColumns)
        setTableColumns(sectionToEdit.tableColumns);
      if (sectionToEdit.allowAddTableRow !== undefined)
        setAllowAddTableRow(sectionToEdit.allowAddTableRow);
      if (sectionToEdit.allowDeleteTableRow !== undefined)
        setAllowDeleteTableRow(sectionToEdit.allowDeleteTableRow);

      if (sectionToEdit.subsections) setSubsections(sectionToEdit.subsections);

      if (sectionToEdit.signatureFields)
        setSignatureFields(sectionToEdit.signatureFields);

      setImageUrl(sectionToEdit.imageUrl || "");
      setImageCaption(sectionToEdit.imageCaption || "");
      setImageAlignment(sectionToEdit.imageAlignment || "center");
      setImageMaxWidth(sectionToEdit.imageMaxWidth || "100%");
    } else {
      resetForm();
    }
  }, [sectionToEdit, open]);

  const resetForm = () => {
    setTitle("");
    setContentType("rich_text");
    setDescription("");
    setPlaceholder("");
    setDefaultContent("");
    setShowSectionNumber(true);
    setIsRequired(false);
    setAllowUserDelete(true);
    setPageBreakBefore(false);
    setPageBreakAfter(false);

    setDefaultItems([""]);
    setMinItems(1);
    setMaxItems(10);
    setAllowAddRow(true);
    setAllowDeleteRow(true);

    setKeyValueFields([
      {
        id: "kv_1",
        label: "Project Title",
        type: "text",
        required: true,
        placeholder: "Enter project title",
      },
      {
        id: "kv_2",
        label: "PRD Code",
        type: "text",
        required: false,
        placeholder: "e.g. PRD-2026-001",
      },
      {
        id: "kv_3",
        label: "Client",
        type: "text",
        required: true,
        placeholder: "Client company name",
      },
      {
        id: "kv_4",
        label: "Version",
        type: "text",
        required: true,
        defaultValue: "V1.0",
      },
      {
        id: "kv_5",
        label: "Prepared By",
        type: "text",
        required: false,
        placeholder: "Author Name",
      },
      {
        id: "kv_6",
        label: "Reviewed By",
        type: "text",
        required: false,
        placeholder: "Reviewer Name",
      },
      {
        id: "kv_7",
        label: "Approved By",
        type: "text",
        required: false,
        placeholder: "Approver Name",
      },
      { id: "kv_8", label: "Date", type: "date", required: true },
    ]);

    setTableTitle("");
    setTableColumns([
      { id: "col_1", name: "Milestone", type: "text", required: true },
      { id: "col_2", name: "Duration", type: "text", required: false },
      { id: "col_3", name: "End Date", type: "date", required: false },
      { id: "col_4", name: "Amount (₹)", type: "currency", required: false },
    ]);
    setAllowAddTableRow(true);
    setAllowDeleteTableRow(true);

    setSubsections([
      {
        id: "sub_1",
        title: "In Scope",
        contentType: "bullet_list",
        order: 0,
        isEnabled: true,
        defaultItems: [
          "System architecture design",
          "Core prototype development",
        ],
      },
      {
        id: "sub_2",
        title: "Out of Scope",
        contentType: "bullet_list",
        order: 1,
        isEnabled: true,
        defaultItems: [
          "Third-party hardware procurement",
          "On-site continuous operations",
        ],
      },
    ]);

    setSignatureFields([
      { id: "sig_1", label: "Name", type: "name", required: true },
      { id: "sig_2", label: "Role", type: "role", required: true },
      { id: "sig_3", label: "Signature", type: "signature", required: true },
      { id: "sig_4", label: "Date", type: "date", required: true },
      { id: "sig_5", label: "Company Seal", type: "seal", required: false },
    ]);

    setImageUrl("");
    setImageCaption("");
    setImageAlignment("center");
    setImageMaxWidth("100%");
  };

  // 1. Bullet list item actions
  const handleAddDefaultItem = () => setDefaultItems((prev) => [...prev, ""]);
  const handleRemoveDefaultItem = (idx: number) =>
    setDefaultItems((prev) => prev.filter((_, i) => i !== idx));
  const handleDefaultItemChange = (idx: number, val: string) =>
    setDefaultItems((prev) => prev.map((item, i) => (i === idx ? val : item)));

  // 2. Key-Value Field actions
  const handleAddKVField = () => {
    const newId = `kv_${Date.now()}`;
    setKeyValueFields((prev) => [
      ...prev,
      {
        id: newId,
        label: "New Field",
        type: "text",
        required: false,
        placeholder: "Enter value",
      },
    ]);
  };
  const handleRemoveKVField = (id: string) =>
    setKeyValueFields((prev) => prev.filter((f) => f.id !== id));
  const handleKVFieldChange = (
    id: string,
    key: keyof KeyValueFieldDef,
    val: any,
  ) => {
    setKeyValueFields((prev) =>
      prev.map((f) => (f.id === id ? { ...f, [key]: val } : f)),
    );
  };
  const handleMoveKVField = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === keyValueFields.length - 1) return;
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    const next = [...keyValueFields];
    const temp = next[index];
    next[index] = next[targetIdx];
    next[targetIdx] = temp;
    setKeyValueFields(next);
  };

  // 3. Table column actions
  const handleAddTableCol = () => {
    const newId = `col_${Date.now()}`;
    setTableColumns((prev) => [
      ...prev,
      {
        id: newId,
        name: `Column ${prev.length + 1}`,
        type: "text",
        required: false,
      },
    ]);
  };
  const handleRemoveTableCol = (id: string) => {
    if (tableColumns.length <= 1) {
      toast.error("Table must contain at least 1 column");
      return;
    }
    setTableColumns((prev) => prev.filter((c) => c.id !== id));
  };
  const handleTableColChange = (
    id: string,
    key: keyof TableColumnDef,
    val: any,
  ) => {
    setTableColumns((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [key]: val } : c)),
    );
  };
  const handleMoveTableCol = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === tableColumns.length - 1) return;
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    const next = [...tableColumns];
    const temp = next[index];
    next[index] = next[targetIdx];
    next[targetIdx] = temp;
    setTableColumns(next);
  };

  // 4. Section Group (Subsections) actions
  const handleSaveSubsection = (sub: ProposalSectionConfig) => {
    if (editingSubsection) {
      setSubsections((prev) => prev.map((s) => (s.id === sub.id ? sub : s)));
      toast.success(`Subsection "${sub.title}" updated`);
    } else {
      setSubsections((prev) => [...prev, { ...sub, order: prev.length }]);
      toast.success(`Subsection "${sub.title}" added`);
    }
    setEditingSubsection(null);
  };
  const handleRemoveSubsection = (id: string) => {
    setSubsections((prev) => prev.filter((s) => s.id !== id));
    toast.success("Subsection removed");
  };

  // 5. Signature column actions
  const handleAddSignatureCol = () => {
    const newId = `sig_${Date.now()}`;
    setSignatureFields((prev) => [
      ...prev,
      { id: newId, label: "Custom Column", type: "text", required: false },
    ]);
  };
  const handleRemoveSignatureCol = (id: string) => {
    if (signatureFields.length <= 1) {
      toast.error("Signature block must contain at least 1 column");
      return;
    }
    setSignatureFields((prev) => prev.filter((s) => s.id !== id));
  };
  const handleSignatureColChange = (
    id: string,
    key: keyof SignatureFieldDef,
    val: any,
  ) => {
    setSignatureFields((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [key]: val } : s)),
    );
  };

  // 6. Image sample upload simulator
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImageUrl(reader.result as string);
      toast.success("Image loaded for template preview");
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !title.trim() &&
      contentType !== "page_break" &&
      contentType !== "spacer"
    ) {
      toast.error("Section Title is required");
      return;
    }

    const finalTitle =
      title.trim() ||
      (contentType === "page_break"
        ? "Page Break"
        : contentType === "spacer"
          ? "Vertical Spacer"
          : "Untitled Section");

    const config: ProposalSectionConfig = {
      id: sectionToEdit?.id || `sec_${Date.now()}`,
      title: finalTitle,
      contentType,
      description: description.trim(),
      placeholder: placeholder.trim(),
      defaultContent: defaultContent.trim(),
      order: sectionToEdit?.order || 0,
      isEnabled: sectionToEdit?.isEnabled !== false,
      showSectionNumber,
      isRequired,
      allowUserDelete,
      pageBreakBefore,
      pageBreakAfter,

      defaultItems:
        contentType === "bullet_list" || contentType === "numbered_list"
          ? defaultItems.filter((it) => it.trim())
          : undefined,
      minItems:
        contentType === "bullet_list" || contentType === "numbered_list"
          ? minItems
          : undefined,
      maxItems:
        contentType === "bullet_list" || contentType === "numbered_list"
          ? maxItems
          : undefined,
      allowAddRow:
        contentType === "bullet_list" || contentType === "numbered_list"
          ? allowAddRow
          : undefined,
      allowDeleteRow:
        contentType === "bullet_list" || contentType === "numbered_list"
          ? allowDeleteRow
          : undefined,

      keyValueFields: contentType === "key_value" ? keyValueFields : undefined,

      tableTitle:
        contentType === "table" ? tableTitle.trim() || finalTitle : undefined,
      tableColumns: contentType === "table" ? tableColumns : undefined,
      allowAddTableRow: contentType === "table" ? allowAddTableRow : undefined,
      allowDeleteTableRow:
        contentType === "table" ? allowDeleteTableRow : undefined,

      subsections: contentType === "section_group" ? subsections : undefined,

      signatureFields:
        contentType === "signature" ? signatureFields : undefined,

      imageUrl: contentType === "image" ? imageUrl : undefined,
      imageCaption: contentType === "image" ? imageCaption : undefined,
      imageAlignment: contentType === "image" ? imageAlignment : undefined,
      imageMaxWidth: contentType === "image" ? imageMaxWidth : undefined,
    };

    onSave(config);
    onOpenChange(false);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-2xl p-0 flex flex-col bg-white border-l border-slate-200 overflow-hidden shadow-2xl z-50"
        >
          <SheetHeader className="p-6 bg-slate-50 border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <SheetTitle className="text-base font-black text-slate-900">
                  {sectionToEdit
                    ? `Edit ${isSubsection ? "Subsection" : "Section"}`
                    : `Configure New ${isSubsection ? "Subsection" : "Section"}`}
                </SheetTitle>
                <SheetDescription className="text-xs text-slate-500">
                  Configure specific properties for{" "}
                  {CONTENT_TYPE_INFO[contentType]?.label || "Section"}.
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <form
            onSubmit={handleSubmit}
            className="flex-1 overflow-y-auto p-6 space-y-6"
          >
            {/* Section Title */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">
                Section Title <span className="text-rose-500">*</span>
              </Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Scope of Work, Project Timeline, Commercials..."
                className="h-10 rounded-xl text-xs bg-slate-50/50 border-slate-200"
              />
            </div>

            {/* Content Type Selector */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700">
                Content Type
              </Label>
              <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1 border border-slate-100 p-2 rounded-2xl bg-slate-50/40">
                {(Object.keys(CONTENT_TYPE_INFO) as SectionContentType[])
                  .filter((t) => !isSubsection || t !== "section_group")
                  .map((typeKey) => {
                    const item = CONTENT_TYPE_INFO[typeKey];
                    const Icon = item.icon;
                    const isSelected = contentType === typeKey;

                    return (
                      <button
                        key={typeKey}
                        type="button"
                        onClick={() => setContentType(typeKey)}
                        className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-left transition-all ${
                          isSelected
                            ? "border-emerald-600 bg-emerald-50/80 text-emerald-900 shadow-sm ring-1 ring-emerald-500/20"
                            : "border-slate-200/80 bg-white hover:border-slate-300 text-slate-700"
                        }`}
                      >
                        <div
                          className={`p-1.5 rounded-lg shrink-0 ${
                            isSelected
                              ? "bg-emerald-600 text-white"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold leading-none truncate">
                            {item.label}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-1 leading-snug line-clamp-2">
                            {item.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>

            {/* 1. RICH TEXT & TEXTS */}
            {(contentType === "rich_text" ||
              contentType === "paragraph" ||
              contentType === "short_text" ||
              contentType === "long_text") && (
              <div className="space-y-4 p-4 rounded-2xl bg-slate-50/60 border border-slate-200">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-emerald-600" />
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                    {contentType === "rich_text"
                      ? "Rich Text Editor Options"
                      : "Text Input Options"}
                  </h4>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">
                    Input Placeholder
                  </Label>
                  <Input
                    value={placeholder}
                    onChange={(e) => setPlaceholder(e.target.value)}
                    placeholder="e.g. Enter detailed executive overview..."
                    className="h-9 rounded-xl text-xs bg-white border-slate-200"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">
                    Default Starting Content
                  </Label>
                  <Textarea
                    rows={3}
                    value={defaultContent}
                    onChange={(e) => setDefaultContent(e.target.value)}
                    placeholder="Template default boilerplate text rendered for proposal creators..."
                    className="rounded-xl text-xs bg-white border-slate-200 resize-none"
                  />
                </div>

                {contentType === "rich_text" && (
                  <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200 text-xs text-emerald-800 space-y-1">
                    <p className="font-bold flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-emerald-600" /> Rich
                      Text Formatting Enabled
                    </p>
                    <p className="text-[11px] text-emerald-700/90">
                      Proposal creators will receive formatting tools including
                      Bold, Italic, Underline, Bullet Lists, Numbered Lists,
                      Alignment, and Hyperlinks.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* 2. BULLET LIST & NUMBERED LIST */}
            {(contentType === "bullet_list" ||
              contentType === "numbered_list") && (
              <div className="space-y-4 p-4 rounded-2xl bg-slate-50/60 border border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {contentType === "bullet_list" ? (
                      <List className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <ListOrdered className="h-4 w-4 text-emerald-600" />
                    )}
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                      {contentType === "bullet_list"
                        ? "Bullet List Items"
                        : "Numbered List Items"}
                    </h4>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleAddDefaultItem}
                    className="h-7 text-xs rounded-xl bg-white border-slate-300"
                  >
                    <Plus className="h-3 w-3 mr-1" /> Add Item
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-700">
                    Default Items
                  </Label>
                  {defaultItems.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-xs font-mono text-slate-400 w-5 text-center">
                        {contentType === "numbered_list" ? `${idx + 1}.` : "•"}
                      </span>
                      <Input
                        value={item}
                        onChange={(e) =>
                          handleDefaultItemChange(idx, e.target.value)
                        }
                        placeholder={`Enter item ${idx + 1}...`}
                        className="h-8 text-xs bg-white rounded-lg flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleRemoveDefaultItem(idx)}
                        className="h-8 w-8 text-slate-400 hover:text-rose-600 rounded-lg"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold text-slate-700">
                      Minimum Items
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      value={minItems}
                      onChange={(e) =>
                        setMinItems(parseInt(e.target.value) || 0)
                      }
                      className="h-8 text-xs bg-white rounded-lg"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold text-slate-700">
                      Maximum Items
                    </Label>
                    <Input
                      type="number"
                      min={1}
                      value={maxItems}
                      onChange={(e) =>
                        setMaxItems(parseInt(e.target.value) || 10)
                      }
                      className="h-8 text-xs bg-white rounded-lg"
                    />
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-slate-700 font-medium cursor-pointer">
                      Allow Author to Add Row
                    </Label>
                    <Switch
                      checked={allowAddRow}
                      onCheckedChange={setAllowAddRow}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-slate-700 font-medium cursor-pointer">
                      Allow Author to Delete Row
                    </Label>
                    <Switch
                      checked={allowDeleteRow}
                      onCheckedChange={setAllowDeleteRow}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 3. KEY-VALUE FIELDS */}
            {contentType === "key_value" && (
              <div className="space-y-4 p-4 rounded-2xl bg-slate-50/60 border border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <LayoutGrid className="h-4 w-4 text-emerald-600" />
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                      Key-Value Property Fields
                    </h4>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleAddKVField}
                    className="h-7 text-xs rounded-xl bg-white border-slate-300"
                  >
                    <Plus className="h-3 w-3 mr-1" /> Add Field
                  </Button>
                </div>

                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {keyValueFields.map((field, idx) => (
                    <div
                      key={field.id}
                      className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveKVField(idx, "up")}
                            className="text-slate-400 hover:text-slate-700 disabled:opacity-20"
                          >
                            <ArrowUp className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === keyValueFields.length - 1}
                            onClick={() => handleMoveKVField(idx, "down")}
                            className="text-slate-400 hover:text-slate-700 disabled:opacity-20"
                          >
                            <ArrowDown className="h-3 w-3" />
                          </button>
                        </div>

                        <Input
                          value={field.label}
                          onChange={(e) =>
                            handleKVFieldChange(
                              field.id,
                              "label",
                              e.target.value,
                            )
                          }
                          placeholder="Field Label (e.g. Project Title)"
                          className="h-8 text-xs font-bold rounded-lg flex-1"
                        />

                        <select
                          value={field.type}
                          onChange={(e) =>
                            handleKVFieldChange(
                              field.id,
                              "type",
                              e.target.value as any,
                            )
                          }
                          className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 font-medium"
                        >
                          <option value="text">Text</option>
                          <option value="date">Date</option>
                          <option value="number">Number</option>
                          <option value="currency">Currency (₹)</option>
                          <option value="email">Email</option>
                          <option value="phone">Phone</option>
                        </select>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleRemoveKVField(field.id)}
                          className="h-8 w-8 text-slate-400 hover:text-rose-600 rounded-lg"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                        <Input
                          value={field.placeholder || ""}
                          onChange={(e) =>
                            handleKVFieldChange(
                              field.id,
                              "placeholder",
                              e.target.value,
                            )
                          }
                          placeholder="Placeholder text..."
                          className="h-7 text-[11px] bg-slate-50/50 rounded-md max-w-xs"
                        />
                        <div className="flex items-center gap-1.5">
                          <Label className="text-[11px] text-slate-600 cursor-pointer">
                            Required
                          </Label>
                          <Switch
                            checked={!!field.required}
                            onCheckedChange={(val) =>
                              handleKVFieldChange(field.id, "required", val)
                            }
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. TABLE */}
            {contentType === "table" && (
              <div className="space-y-4 p-4 rounded-2xl bg-slate-50/60 border border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Table className="h-4 w-4 text-emerald-600" />
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                      Table & Columns Schema
                    </h4>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleAddTableCol}
                    className="h-7 text-xs rounded-xl bg-white border-slate-300"
                  >
                    <Plus className="h-3 w-3 mr-1" /> Add Column
                  </Button>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">
                    Table Title
                  </Label>
                  <Input
                    value={tableTitle}
                    onChange={(e) => setTableTitle(e.target.value)}
                    placeholder="e.g. Project Timeline, Deliverables Schedule, Commercial Breakdown"
                    className="h-9 rounded-xl text-xs bg-white border-slate-200"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-700">
                    Columns Setup
                  </Label>
                  {tableColumns.map((col, idx) => (
                    <div
                      key={col.id}
                      className="flex items-center gap-2 p-2 bg-white rounded-xl border border-slate-200"
                    >
                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMoveTableCol(idx, "up")}
                          className="text-slate-400 hover:text-slate-700 disabled:opacity-20"
                        >
                          <ArrowUp className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === tableColumns.length - 1}
                          onClick={() => handleMoveTableCol(idx, "down")}
                          className="text-slate-400 hover:text-slate-700 disabled:opacity-20"
                        >
                          <ArrowDown className="h-3 w-3" />
                        </button>
                      </div>

                      <Input
                        value={col.name}
                        onChange={(e) =>
                          handleTableColChange(col.id, "name", e.target.value)
                        }
                        placeholder="Column Name"
                        className="h-8 text-xs font-semibold flex-1"
                      />

                      <select
                        value={col.type}
                        onChange={(e) =>
                          handleTableColChange(
                            col.id,
                            "type",
                            e.target.value as any,
                          )
                        }
                        className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 font-medium"
                      >
                        <option value="text">Text</option>
                        <option value="number">Number</option>
                        <option value="currency">Currency (₹)</option>
                        <option value="date">Date</option>
                      </select>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleRemoveTableCol(col.id)}
                        className="h-8 w-8 text-slate-400 hover:text-rose-600 rounded-lg"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-slate-700 font-medium cursor-pointer">
                      Allow Author to Add Rows
                    </Label>
                    <Switch
                      checked={allowAddTableRow}
                      onCheckedChange={setAllowAddTableRow}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-slate-700 font-medium cursor-pointer">
                      Allow Author to Delete Rows
                    </Label>
                    <Switch
                      checked={allowDeleteTableRow}
                      onCheckedChange={setAllowDeleteTableRow}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 5. SECTION GROUP (NESTED SUBSECTIONS) */}
            {contentType === "section_group" && (
              <div className="space-y-4 p-4 rounded-2xl bg-slate-50/60 border border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-emerald-600" />
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                      Nested Subsections ({subsections.length})
                    </h4>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingSubsection(null);
                      setSubDrawerOpen(true);
                    }}
                    className="h-7 text-xs rounded-xl bg-white border-slate-300"
                  >
                    <Plus className="h-3 w-3 mr-1" /> Add Subsection
                  </Button>
                </div>

                <div className="space-y-2">
                  {subsections.map((sub) => {
                    const subTypeInfo =
                      CONTENT_TYPE_INFO[sub.contentType] ||
                      CONTENT_TYPE_INFO.bullet_list;
                    const SubIcon = subTypeInfo.icon;
                    return (
                      <div
                        key={sub.id}
                        className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-3 shadow-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
                            <SubIcon className="h-3.5 w-3.5" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-900">
                              {sub.title}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              Type: {subTypeInfo.label}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingSubsection(sub);
                              setSubDrawerOpen(true);
                            }}
                            className="h-7 text-xs px-2 text-slate-600 hover:text-emerald-700"
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleRemoveSubsection(sub.id)}
                            className="h-7 w-7 text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 6. SIGNATURE CONFIG */}
            {contentType === "signature" && (
              <div className="space-y-4 p-4 rounded-2xl bg-slate-50/60 border border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PenTool className="h-4 w-4 text-emerald-600" />
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                      Signature Block Columns
                    </h4>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleAddSignatureCol}
                    className="h-7 text-xs rounded-xl bg-white border-slate-300"
                  >
                    <Plus className="h-3 w-3 mr-1" /> Add Column
                  </Button>
                </div>

                <div className="space-y-2">
                  {signatureFields.map((field) => (
                    <div
                      key={field.id}
                      className="flex items-center gap-2 p-2 bg-white rounded-xl border border-slate-200"
                    >
                      <Input
                        value={field.label}
                        onChange={(e) =>
                          handleSignatureColChange(
                            field.id,
                            "label",
                            e.target.value,
                          )
                        }
                        placeholder="Column Label (e.g. Name, Role, Date, Company Seal)"
                        className="h-8 text-xs font-semibold flex-1"
                      />

                      <select
                        value={field.type}
                        onChange={(e) =>
                          handleSignatureColChange(
                            field.id,
                            "type",
                            e.target.value as any,
                          )
                        }
                        className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 font-medium"
                      >
                        <option value="name">Name</option>
                        <option value="role">Role / Designation</option>
                        <option value="signature">Signature</option>
                        <option value="date">Date</option>
                        <option value="seal">Company Seal</option>
                        <option value="text">General Text</option>
                      </select>

                      <div className="flex items-center gap-1">
                        <Label className="text-[10px] text-slate-400">
                          Req
                        </Label>
                        <Switch
                          checked={!!field.required}
                          onCheckedChange={(val) =>
                            handleSignatureColChange(field.id, "required", val)
                          }
                        />
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleRemoveSignatureCol(field.id)}
                        className="h-8 w-8 text-slate-400 hover:text-rose-600 rounded-lg"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 7. IMAGE CONFIG */}
            {contentType === "image" && (
              <div className="space-y-4 p-4 rounded-2xl bg-slate-50/60 border border-slate-200">
                <div className="flex items-center gap-2">
                  <Image className="h-4 w-4 text-emerald-600" />
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                    Image Layout & Upload
                  </h4>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">
                    Upload Image / Schematic
                  </Label>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleImageFileChange}
                    className="text-xs bg-white h-9 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:bg-emerald-50 file:text-emerald-700"
                  />
                  {imageUrl && (
                    <div className="mt-2 p-2 border border-slate-200 rounded-xl bg-white max-w-xs">
                      <img
                        src={imageUrl}
                        alt="Uploaded preview"
                        className="max-h-32 rounded-lg object-contain mx-auto"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">
                    Image Caption
                  </Label>
                  <Input
                    value={imageCaption}
                    onChange={(e) => setImageCaption(e.target.value)}
                    placeholder="e.g. Figure 1.1 - Architectural Blueprint Schematic"
                    className="h-9 rounded-xl text-xs bg-white border-slate-200"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700">
                      Alignment
                    </Label>
                    <select
                      value={imageAlignment}
                      onChange={(e) => setImageAlignment(e.target.value as any)}
                      className="w-full h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 font-medium"
                    >
                      <option value="left">Left</option>
                      <option value="center">Center</option>
                      <option value="right">Right</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700">
                      Maximum Width
                    </Label>
                    <Input
                      value={imageMaxWidth}
                      onChange={(e) => setImageMaxWidth(e.target.value)}
                      placeholder="e.g. 100% or 400px"
                      className="h-9 rounded-xl text-xs bg-white border-slate-200"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 8. PAGE BREAK */}
            {contentType === "page_break" && (
              <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200 text-indigo-900 space-y-2">
                <div className="flex items-center gap-2 font-bold text-xs">
                  <Scissors className="h-4 w-4 text-indigo-600" />
                  <span>Page Break Section</span>
                </div>
                <p className="text-[11px] text-indigo-700/90 leading-relaxed">
                  Inserts a hard page break during PDF generation and export.
                  Any subsequent sections will automatically begin at the top of
                  a fresh printed page.
                </p>
              </div>
            )}

            {/* General Section Settings & Rules */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                Section Rules & Layout Flags
              </h4>

              <div className="space-y-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-200/60">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs font-bold text-slate-800 cursor-pointer">
                      Show Section Number
                    </Label>
                    <p className="text-[11px] text-slate-400">
                      Prefix with numbered hierarchy (e.g. 1.0, 2.0)
                    </p>
                  </div>
                  <Switch
                    checked={showSectionNumber}
                    onCheckedChange={setShowSectionNumber}
                  />
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <div>
                    <Label className="text-xs font-bold text-slate-800 cursor-pointer">
                      Required Section
                    </Label>
                    <p className="text-[11px] text-slate-400">
                      Must not be left blank before proposal publishing
                    </p>
                  </div>
                  <Switch
                    checked={isRequired}
                    onCheckedChange={setIsRequired}
                  />
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <div>
                    <Label className="text-xs font-bold text-slate-800 cursor-pointer">
                      Allow Author to Delete Section
                    </Label>
                    <p className="text-[11px] text-slate-400">
                      Can authors remove this block in a specific proposal
                    </p>
                  </div>
                  <Switch
                    checked={allowUserDelete}
                    onCheckedChange={setAllowUserDelete}
                  />
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <div>
                    <Label className="text-xs font-bold text-slate-800 cursor-pointer">
                      Page Break Before
                    </Label>
                    <p className="text-[11px] text-slate-400">
                      Always start this section on a new page
                    </p>
                  </div>
                  <Switch
                    checked={pageBreakBefore}
                    onCheckedChange={setPageBreakBefore}
                  />
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <div>
                    <Label className="text-xs font-bold text-slate-800 cursor-pointer">
                      Page Break After
                    </Label>
                    <p className="text-[11px] text-slate-400">
                      Push subsequent content onto the next page
                    </p>
                  </div>
                  <Switch
                    checked={pageBreakAfter}
                    onCheckedChange={setPageBreakAfter}
                  />
                </div>
              </div>
            </div>
          </form>

          <SheetFooter className="p-4 bg-slate-50 border-t border-slate-100 shrink-0 flex flex-row items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-2xl text-xs h-9 font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              style={{
                background:
                  "linear-gradient(135deg, #4D9F4B 0%, #72B84A 50%, #9FCA48 100%)",
              }}
              className="text-white font-bold rounded-2xl text-xs h-9 px-5 shadow-md hover:opacity-95"
            >
              {sectionToEdit ? "Update Section" : "Add Section"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Recursive Sub-Drawer for nested subsections in Section Group */}
      {subDrawerOpen && (
        <SectionConfigDrawer
          open={subDrawerOpen}
          onOpenChange={setSubDrawerOpen}
          sectionToEdit={editingSubsection}
          onSave={handleSaveSubsection}
          isSubsection={true}
        />
      )}
    </>
  );
}
