import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ref, push, set } from "firebase/database";
import { database, getAllRecords } from "@/services/firebase";
import { ProposalTemplate, TemplateStatus } from "../proposalTypes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Layers, Plus, Loader2 } from "lucide-react";

interface CreateTemplateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (templateId: string) => void;
}

export default function CreateTemplateModal({
  open,
  onOpenChange,
  onCreated,
}: CreateTemplateModalProps) {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [department, setDepartment] = useState("");
  const [version, setVersion] = useState("V1");
  const [status, setStatus] = useState<TemplateStatus>("active");
  const [submitting, setSubmitting] = useState(false);

  // Departments from HR master
  const [departments, setDepartments] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      getAllRecords("master/hr/departments").then((deps: any[]) => {
        if (deps && deps.length > 0) {
          setDepartments(
            deps.map((d) => d.name || d.departmentName).filter(Boolean),
          );
        } else {
          setDepartments([
            "Mechanical Engineering",
            "Software Development",
            "Electrical Engineering",
            "Civil Engineering",
            "Consulting & Services",
            "Marketing & Sales",
          ]);
        }
      });
    }
  }, [open]);

  const handleNameChange = (val: string) => {
    setName(val);
    if (!code || code === generateCode(name)) {
      setCode(generateCode(val));
    }
  };

  const generateCode = (text: string) => {
    const cleaned = text
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9\s]/g, "")
      .split(/\s+/)
      .map((w) => w.slice(0, 4))
      .join("-");
    return cleaned ? `${cleaned}-PROP` : "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Template Name is required");
      return;
    }
    if (!code.trim()) {
      toast.error("Template Code is required");
      return;
    }

    setSubmitting(true);
    try {
      const newRef = push(ref(database, "proposal_templates"));
      const templateId = newRef.key!;
      const now = new Date().toISOString();

      const newTemplate: ProposalTemplate = {
        id: templateId,
        name: name.trim(),
        code: code.trim().toUpperCase(),
        title: name.trim(),
        description: description.trim(),
        department: department.trim() || "General",
        category: department.trim() || "General",
        version: version.trim() || "V1",
        version_number: 1,
        status,
        sections: [],
        createdBy: "Admin",
        createdByName: "Admin",
        createdAt: now,
        ...(status === "active" ? { published_at: now, publishedAt: now } : {}),
        updatedAt: now,
      };

      await set(newRef, newTemplate);
      toast.success("Template created successfully! Opening builder...");
      onOpenChange(false);

      if (onCreated) {
        onCreated(templateId);
      } else {
        navigate(`/projects/proposals/templates/${templateId}/builder`);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to create template");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setName("");
    setCode("");
    setDescription("");
    setDepartment("");
    setVersion("V1");
    setStatus("active");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (!val) resetForm();
        onOpenChange(val);
      }}
    >
      <DialogContent className="sm:max-w-[550px] rounded-3xl p-6 border-slate-200 shadow-2xl">
        <DialogHeader className="space-y-1 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-black text-slate-900">
                Create Proposal Template
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Setup template metadata. You will configure sections and table
                columns next.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Template Name */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">
              Template Name <span className="text-rose-500">*</span>
            </Label>
            <Input
              required
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Mechanical Engineering Proposal"
              className="h-10 rounded-xl text-xs bg-slate-50/50 border-slate-200"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Template Code */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">
                Template Code <span className="text-rose-500">*</span>
              </Label>
              <Input
                required
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. MECH-PROP"
                className="h-10 rounded-xl text-xs font-mono bg-slate-50/50 border-slate-200"
              />
            </div>

            {/* Version */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">
                Version <span className="text-rose-500">*</span>
              </Label>
              <Input
                required
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="e.g. V1 or V1.0"
                className="h-10 rounded-xl text-xs bg-slate-50/50 border-slate-200"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Department / Category */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">
                Department / Category
              </Label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Select Department / Category</option>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Status</Label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">
              Description
            </Label>
            <Textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief summary of what this proposal template covers..."
              className="rounded-xl text-xs bg-slate-50/50 border-slate-200 resize-none"
            />
          </div>

          <DialogFooter className="gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-2xl text-xs h-9 font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              style={{
                background:
                  "linear-gradient(135deg, #4D9F4B 0%, #72B84A 50%, #9FCA48 100%)",
              }}
              className="text-white font-bold rounded-2xl text-xs h-9 px-5 shadow-md hover:opacity-95"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />{" "}
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> Create & Open Builder
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
