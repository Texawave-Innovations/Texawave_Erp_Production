"use client";

import { useState } from "react";
import { Alert } from "../alert/index";
import { Button } from "../button/index";
import { Card } from "../card/index";
import { ErrorState } from "../error-state/index";
import { Input } from "../input/index";
import { Skeleton } from "../skeleton/index";

export interface MasterListCardItem {
  id: number | string;
  /** Fully-formatted chip text (caller composes value + any suffix, e.g.
   * "18% (GST Rate)" or "Casual leave"). Kept generic on purpose so this
   * component has no knowledge of any one feature's row shape. */
  label: string;
}

export interface MasterListCardProps {
  title: string;
  items: MasterListCardItem[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  /** Whether the current user can see this card's data at all. When
   * `false`, a permission-denied alert is rendered instead of the list. */
  canRead: boolean;
  /** Whether the current user can add/remove items. When `false`, the list
   * renders read-only (no add form, no delete buttons). */
  canWrite: boolean;
  /** Permission code shown in the "no access" message — for user guidance
   * only; the API remains the source of truth for enforcement. */
  readPermissionCode: string;
  writePermissionCode: string;
  isSubmitting: boolean;
  onAdd: (value: string, numericValue?: number) => Promise<void>;
  onDelete: (id: number | string, label: string) => Promise<void>;
  /** `true` shows an extra numeric input alongside the text input (e.g. a
   * GST percentage). */
  showNumericValue?: boolean;
  numericSuffix?: string;
  addValuePlaceholder?: string;
  emptyDescription?: string;
}

/** Generic "add/delete chip" card: a title, a list of pill-shaped chips each
 * with a delete icon, and an add form. Originally built for sales-settings'
 * Terms & Inventory tab (`CreateMasterListItemInput`/`SalesMasterListItem`)
 * and promoted here so other master-data screens (e.g. HR Master) can reuse
 * the same UI without depending on sales-settings' feature-local types —
 * see Docs/CODING_STANDARDS.md "reuse, don't reimplement". Callers own all
 * data-fetching/mutation plumbing and pass plain render data + callbacks. */
export function MasterListCard({
  title,
  items,
  isLoading,
  isError,
  onRetry,
  canRead,
  canWrite,
  readPermissionCode,
  writePermissionCode,
  isSubmitting,
  onAdd,
  onDelete,
  showNumericValue = false,
  numericSuffix = "%",
  addValuePlaceholder = "Add value",
  emptyDescription,
}: MasterListCardProps) {
  const [value, setValue] = useState("");
  const [numericValue, setNumericValue] = useState("");

  if (!canRead) {
    return (
      <Alert variant="warning" title={`You don't have access to ${title}`}>
        Ask an administrator for the <code>{readPermissionCode}</code>{" "}
        permission.
      </Alert>
    );
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    const parsedNumeric =
      showNumericValue && numericValue !== ""
        ? Number(numericValue)
        : undefined;
    await onAdd(trimmed, parsedNumeric);
    setValue("");
    setNumericValue("");
  }

  return (
    <Card className="p-4">
      <div className="flex flex-col gap-3">
        <h3 className="text-theme-sm font-semibold text-gray-900 dark:text-white/90">
          {title}
        </h3>

        {isLoading ? (
          <Skeleton className="h-6 w-full" />
        ) : isError ? (
          <ErrorState onRetry={onRetry} />
        ) : items.length === 0 ? (
          <p className="min-h-8 text-theme-xs text-gray-400 dark:text-gray-500">
            {emptyDescription ?? `Add a ${title.toLowerCase()} value below.`}
          </p>
        ) : (
          <ul className="flex min-h-8 flex-wrap gap-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50/80 px-3 py-1.5 text-theme-xs font-medium text-gray-700 dark:border-gray-800 dark:bg-gray-800/60 dark:text-gray-300"
              >
                <span>{item.label}</span>
                {canWrite ? (
                  <button
                    type="button"
                    aria-label={`Remove ${item.label}`}
                    onClick={() => void onDelete(item.id, item.label)}
                    className="ml-0.5 rounded-full p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-white"
                  >
                    ×
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {canWrite ? (
          <form
            onSubmit={handleAdd}
            className="flex items-center gap-2 border-t border-gray-100 pt-3 dark:border-gray-800"
          >
            <Input
              aria-label={`New ${title} value`}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={addValuePlaceholder}
              disabled={isSubmitting}
              className="h-9 flex-1 py-0"
            />
            {showNumericValue ? (
              <Input
                aria-label={numericSuffix}
                type="number"
                step="0.01"
                value={numericValue}
                onChange={(e) => {
                  const raw = e.target.value;
                  // Digits and a single decimal point only, mirroring the
                  // onboarding wizard's live-sanitization pattern.
                  const sanitized = raw.replace(/[^\d.]/g, "");
                  setNumericValue(sanitized);
                }}
                placeholder={numericSuffix}
                disabled={isSubmitting}
                className="h-9 w-20 py-0"
              />
            ) : null}
            <Button
              type="submit"
              size="sm"
              loading={isSubmitting}
              className="h-9 shrink-0 text-white"
            >
              Add
            </Button>
          </form>
        ) : null}
      </div>
    </Card>
  );
}
