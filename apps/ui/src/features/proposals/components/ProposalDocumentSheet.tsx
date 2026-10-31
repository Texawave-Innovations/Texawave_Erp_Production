"use client";

import type {
  ProposalDocument,
  ProposalSectionConfig,
  ProposalSettings,
} from "@texawave-erp/api-types";
import { formatDate } from "@/features/projects/format";
import { PROPOSAL_STATUS_META } from "../utils";
import {
  formatDmyDate,
  formatINR,
  parseNumericValue,
} from "../field-validation";

export interface ProposalSheetData {
  proposalNumber: string;
  title: string;
  statusLabel: string;
  isDraft: boolean;
  proposalDate: string | null;
  dueDate: string | null;
  clientName: string | null;
  projectName: string | null;
  projectCode: string | null;
  preparedBy: string | null;
  templateTitle: string | null;
  templateVersion: number | null;
  sections: ProposalSectionConfig[];
  values: Record<string, unknown>;
}

/** Sheet model for a saved proposal (its frozen template snapshot +
 * stored section values). */
export function toProposalSheet(doc: ProposalDocument): ProposalSheetData {
  return {
    proposalNumber: doc.proposalNumber,
    title: doc.title,
    statusLabel: PROPOSAL_STATUS_META[doc.status].label,
    isDraft: doc.status === "draft" || doc.status === "changes_requested",
    proposalDate: doc.proposalDate,
    dueDate: doc.dueDate,
    clientName: doc.clientName,
    projectName: doc.projectName,
    projectCode: doc.projectCode,
    preparedBy: doc.createdByName ?? null,
    templateTitle: doc.templateTitle,
    templateVersion: doc.templateVersion,
    sections: Array.isArray(doc.templateSnapshot)
      ? (doc.templateSnapshot as ProposalSectionConfig[])
      : [],
    values: doc.sectionValues ?? {},
  };
}

function asText(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function asList(v: unknown, fallback: string[] = []): string[] {
  return Array.isArray(v)
    ? (v as unknown[]).map((x) => String(x ?? "")).filter((x) => x.trim())
    : fallback.filter((x) => String(x ?? "").trim());
}

function asRecord(v: unknown): Record<string, string> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, string>)
    : {};
}

function asRows(v: unknown): Record<string, string>[] {
  return Array.isArray(v) ? (v as Record<string, string>[]) : [];
}

/** Read-only, printable proposal (legacy `ProposalPreviewModal.tsx` /
 * `TemplateLivePreview.tsx` document body), honouring the organization's
 * header/footer settings. Light surface on purpose — it is the paper copy. */
export function ProposalDocumentSheet({
  data,
  settings,
}: {
  data: ProposalSheetData;
  settings: ProposalSettings | undefined;
}) {
  const showHeader = settings?.showHeader ?? true;
  const showFooter = settings?.showFooter ?? true;
  const company = settings?.companyName || "TexaWave Innovations";
  const footerBits = showFooter
    ? [
        settings?.showFooterEmail !== false && settings?.email
          ? settings.email
          : null,
        settings?.showFooterPhone !== false && settings?.phone
          ? settings.phone
          : null,
        settings?.showFooterWebsite !== false && settings?.website
          ? settings.website
          : null,
      ].filter(Boolean)
    : [];

  return (
    <article className="relative mx-auto w-full max-w-4xl bg-white p-6 text-gray-900 sm:p-10">
      {data.isDraft ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden"
        >
          <span className="-rotate-30 select-none text-8xl font-black uppercase tracking-widest text-gray-200/70">
            Draft
          </span>
        </div>
      ) : null}

      <div className="relative flex flex-col gap-6">
        {showHeader ? (
          <header className="flex items-start justify-between gap-4 border-b-2 border-brand-600 pb-4">
            <div>
              {settings?.showHeaderCompanyName !== false ? (
                <p className="text-xl font-extrabold tracking-tight">
                  {company}
                </p>
              ) : null}
            </div>
            {settings?.showHeaderLogo !== false && settings?.logoUrl ? (
              // Plain <img>: tenant-configured logo URL of unknown host.
              <img
                src={settings.logoUrl}
                alt={`${company} logo`}
                className="h-12 max-w-[160px] object-contain"
              />
            ) : null}
          </header>
        ) : null}

        {settings?.showHeaderDocTitle !== false ? (
          <div className="text-center">
            <p className="text-theme-xs font-bold uppercase tracking-widest text-brand-700">
              Client Proposal
            </p>
            <h1 className="mt-1 text-2xl font-extrabold">
              {data.title || "Untitled Proposal"}
            </h1>
          </div>
        ) : null}

        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4 text-theme-sm sm:grid-cols-4">
          <Field label="Proposal No." value={data.proposalNumber} />
          <Field label="Proposal Date" value={formatDate(data.proposalDate)} />
          <Field label="Client" value={data.clientName || "—"} />
          <Field
            label="Project"
            value={
              data.projectName
                ? `${data.projectName}${data.projectCode ? ` (${data.projectCode})` : ""}`
                : "—"
            }
          />
          <Field label="Prepared By" value={data.preparedBy || "—"} />
          <Field
            label="Valid / Follow-up Until"
            value={formatDate(data.dueDate)}
          />
          <Field label="Status" value={data.statusLabel} />
          <Field
            label="Template"
            value={
              data.templateTitle
                ? `${data.templateTitle}${data.templateVersion ? ` (V${data.templateVersion})` : ""}`
                : "—"
            }
          />
        </dl>

        <SheetSections
          sections={data.sections}
          values={data.values}
          depth={0}
        />

        {showFooter ? (
          <footer className="mt-4 border-t border-gray-200 pt-3 text-center text-theme-xs text-gray-500">
            <p>{[company, ...footerBits].join(" · ")}</p>
            {settings?.showFooterAddress !== false && settings?.address ? (
              <p>{settings.address}</p>
            ) : null}
            {settings?.showFooterPageNumber !== false ? (
              <p className="mt-1">{data.proposalNumber} · Confidential</p>
            ) : null}
          </footer>
        ) : null}
      </div>
    </article>
  );
}

function SheetSections({
  sections,
  values,
  depth,
}: {
  sections: ProposalSectionConfig[];
  values: Record<string, unknown>;
  depth: number;
}) {
  return (
    <>
      {[...sections]
        .sort((a, b) => a.order - b.order)
        .map((s, index) => {
          const value = values[s.id];
          if (s.type === "page_break") {
            return (
              <div
                key={s.id}
                className="my-3 flex items-center gap-2 break-after-page text-theme-xs text-gray-400 print:my-0 print:border-none print:py-0"
              >
                <div className="h-px flex-1 border-t border-dashed border-gray-300 print:hidden" />
                <span className="italic print:hidden">Page Break</span>
                <div className="h-px flex-1 border-t border-dashed border-gray-300 print:hidden" />
              </div>
            );
          }
          if (s.type === "spacer") {
            return <div key={s.id} className="h-6 w-full" aria-hidden="true" />;
          }

          const heading = (
            <h3
              className={
                depth === 0
                  ? "border-b border-gray-200 pb-1 text-theme-sm font-extrabold uppercase tracking-wider text-gray-800"
                  : "text-theme-sm font-bold text-gray-800"
              }
            >
              {depth === 0 ? `${index + 1}. ` : ""}
              {s.title}
            </h3>
          );
          return (
            <section
              key={s.id}
              className="flex flex-col gap-2 break-inside-avoid"
            >
              {heading}
              {s.description && !value ? (
                <p className="text-theme-xs italic text-gray-500">
                  {s.description}
                </p>
              ) : null}
              <SheetValue
                section={s}
                value={value}
                values={values}
                depth={depth}
              />
            </section>
          );
        })}
    </>
  );
}

function SheetValue({
  section,
  value,
  values,
  depth,
}: {
  section: ProposalSectionConfig;
  value: unknown;
  values: Record<string, unknown>;
  depth: number;
}) {
  const empty = <p className="text-theme-sm italic text-gray-400">—</p>;
  switch (section.type) {
    case "short_text":
    case "long_text": {
      const userText = asText(value);
      const defaultText = asText(section.defaultContent);
      const text = userText.trim().length > 0 ? userText : defaultText;
      return text.trim().length > 0 ? (
        <p className="whitespace-pre-wrap text-theme-sm text-gray-800">
          {text}
        </p>
      ) : (
        empty
      );
    }
    case "bullet_list":
    case "numbered_list": {
      const items = asList(value, section.defaultItems ?? []).filter(
        (i) => i.trim().length > 0,
      );
      if (items.length === 0) return empty;
      return section.type === "bullet_list" ? (
        <ul className="list-disc pl-5 text-theme-sm">
          {items.map((i, n) => (
            <li key={`${section.id}-item-${n}`}>{i}</li>
          ))}
        </ul>
      ) : (
        <ol className="list-decimal pl-5 text-theme-sm">
          {items.map((i, n) => (
            <li key={`${section.id}-item-${n}`}>{i}</li>
          ))}
        </ol>
      );
    }
    case "checklist": {
      const checkedList = asList(value);
      const isIndexBased = checkedList.some((v) => /^\d+$/.test(v));
      const checkedSet = new Set(checkedList);
      const items = (section.defaultItems ?? []).filter(
        (i) => i.trim().length > 0,
      );
      if (items.length === 0) return empty;
      return (
        <ul className="text-theme-sm">
          {items.map((i, idx) => {
            const isChecked = isIndexBased
              ? checkedSet.has(String(idx))
              : checkedSet.has(i);
            return (
              <li
                key={`${section.id}-check-${idx}`}
                className="flex items-center gap-2"
              >
                <span className="inline-flex h-4 w-4 items-center justify-center rounded border border-gray-400 text-theme-xs">
                  {isChecked ? "✓" : ""}
                </span>
                {i}
              </li>
            );
          })}
        </ul>
      );
    }
    case "key_value": {
      const kv = asRecord(value);
      const fields = section.keyValueFields ?? [];
      if (fields.length === 0) return empty;
      return (
        <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-theme-sm sm:grid-cols-2">
          {fields.map((f) => {
            const rawVal =
              kv[f.id] !== undefined && String(kv[f.id]).trim().length > 0
                ? kv[f.id]
                : (f.defaultValue ?? f.value);
            const hasVal =
              rawVal !== undefined &&
              rawVal !== null &&
              String(rawVal).trim().length > 0;
            let displayVal = "—";
            if (hasVal) {
              if (f.type === "currency") {
                displayVal = formatINR(rawVal);
              } else if (f.type === "date") {
                displayVal = formatDmyDate(rawVal);
              } else {
                displayVal = String(rawVal);
              }
            }
            return (
              <div key={f.id} className="flex gap-2">
                <dt className="font-semibold text-gray-600">{f.label}:</dt>
                <dd className="text-gray-800">{displayVal}</dd>
              </div>
            );
          })}
        </dl>
      );
    }
    case "table": {
      const columns = section.tableColumns ?? [];
      const userRows = asRows(value);
      const rows = userRows.length > 0 ? userRows : (section.defaultRows ?? []);
      if (columns.length === 0) return empty;
      if (rows.length === 0) {
        return (
          <div className="overflow-x-auto rounded-lg border border-gray-200 p-3 text-center text-theme-xs italic text-gray-400">
            No rows configured.
          </div>
        );
      }
      const totals = columns.map((c) => {
        if (c.type !== "currency" && c.type !== "number") return null;
        let sum = 0;
        let hasValid = false;
        for (const r of rows) {
          const num = parseNumericValue(r[c.id]);
          if (num !== null) {
            sum += num;
            hasValid = true;
          }
        }
        return hasValid ? sum : null;
      });
      const hasTotals = rows.length > 1 && totals.some((t) => t !== null);
      return (
        <table className="w-full border-collapse text-left text-theme-sm">
          <thead>
            <tr className="bg-gray-100 text-theme-xs uppercase text-gray-600">
              <th className="w-10 border border-gray-300 px-2 py-1.5 text-center">
                #
              </th>
              {columns.map((c) => (
                <th key={c.id} className="border border-gray-300 px-2 py-1.5">
                  {c.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${section.id}-row-${i}`}>
                <td className="border border-gray-300 px-2 py-1.5 text-center text-gray-400">
                  {i + 1}
                </td>
                {columns.map((c) => {
                  const cellRaw = r[c.id];
                  let cellDisplay = "—";
                  if (
                    cellRaw !== undefined &&
                    cellRaw !== null &&
                    String(cellRaw).trim().length > 0
                  ) {
                    if (c.type === "currency") {
                      cellDisplay = formatINR(cellRaw);
                    } else if (c.type === "date") {
                      cellDisplay = formatDmyDate(cellRaw);
                    } else {
                      cellDisplay = String(cellRaw);
                    }
                  }
                  return (
                    <td
                      key={c.id}
                      className="border border-gray-300 px-2 py-1.5 text-gray-800"
                    >
                      {cellDisplay}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          {hasTotals ? (
            <tfoot>
              <tr className="border-t-2 border-gray-400 bg-gray-50 font-bold">
                <td className="border border-gray-300 px-2 py-1.5 text-center">
                  Total
                </td>
                {columns.map((c, i) => (
                  <td
                    key={c.id}
                    className="border border-gray-300 px-2 py-1.5 text-gray-900"
                  >
                    {totals[i] === null
                      ? "—"
                      : c.type === "currency"
                        ? formatINR(totals[i])
                        : String(totals[i])}
                  </td>
                ))}
              </tr>
            </tfoot>
          ) : null}
        </table>
      );
    }
    case "signature": {
      const sig = asRecord(value);
      const fields = section.signatureFields ?? [];
      if (fields.length === 0) return empty;
      return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {fields.map((f) => (
            <div key={f.id} className="flex flex-col gap-1">
              <span className="text-theme-xs font-semibold uppercase text-gray-500">
                {f.label}
              </span>
              <span className="min-h-8 border-b border-gray-400 pb-1 text-theme-sm">
                {sig[f.id] || ""}
              </span>
            </div>
          ))}
        </div>
      );
    }
    case "section_group":
      return section.children && section.children.length > 0 ? (
        <div className="flex flex-col gap-4 border-l-2 border-gray-200 pl-4">
          <SheetSections
            sections={section.children}
            values={values}
            depth={depth + 1}
          />
        </div>
      ) : (
        empty
      );
    default:
      return null;
  }
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-theme-xs font-semibold uppercase text-gray-500">
        {label}
      </dt>
      <dd className="break-words font-semibold text-gray-900">{value}</dd>
    </div>
  );
}
