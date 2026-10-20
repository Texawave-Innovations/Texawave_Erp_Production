import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/modules/scm/shared/components/ScmButton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Search,
  Plus,
  ClipboardCheck,
  Pencil,
  Ban,
  CheckCircle2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { ALL, INSPECTION_TYPES, INSPECTION_TYPE_LABEL } from "./qualityHelpers";
import { useQualityData } from "./useQualityData";
import {
  createTemplate,
  setTemplateActive,
  updateTemplate,
} from "./qualityMasterService";
import { errorMessage } from "@/modules/scm/shared/format";
import type {
  ScmQualityCheckpoint,
  ScmQualityInspectionType,
  ScmQualityTemplate,
} from "@/types";
import { actorName } from "@/modules/scm/shared/actor";

type DraftCheckpoint = Omit<ScmQualityCheckpoint, "checkpointId">;

export default function ScmQualityTemplates() {
  const { user } = useAuth();
  const performedBy = actorName(user);
  const { loading, error, templates, reload } = useQualityData();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState(ALL);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ScmQualityTemplate | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [inspectionType, setInspectionType] =
    useState<ScmQualityInspectionType>("INCOMING");
  const [checkpoints, setCheckpoints] = useState<DraftCheckpoint[]>([]);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    return templates.filter((t) => {
      if (typeFilter !== ALL && t.inspectionType !== typeFilter) return false;
      if (
        search.trim() &&
        !`${t.templateCode} ${t.name}`
          .toLowerCase()
          .includes(search.trim().toLowerCase())
      )
        return false;
      return true;
    });
  }, [templates, typeFilter, search]);

  const openCreate = () => {
    setEditing(null);
    setCode("");
    setName("");
    setDescription("");
    setInspectionType("INCOMING");
    setCheckpoints([{ name: "", required: true, sequence: 1 }]);
    setDialogOpen(true);
  };

  const openEdit = (t: ScmQualityTemplate) => {
    setEditing(t);
    setCode(t.templateCode);
    setName(t.name);
    setDescription(t.description || "");
    setInspectionType(t.inspectionType);
    setCheckpoints(t.checkpoints.map((c) => ({ ...c })));
    setDialogOpen(true);
  };

  const addCheckpoint = () =>
    setCheckpoints((cs) => [
      ...cs,
      { name: "", required: false, sequence: cs.length + 1 },
    ]);
  const removeCheckpoint = (idx: number) =>
    setCheckpoints((cs) => cs.filter((_, i) => i !== idx));
  const updateCheckpoint = (idx: number, patch: Partial<DraftCheckpoint>) =>
    setCheckpoints((cs) =>
      cs.map((c, i) => (i === idx ? { ...c, ...patch } : c)),
    );

  const handleSave = async () => {
    setBusy(true);
    try {
      const validCheckpoints = checkpoints.filter((c) => c.name.trim());
      if (editing) {
        await updateTemplate(
          editing,
          {
            name: name.trim(),
            description,
            checkpoints: validCheckpoints.map((c, i) => ({
              ...c,
              checkpointId:
                (editing.checkpoints[i] as ScmQualityCheckpoint | undefined)
                  ?.checkpointId || `cp_${Date.now().toString(36)}_${i}`,
            })),
          },
          performedBy,
        );
        toast.success("Template updated");
      } else {
        await createTemplate(
          {
            templateCode: code,
            name,
            description,
            inspectionType,
            checkpoints: validCheckpoints,
          },
          performedBy,
        );
        toast.success("Template created");
      }
      setDialogOpen(false);
      reload();
    } catch (err) {
      toast.error(errorMessage(err, "Failed to save template"));
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (t: ScmQualityTemplate) => {
    try {
      await setTemplateActive(t, !t.active, performedBy);
      toast.success(t.active ? "Template deactivated" : "Template activated");
      reload();
    } catch (err) {
      toast.error(errorMessage(err, "Failed to update template"));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">QC Templates</h2>
          <p className="text-muted-foreground mt-1">
            Reusable checkpoint checklists for each inspection type.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" /> New Template
        </Button>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <Card>
        <CardContent className="pt-6 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search code or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full md:w-52">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All Types</SelectItem>
              {INSPECTION_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {INSPECTION_TYPE_LABEL[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">
          Loading templates...
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
            <ClipboardCheck className="h-10 w-10 text-muted-foreground/40" />
            <div>No QC templates defined yet.</div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((t) => (
            <Card key={t.id}>
              <CardHeader className="pb-3 flex flex-row items-start justify-between">
                <div>
                  <div className="font-semibold">{t.name}</div>
                  <div className="text-xs text-muted-foreground font-mono">
                    {t.templateCode} · {INSPECTION_TYPE_LABEL[t.inspectionType]}
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={
                    t.active
                      ? "text-emerald-600 border-emerald-200 bg-emerald-50"
                      : "text-slate-500 border-slate-200 bg-slate-50"
                  }
                >
                  {t.active ? "Active" : "Inactive"}
                </Badge>
              </CardHeader>
              <CardContent>
                {t.description && (
                  <p className="text-sm text-muted-foreground mb-2">
                    {t.description}
                  </p>
                )}
                <div className="space-y-1 text-sm">
                  {[...t.checkpoints]
                    .sort((a, b) => a.sequence - b.sequence)
                    .map((c) => (
                      <div
                        key={c.checkpointId}
                        className="flex items-center justify-between border-b last:border-0 pb-1 last:pb-0"
                      >
                        <span>{c.name}</span>
                        {c.required && (
                          <Badge
                            variant="outline"
                            className="text-amber-600 border-amber-200 bg-amber-50 text-[10px]"
                          >
                            Required
                          </Badge>
                        )}
                      </div>
                    ))}
                </div>
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEdit(t)}
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toggleActive(t)}
                  >
                    {t.active ? (
                      <>
                        <Ban className="h-3.5 w-3.5 mr-1" /> Deactivate
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Activate
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Template" : "New Template"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Template Code *</Label>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  disabled={!!editing}
                  placeholder="e.g. QC-INCOMING-01"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Inspection Type</Label>
                <Select
                  value={inspectionType}
                  onValueChange={(v) =>
                    setInspectionType(v as ScmQualityInspectionType)
                  }
                  disabled={!!editing}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INSPECTION_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {INSPECTION_TYPE_LABEL[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Checkpoints *</Label>
                <Button size="sm" variant="outline" onClick={addCheckpoint}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add
                </Button>
              </div>
              {checkpoints.map((cp, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 border rounded-md p-2"
                >
                  <Input
                    className="flex-1"
                    placeholder="Checkpoint name"
                    value={cp.name}
                    onChange={(e) =>
                      updateCheckpoint(idx, { name: e.target.value })
                    }
                  />
                  <div className="flex items-center gap-1 shrink-0">
                    <Checkbox
                      checked={cp.required}
                      onCheckedChange={(v) =>
                        updateCheckpoint(idx, { required: !!v })
                      }
                    />
                    <span className="text-xs text-muted-foreground">Req.</span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeCheckpoint(idx)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              disabled={
                busy ||
                !name.trim() ||
                (!editing && !code.trim()) ||
                checkpoints.filter((c) => c.name.trim()).length === 0
              }
              onClick={handleSave}
            >
              {busy ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
