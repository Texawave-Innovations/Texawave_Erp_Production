// src/modules/projects/mom/components/CreateMomTemplateModal.tsx

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { createMomTemplate } from "../services/momTemplateService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Layers, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface CreateMomTemplateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (templateId: string) => void;
}

export const CreateMomTemplateModal: React.FC<CreateMomTemplateModalProps> = ({
  open,
  onOpenChange,
  onCreated,
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [category, setCategory] = useState("Engineering & Product Operations");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
    return cleaned ? `MOM-${cleaned}` : "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Template Name is required");
      return;
    }

    setSubmitting(true);
    try {
      const created = await createMomTemplate(
        {
          name: name.trim(),
          code: (code || generateCode(name)).trim().toUpperCase(),
          category,
          description: description.trim(),
        },
        user,
      );

      toast.success(`Template "${created.name}" created in Draft status`);
      onOpenChange(false);
      if (onCreated) {
        onCreated(created.id);
      } else {
        navigate(`/projects/mom/templates/${created.id}/builder`);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to create template");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl p-6 bg-card border-border">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Layers className="h-4 w-4" />
            </div>
            <DialogTitle className="text-base font-bold text-foreground">
              Create Meeting Template
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Configure a reusable Minutes of Meeting structure with custom
            sections and default topics.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-foreground">
              Template Name *
            </Label>
            <Input
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Client Technical Review MoM"
              className="text-xs h-9 rounded-xl"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-foreground">
              Template Code
            </Label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. MOM-CLIENT-REV"
              className="text-xs h-9 rounded-xl font-mono uppercase"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-foreground">
              Category
            </Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="text-xs h-9 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Engineering & Product Operations">
                  Engineering & Product Operations
                </SelectItem>
                <SelectItem value="Client & Stakeholder Management">
                  Client & Stakeholder Management
                </SelectItem>
                <SelectItem value="Internal Sprint & Agile Reviews">
                  Internal Sprint & Agile Reviews
                </SelectItem>
                <SelectItem value="Executive & Board Governance">
                  Executive & Board Governance
                </SelectItem>
                <SelectItem value="Quality & Compliance Audits">
                  Quality & Compliance Audits
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-foreground">
              Description
            </Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the intended purpose and cadence for this meeting structure..."
              className="text-xs min-h-[70px] rounded-xl resize-y"
            />
          </div>

          <DialogFooter className="pt-2 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="rounded-xl text-xs font-bold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={submitting || !name.trim()}
              style={{
                background:
                  "linear-gradient(135deg, #4D9F4B 0%, #72B84A 50%, #9FCA48 100%)",
              }}
              className="text-white font-bold rounded-xl text-xs shadow-xs"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />{" "}
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> Continue to Builder
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
