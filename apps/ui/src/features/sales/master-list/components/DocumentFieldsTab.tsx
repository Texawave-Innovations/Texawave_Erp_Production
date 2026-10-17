"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  DeleteConfirmDialog,
  Dialog,
  ErrorState,
  FormField,
  Input,
  Skeleton,
  StatusBadge,
  Textarea,
  useToast,
} from "@texawave-erp/ui-kit";
import { useFormValidation } from "@/hooks/useFormValidation";
import { usePermission } from "@/hooks/usePermission";
import { SALES_PERMISSIONS } from "../../permissions";
import { useMasterOptions } from "../../shared/hooks";
import { optionImagePath } from "../api";
import {
  useCreateOption,
  useDeleteOption,
  useFieldLayout,
  useUpdateOption,
  useUploadOptionImage,
} from "../hooks";
import {
  optionSchema,
  optionToBody,
  optionToForm,
  type OptionValues,
} from "../schema";
import {
  DOCUMENT_TYPE_LABEL,
  FIELD_LABEL,
  type MasterField,
  type MasterOption,
} from "../types";
import { AuthImage } from "./AuthImage";
import { ImageUploadButton } from "./ImageUploadButton";

/** Long texts (terms) get a textarea; the rest a single line. */
const MULTILINE: readonly MasterField[] = [
  "DELIVERY_TERMS",
  "PAYMENT_TERMS",
  "VALIDITY",
];

function OptionDialog({
  field,
  option,
  onClose,
}: {
  field: MasterField;
  option: MasterOption | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const create = useCreateOption();
  const update = useUpdateOption();
  const schema = useMemo(() => optionSchema(field), [field]);
  const [values, setValues] = useState<OptionValues>(() =>
    optionToForm(option),
  );
  const [error, setError] = useState<string | null>(null);
  const { errorFor, touch, changed, validateAll } = useFormValidation(
    schema,
    values,
  );
  const saving = create.isPending || update.isPending;
  const noun = FIELD_LABEL[field].toLowerCase();

  function set<K extends keyof OptionValues>(k: K, v: OptionValues[K]) {
    changed(String(k));
    setValues((s) => ({ ...s, [k]: v }));
  }

  const line = (
    k: "label" | "value" | "bankName" | "accountNumber" | "branch" | "ifsc",
    label: string,
    opts: {
      required?: boolean;
      max: number;
      numeric?: boolean;
      upper?: boolean;
      hint?: string;
    },
  ) => (
    <FormField
      label={label}
      required={opts.required ?? false}
      errorVariant="bubble"
      error={errorFor(k)}
      hint={opts.hint}
    >
      {(f) => (
        <Input
          {...f}
          maxLength={opts.max}
          inputMode={opts.numeric ? "numeric" : undefined}
          value={values[k]}
          disabled={saving}
          onBlur={() => touch(k)}
          onChange={(e) =>
            set(k, opts.upper ? e.target.value.toUpperCase() : e.target.value)
          }
        />
      )}
    </FormField>
  );

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!validateAll()) return;
    setError(null);
    const body = optionToBody(field, values);
    try {
      if (option) await update.mutateAsync({ id: option.id, body });
      else await create.mutateAsync({ field, ...body });
      toast({
        title: option ? "Option saved" : "Option added",
        variant: "success",
      });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save.");
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={`${option ? "Edit" : "Add"} ${noun}`}
    >
      <form onSubmit={save} noValidate className="flex flex-col gap-4">
        {error ? (
          <Alert variant="error" title="Not saved">
            {error}
          </Alert>
        ) : null}
        {field === "HSN_CODE" ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[10rem_1fr]">
            {line("value", "HSN code", {
              required: true,
              max: 8,
              numeric: true,
            })}
            {line("label", "Description", {
              max: 200,
              hint: "Blank shows the code.",
            })}
          </div>
        ) : field === "BANK_ACCOUNT" ? (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {line("bankName", "Bank name", { required: true, max: 150 })}
              {line("accountNumber", "Account number", {
                required: true,
                max: 20,
                numeric: true,
              })}
              {line("ifsc", "IFSC", { required: true, max: 11, upper: true })}
              {line("branch", "Branch", { max: 150 })}
            </div>
            {line("label", "Shown as", {
              max: 200,
              hint: "Blank: Bank - Account (Branch).",
            })}
          </>
        ) : MULTILINE.includes(field) ? (
          <FormField
            label="Text"
            required
            errorVariant="bubble"
            error={errorFor("label")}
          >
            {(f) => (
              <Textarea
                {...f}
                rows={3}
                maxLength={200}
                value={values.label}
                disabled={saving}
                onBlur={() => touch("label")}
                onChange={(e) => set("label", e.target.value)}
              />
            )}
          </FormField>
        ) : (
          line("label", field === "PREPARED_BY" ? "Name" : "Label", {
            required: true,
            max: field === "PAYMENT_MODE" ? 50 : 200,
          })
        )}
        <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2">
          <FormField
            label="Sort order"
            errorVariant="bubble"
            error={errorFor("sortOrder")}
          >
            {(f) => (
              <Input
                {...f}
                inputMode="numeric"
                maxLength={4}
                value={values.sortOrder}
                disabled={saving}
                onBlur={() => touch("sortOrder")}
                onChange={(e) => set("sortOrder", e.target.value)}
              />
            )}
          </FormField>
          <label className="flex items-center gap-2 pb-2 text-theme-sm text-gray-700 dark:text-gray-300">
            <Checkbox
              checked={values.isDefault}
              disabled={saving}
              onChange={(e) => set("isDefault", e.target.checked)}
            />
            Default on new documents
          </label>
        </div>
        {field === "COMPANY_SEAL" || field === "AUTHORIZED_SIGNATURE" ? (
          <p className="text-theme-xs text-gray-500 dark:text-gray-400">
            Upload the image from the list after saving.
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            {option ? "Save option" : "Add option"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function OptionRow({
  option,
  hasImage,
  canWrite,
  onEdit,
  onDelete,
}: {
  option: MasterOption;
  hasImage: boolean;
  canWrite: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const upload = useUploadOptionImage();
  const secondary =
    option.field === "BANK_ACCOUNT" && option.bankDetails?.ifsc
      ? `IFSC ${option.bankDetails.ifsc}`
      : null;
  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      {hasImage ? (
        <div className="flex h-16 w-24 items-center justify-center rounded-lg border border-gray-200 bg-white p-1 dark:border-gray-800">
          {option.hasImage ? (
            <AuthImage
              path={optionImagePath(option.id)}
              // Refetched after this row uploads a new image.
              version={String(upload.submittedAt)}
              alt={option.label}
              className="max-h-14 w-auto max-w-full object-contain"
            />
          ) : (
            <span className="text-theme-xs text-gray-400">No image</span>
          )}
        </div>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="text-theme-sm font-medium break-words text-gray-900 dark:text-white/90">
          {option.field === "HSN_CODE" && option.label !== option.value
            ? `${option.value} — ${option.label}`
            : option.label}
        </p>
        {secondary ? (
          <p className="text-theme-xs text-gray-500 dark:text-gray-400">
            {secondary}
          </p>
        ) : null}
      </div>
      {option.isDefault ? (
        <StatusBadge label="Default" colorToken="success" />
      ) : null}
      {canWrite ? (
        <div className="flex gap-1">
          {hasImage ? (
            <ImageUploadButton
              label={option.hasImage ? "Replace image" : "Upload image"}
              ariaLabel={`Image for ${option.label}`}
              onUpload={(file) => upload.mutateAsync({ id: option.id, file })}
            />
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Edit ${option.label}`}
            onClick={onEdit}
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Delete ${option.label}`}
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      ) : null}
    </li>
  );
}

/**
 * The choices the document forms offer (validity, terms, HSN codes, bank
 * accounts, seals and signatures with images, prepared-by, payment modes).
 * Each field has one list, shared by every document that has the field, so
 * an option is added once. Issued documents keep what they copied.
 */
export function DocumentFieldsTab() {
  const { toast } = useToast();
  const canWrite = usePermission(SALES_PERMISSIONS.masterWrite);
  const layout = useFieldLayout();
  const options = useMasterOptions();
  const remove = useDeleteOption();
  const [editing, setEditing] = useState<{
    field: MasterField;
    option: MasterOption | null;
  } | null>(null);
  const [deleting, setDeleting] = useState<MasterOption | null>(null);

  if (layout.isPending || options.isPending) {
    return <Skeleton className="h-96 w-full" />;
  }
  if (layout.isError || options.isError) {
    return (
      <ErrorState
        onRetry={() => {
          void layout.refetch();
          void options.refetch();
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-theme-sm text-gray-600 dark:text-gray-400">
        Each option is offered on every document listed under its field. The
        default option is pre-selected on new documents. Editing or deleting an
        option does not change documents already issued.
      </p>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {layout.data.map(({ field, hasImage, documentTypes }) => {
          const list = options.byField(field);
          return (
            <Card
              key={field}
              className="flex flex-col gap-2"
              aria-label={FIELD_LABEL[field]}
              role="region"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 flex-col gap-1.5">
                  <h3 className="text-theme-base font-semibold text-gray-900 dark:text-white/90">
                    {FIELD_LABEL[field]}
                  </h3>
                  <ul
                    className="flex flex-wrap gap-1"
                    aria-label={`${FIELD_LABEL[field]} are used on`}
                  >
                    {documentTypes.map((d) => (
                      <li
                        key={d}
                        className="rounded-full bg-gray-100 px-2 py-0.5 text-theme-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                      >
                        {DOCUMENT_TYPE_LABEL[d]}
                      </li>
                    ))}
                  </ul>
                </div>
                {canWrite ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    aria-label={`Add ${FIELD_LABEL[field].toLowerCase()}`}
                    onClick={() => setEditing({ field, option: null })}
                  >
                    <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
                    Add
                  </Button>
                ) : null}
              </div>
              {list.length === 0 ? (
                <p className="py-3 text-theme-sm text-gray-500 dark:text-gray-400">
                  No options yet.
                </p>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                  {list.map((o) => (
                    <OptionRow
                      key={o.id}
                      option={o}
                      hasImage={hasImage}
                      canWrite={canWrite}
                      onEdit={() => setEditing({ field, option: o })}
                      onDelete={() => setDeleting(o)}
                    />
                  ))}
                </ul>
              )}
            </Card>
          );
        })}
      </div>
      {editing ? (
        <OptionDialog
          field={editing.field}
          option={editing.option}
          onClose={() => setEditing(null)}
        />
      ) : null}
      <DeleteConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await remove.mutateAsync(deleting.id);
            toast({ title: "Option deleted", variant: "success" });
          } catch (e) {
            toast({
              title: e instanceof ApiError ? e.message : "Could not delete",
              variant: "error",
            });
          } finally {
            setDeleting(null);
          }
        }}
        title="Delete option"
        itemName={deleting?.label ?? ""}
        description="It is removed from every document. Documents already issued keep printing it."
        loading={remove.isPending}
      />
    </div>
  );
}
