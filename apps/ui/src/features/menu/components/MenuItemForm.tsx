"use client";

import {
  createMenuItemSchema,
  type CreateMenuItemFormValues,
} from "@texawave-erp/core";
import type { MenuItem } from "@texawave-erp/api-types";
import {
  Button,
  Checkbox,
  FormField,
  Input,
  Select,
} from "@texawave-erp/ui-kit";
import { useState } from "react";
import { usePermissionCatalog } from "@/features/settings/roles/hooks";

export interface MenuItemFormProps {
  initialValues?: Partial<CreateMenuItemFormValues>;
  existingItems?: MenuItem[];
  currentItemId?: number;
  onSubmit: (values: CreateMenuItemFormValues) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
}

export function MenuItemForm({
  initialValues,
  existingItems = [],
  currentItemId,
  onSubmit,
  onCancel,
  submitLabel,
}: MenuItemFormProps) {
  const [code, setCode] = useState(initialValues?.code ?? "");
  const [label, setLabel] = useState(initialValues?.label ?? "");
  const [path, setPath] = useState(initialValues?.path ?? "");
  const [icon, setIcon] = useState(initialValues?.icon ?? "");
  const [order, setOrder] = useState<number>(initialValues?.order ?? 0);
  const [parentId, setParentId] = useState<number | null>(
    initialValues?.parentId ?? null,
  );
  const [permission, setPermission] = useState(initialValues?.permission ?? "");
  const [isActive, setIsActive] = useState(initialValues?.isActive ?? true);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const catalogQuery = usePermissionCatalog();
  const permissions = catalogQuery.data ?? [];

  // Exclude current item and its potential descendants from parent candidates
  const parentOptions = existingItems.filter(
    (item) => !currentItemId || item.id !== currentItemId,
  );

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const result = createMenuItemSchema.safeParse({
      code,
      label,
      path: path.trim() || undefined,
      icon: icon.trim() || undefined,
      order: Number(order) || 0,
      parentId: parentId ? Number(parentId) : null,
      permission: permission.trim() || undefined,
      isActive,
      customFields: initialValues?.customFields ?? {},
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
    setSubmitting(true);
    try {
      await onSubmit(result.data);
    } catch {
      setSubmitError("Could not save menu item. Check fields and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Code" required error={errors.code}>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              invalid={fieldProps.invalid}
              placeholder="e.g. admin-departments"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={submitting}
            />
          )}
        </FormField>

        <FormField label="Label" required error={errors.label}>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              invalid={fieldProps.invalid}
              placeholder="e.g. Departments"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              disabled={submitting}
            />
          )}
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Path (URL)" error={errors.path}>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              placeholder="e.g. /admin/departments"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              disabled={submitting}
            />
          )}
        </FormField>

        <FormField label="Icon" error={errors.icon}>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              placeholder="e.g. 🏢 or icon-name"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              disabled={submitting}
            />
          )}
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Parent Menu Item">
          {(fieldProps) => (
            <Select
              {...fieldProps}
              value={parentId ?? ""}
              onChange={(e) =>
                setParentId(e.target.value ? Number(e.target.value) : null)
              }
              disabled={submitting}
            >
              <option value="">None (Top Level)</option>
              {parentOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label} ({opt.code})
                </option>
              ))}
            </Select>
          )}
        </FormField>

        <FormField label="Display Order">
          {(fieldProps) => (
            <Input
              {...fieldProps}
              type="number"
              value={order}
              onChange={(e) => setOrder(Number(e.target.value))}
              disabled={submitting}
            />
          )}
        </FormField>
      </div>

      <FormField label="Required Permission (Optional)">
        {(fieldProps) => (
          <Select
            {...fieldProps}
            value={permission}
            onChange={(e) => setPermission(e.target.value)}
            disabled={submitting}
          >
            <option value="">Public to all authenticated users</option>
            {permissions.map((p) => (
              <option key={p.id} value={p.code}>
                {p.code} — {p.description}
              </option>
            ))}
          </Select>
        )}
      </FormField>

      <label className="flex items-center gap-2 text-theme-sm text-gray-700 dark:text-gray-300">
        <Checkbox
          checked={isActive}
          onChange={() => setIsActive((prev) => !prev)}
          disabled={submitting}
        />
        <span>Active</span>
      </label>

      {submitError ? (
        <p className="text-theme-xs text-error-600 dark:text-error-400">
          {submitError}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
