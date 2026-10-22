"use client";

import {
  Button,
  DataTable,
  Dialog,
  StatusBadge,
  type DataTableColumn,
} from "@texawave-erp/ui-kit";
import type { ReactNode } from "react";
import { formatStatusLabel, scmStatusToken } from "./format";

export interface ScmDetailDialogProps<L> {
  open: boolean;
  onClose: () => void;
  title: string;
  status?: string;
  fields: ReadonlyArray<readonly [string, ReactNode]>;
  lineCaption?: string;
  lineColumns?: ReadonlyArray<DataTableColumn<L>>;
  lineRows?: readonly L[];
  getLineKey?: (row: L) => string;
  footer?: ReactNode;
  children?: ReactNode;
}

/** Read-only document view shared by PR / RFQ / quotation / PO / GRN: header
 * facts, a status badge, a lines table and optional extra sections. */
export function ScmDetailDialog<L>(props: ScmDetailDialogProps<L>) {
  return (
    <Dialog
      open={props.open}
      onClose={props.onClose}
      title={props.title}
      size="2xl"
      className="sm:max-w-5xl"
    >
      {props.open ? (
        <div className="flex flex-col gap-4">
          {props.status ? (
            <div>
              <StatusBadge
                label={formatStatusLabel(props.status)}
                colorToken={scmStatusToken(props.status)}
              />
            </div>
          ) : null}
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-4">
            {props.fields.map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-theme-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {label}
                </dt>
                <dd className="truncate text-theme-sm text-gray-900 dark:text-white/90">
                  {value ?? "—"}
                </dd>
              </div>
            ))}
          </dl>
          {props.lineColumns && props.lineRows && props.getLineKey ? (
            <DataTable<L>
              caption={props.lineCaption ?? "Items"}
              columns={props.lineColumns}
              rows={props.lineRows}
              getRowKey={props.getLineKey}
            />
          ) : null}
          {props.children}
          <div className="flex justify-end gap-2">
            {props.footer}
            <Button type="button" variant="secondary" onClick={props.onClose}>
              Close
            </Button>
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}
