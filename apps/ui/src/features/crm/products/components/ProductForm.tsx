"use client";

import { Button } from "@/components/legacy-ui/button";
import { Input } from "@/components/legacy-ui/input";
import { Label } from "@/components/legacy-ui/label";
import { Switch } from "@/components/legacy-ui/switch";
import { Textarea } from "@/components/legacy-ui/textarea";
import {
  createProductSchema,
  type CreateProductFormValues,
} from "@texawave-erp/core";
import { Package } from "lucide-react";
import { useState } from "react";

export interface ProductFormProps {
  title: string;
  initialValues?: Partial<CreateProductFormValues> | undefined;
  onSubmit: (values: CreateProductFormValues) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
}

/** Legacy Products.tsx full-page create/edit form (two cards: the fields,
 * then the "Fields marked with * are required" footer bar). */
export function ProductForm({
  title,
  initialValues,
  onSubmit,
  onCancel,
  submitLabel,
}: ProductFormProps) {
  const [name, setName] = useState(initialValues?.name ?? "");
  const [code, setCode] = useState(initialValues?.code ?? "");
  const [category, setCategory] = useState(initialValues?.category ?? "");
  const [vendor, setVendor] = useState(initialValues?.vendor ?? "");
  const [unitPrice, setUnitPrice] = useState(
    initialValues?.unitPrice !== undefined
      ? String(initialValues.unitPrice)
      : "0",
  );
  const [taxPercent, setTaxPercent] = useState(
    initialValues?.taxPercent !== undefined
      ? String(initialValues.taxPercent)
      : "0",
  );
  const [description, setDescription] = useState(
    initialValues?.description ?? "",
  );
  const [isActive, setIsActive] = useState(initialValues?.isActive ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSave() {
    if (!name.trim() || !code.trim()) return;
    const result = createProductSchema.safeParse({
      name,
      code,
      category: category || undefined,
      vendor: vendor || undefined,
      unitPrice: unitPrice === "" ? undefined : Number(unitPrice),
      taxPercent: taxPercent === "" ? undefined : Number(taxPercent),
      description: description || undefined,
      isActive,
    });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string") fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setSubmitError(null);
    setSaving(true);
    try {
      await onSubmit(result.data);
    } catch {
      setSubmitError("Failed to save product. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const fieldError = (key: string) =>
    errors[key] ? <p className="text-xs text-red-600">{errors[key]}</p> : null;

  return (
    <>
      <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-6 space-y-5">
        <div className="flex items-center gap-2.5">
          <span className="p-2.5 bg-brand-50 text-brand-600 rounded-2xl border border-brand-200">
            <Package className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
            <p className="text-sm text-slate-400">
              Your product/service catalog — add these to Deals and Quotes as
              line items.
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-600">
              Product Name *
            </Label>
            <Input
              className="h-9 rounded-xl"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Industrial Woven Fabric Roll"
            />
            {fieldError("name")}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-600">
              Code / SKU *
            </Label>
            <Input
              className="h-9 rounded-xl"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="SKU-1001"
            />
            {fieldError("code")}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-600">Category</Label>
            <Input
              className="h-9 rounded-xl"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
            {fieldError("category")}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-600">Vendor</Label>
            <Input
              className="h-9 rounded-xl"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
            />
            {fieldError("vendor")}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-600">
              Unit Price *
            </Label>
            <Input
              className="h-9 rounded-xl"
              type="number"
              min={0}
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
            />
            {fieldError("unitPrice")}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-600">Tax %</Label>
            <Input
              className="h-9 rounded-xl"
              type="number"
              min={0}
              value={taxPercent}
              onChange={(e) => setTaxPercent(e.target.value)}
            />
            {fieldError("taxPercent")}
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs font-bold text-slate-600">
              Description
            </Label>
            <Textarea
              rows={2}
              className="rounded-xl"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            {fieldError("description")}
          </div>
          <div className="md:col-span-2 flex items-center justify-between rounded-xl border border-slate-200 p-3">
            <Label className="text-sm">Active</Label>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>
        {submitError && <p className="text-sm text-red-600">{submitError}</p>}
      </div>

      <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-4 flex items-center justify-between flex-wrap gap-3">
        <div className="text-sm text-slate-400">
          Fields marked with * are required.
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="rounded-xl border-red-200 text-red-600 bg-red-50/50 hover:text-red-700 hover:border-red-400 hover:bg-red-100"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            className="rounded-xl"
            onClick={() => void handleSave()}
            disabled={!name.trim() || !code.trim() || saving}
          >
            {saving ? "Saving…" : submitLabel}
          </Button>
        </div>
      </div>
    </>
  );
}
