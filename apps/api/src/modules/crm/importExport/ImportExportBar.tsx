// Drop-in "Import Data / Export Data" toolbar for a CRM data tab — sits next to the tab's
// existing Create/Add button. Import Data opens the Bulk Import wizard (Excel/CSV only — the
// only format that reliably encodes multiple structured records; a template download link lives
// inside that dialog). Export Data opens a format picker (Excel / PDF / Document) plus, when the
// tab has an active search/filter, a choice between exporting all records or just the current view.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileDown, FileUp } from "lucide-react";
import {
  DuplicateConfig,
  DuplicateStrategy,
  FieldSchema,
  ImportSummary,
  MappedImportRow,
} from "./types";
import { BulkImportDialog } from "./BulkImportDialog";
import { ExportDataDialog } from "./ExportDataDialog";

export interface ImportExportBarProps<T> {
  /** Display name used in dialog titles / file names, e.g. "Leads". */
  moduleLabel: string;
  fields: FieldSchema<T>[];
  allRecords: T[];
  /** Pass when the list currently has an active search/filter/sort different from `allRecords` — enables the "Current View" export scope. */
  filteredRecords?: T[];
  /** Base filename (no extension/date) for exports and the import template, e.g. "crm-leads". */
  fileBaseName: string;
  duplicate?: DuplicateConfig;
  commitImport: (
    rows: MappedImportRow[],
    strategy: DuplicateStrategy,
  ) => Promise<ImportSummary>;
  helperNote?: string;
}

export function ImportExportBar<T>({
  moduleLabel,
  fields,
  allRecords,
  filteredRecords,
  fileBaseName,
  duplicate,
  commitImport,
  helperNote,
}: ImportExportBarProps<T>) {
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        className="rounded-xl gap-1.5 h-9"
        onClick={() => setImportOpen(true)}
      >
        <FileUp className="h-3.5 w-3.5" /> Import Data
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="rounded-xl gap-1.5 h-9"
        onClick={() => setExportOpen(true)}
      >
        <FileDown className="h-3.5 w-3.5" /> Export Data
      </Button>

      <BulkImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title={moduleLabel}
        fields={fields}
        duplicate={duplicate}
        commitImport={commitImport}
        fileBaseName={fileBaseName}
        helperNote={helperNote}
      />

      <ExportDataDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        moduleLabel={moduleLabel}
        fields={fields}
        allRecords={allRecords}
        filteredRecords={filteredRecords}
        fileBaseName={fileBaseName}
      />
    </div>
  );
}
