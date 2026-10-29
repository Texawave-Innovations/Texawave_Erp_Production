"use client";

import type {
  CreateInspectionInput,
  QualityInspectionType,
} from "@texawave-erp/api-types";
import {
  INSPECTION_TYPES,
  INSPECTION_TYPE_LABEL,
} from "@texawave-erp/api-types";
import { Button, Input, Select } from "@texawave-erp/ui-kit";
import { useState } from "react";
import { useMasterListItems } from "../../master-list-items/hooks";
import { ProductSelect, WarehouseSelect } from "../../shared/masters";
import { errorText } from "../../shared/use-list-controls";
import { useInspectionSources, useTemplates } from "../hooks";

import { ScmPanel } from "../../shared/ScmPanel";
export function InspectionForm({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: CreateInspectionInput) => Promise<void>;
}) {
  return (
    <ScmPanel open={open} onClose={onClose} title="New QC Inspection" size="lg">
      {open ? <Body onClose={onClose} onSubmit={onSubmit} /> : null}
    </ScmPanel>
  );
}

function Body({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (input: CreateInspectionInput) => Promise<void>;
}) {
  const [inspectionType, setInspectionType] = useState<QualityInspectionType>(
    INSPECTION_TYPES[0],
  );
  const [sourceId, setSourceId] = useState("");
  const [productId, setProductId] = useState<number | "">("");
  const [warehouseId, setWarehouseId] = useState<number | "">("");
  const [quantity, setQuantity] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [priority, setPriority] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const priorities = useMasterListItems({
    category: "quality_inspection_priority",
    page: 1,
    limit: 100,
  });
  const priorityOptions = priorities.data?.data ?? [];
  const sources = useInspectionSources(
    inspectionType === "INVENTORY" ? null : inspectionType,
  );
  const templates = useTemplates({
    page: 1,
    limit: 100,
    inspectionType,
    active: true,
  });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!priority) return setError("Select a priority");
    const input: CreateInspectionInput = {
      inspectionType,
      priority,
      templateId: templateId ? Number(templateId) : undefined,
    };
    if (inspectionType === "INVENTORY") {
      if (!productId || !warehouseId || !(Number(quantity) > 0)) {
        return setError(
          "Select a product, warehouse and a quantity greater than zero",
        );
      }
      input.productId = productId;
      input.warehouseId = warehouseId;
      input.quantity = Number(quantity);
    } else {
      if (!sourceId) return setError("Select a source document");
      input.sourceId = Number(sourceId);
    }
    setError(null);
    setBusy(true);
    try {
      await onSubmit(input);
    } catch (err) {
      setError(errorText(err, "Failed to create inspection"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Select
        aria-label="Inspection type"
        value={inspectionType}
        onChange={(e) => {
          setInspectionType(e.target.value as QualityInspectionType);
          setSourceId("");
          setTemplateId("");
        }}
      >
        {INSPECTION_TYPES.map((t) => (
          <option key={t} value={t}>
            {INSPECTION_TYPE_LABEL[t]}
          </option>
        ))}
      </Select>
      {inspectionType === "INVENTORY" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <WarehouseSelect
            aria-label="Warehouse"
            value={warehouseId}
            onChange={setWarehouseId}
          />
          <ProductSelect
            aria-label="Product"
            value={productId}
            onChange={setProductId}
          />
          <Input
            type="number"
            min={0}
            step={0.001}
            aria-label="Quantity to inspect"
            placeholder="Quantity to inspect"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>
      ) : (
        <Select
          aria-label="Source document"
          value={sourceId}
          onChange={(e) => setSourceId(e.target.value)}
        >
          <option value="">Select a source document</option>
          {(sources.data ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.number} {s.party ? `— ${s.party}` : ""}
            </option>
          ))}
        </Select>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select
          aria-label="QC template"
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
        >
          <option value="">No template (no checkpoints)</option>
          {(templates.data?.data ?? []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.templateCode} — {t.name}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Priority"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
        >
          <option value="">Select a priority</option>
          {priorityOptions.map((p) => (
            <option key={p.id} value={p.value}>
              {p.value}
            </option>
          ))}
        </Select>
      </div>
      {error ? (
        <p
          role="alert"
          className="text-theme-xs text-error-600 dark:text-error-400"
        >
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onClose}
          disabled={busy}
        >
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          Create Inspection
        </Button>
      </div>
    </form>
  );
}
