import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/modules/scm/shared/components/ScmButton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/modules/scm/shared/components/ScmTable";
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
  BadgeAlert,
  Pencil,
  Ban,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import {
  ALL,
  DEFECT_CATEGORIES,
  DEFECT_SEVERITIES,
  SEVERITY_TONE,
} from "./qualityHelpers";
import { useQualityData } from "./useQualityData";
import {
  createDefect,
  setDefectActive,
  updateDefect,
} from "./qualityMasterService";
import { errorMessage, formatStatusLabel } from "@/modules/scm/shared/format";
import type {
  ScmQualityDefect,
  ScmQualityDefectCategory,
  ScmQualityDefectSeverity,
} from "@/types";
import { actorName } from "@/modules/scm/shared/actor";

export default function ScmQualityDefects() {
  const { user } = useAuth();
  const performedBy = actorName(user);
  const { loading, error, defects, reload } = useQualityData();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState(ALL);
  const [activeOnly, setActiveOnly] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ScmQualityDefect | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ScmQualityDefectCategory>("PRODUCT");
  const [severity, setSeverity] = useState<ScmQualityDefectSeverity>("MEDIUM");
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    return defects.filter((d) => {
      if (activeOnly && !d.active) return false;
      if (categoryFilter !== ALL && d.category !== categoryFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (!`${d.defectCode} ${d.name}`.toLowerCase().includes(q))
          return false;
      }
      return true;
    });
  }, [defects, activeOnly, categoryFilter, search]);

  const openCreate = () => {
    setEditing(null);
    setCode("");
    setName("");
    setDescription("");
    setCategory("PRODUCT");
    setSeverity("MEDIUM");
    setDialogOpen(true);
  };

  const openEdit = (d: ScmQualityDefect) => {
    setEditing(d);
    setCode(d.defectCode);
    setName(d.name);
    setDescription(d.description || "");
    setCategory(d.category);
    setSeverity(d.severity);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setBusy(true);
    try {
      if (editing) {
        await updateDefect(
          editing,
          { name: name.trim(), description, category, severity },
          performedBy,
        );
        toast.success("Defect updated");
      } else {
        await createDefect(
          { defectCode: code, name, description, category, severity },
          performedBy,
        );
        toast.success("Defect created");
      }
      setDialogOpen(false);
      reload();
    } catch (err) {
      toast.error(errorMessage(err, "Failed to save defect"));
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (d: ScmQualityDefect) => {
    try {
      await setDefectActive(d, !d.active, performedBy);
      toast.success(d.active ? "Defect deactivated" : "Defect activated");
      reload();
    } catch (err) {
      toast.error(errorMessage(err, "Failed to update defect"));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Defect Master</h2>
          <p className="text-muted-foreground mt-1">
            QC defect codes, categories and severity — reused across every
            inspection type.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" /> New Defect
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
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full md:w-52">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All Categories</SelectItem>
              {DEFECT_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {formatStatusLabel(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => setActiveOnly((v) => !v)}>
            {activeOnly ? "Showing Active Only" : "Showing All"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-16 text-muted-foreground">
              Loading defects...
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
              <BadgeAlert className="h-10 w-10 text-muted-foreground/40" />
              <div>No defects defined yet.</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-mono text-xs">
                        {d.defectCode}
                      </TableCell>
                      <TableCell>
                        {d.name}
                        {d.description && (
                          <div className="text-xs text-muted-foreground">
                            {d.description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{formatStatusLabel(d.category)}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={SEVERITY_TONE[d.severity]}
                        >
                          {d.severity}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            d.active
                              ? "text-emerald-600 border-emerald-200 bg-emerald-50"
                              : "text-slate-500 border-slate-200 bg-slate-50"
                          }
                        >
                          {d.active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEdit(d)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleActive(d)}
                          >
                            {d.active ? (
                              <Ban className="h-3.5 w-3.5" />
                            ) : (
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Defect" : "New Defect"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Defect Code *</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                disabled={!!editing}
                placeholder="e.g. DEF-SCRATCH"
              />
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select
                  value={category}
                  onValueChange={(v) =>
                    setCategory(v as ScmQualityDefectCategory)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DEFECT_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {formatStatusLabel(c)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Severity</Label>
                <Select
                  value={severity}
                  onValueChange={(v) =>
                    setSeverity(v as ScmQualityDefectSeverity)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DEFECT_SEVERITIES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
              disabled={busy || !name.trim() || (!editing && !code.trim())}
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
