"use client";

import type {
  CrmCustomFieldModule,
  CrmExportEntity,
  CrmImportEntity,
} from "@texawave-erp/api-types";
import { Button } from "@/components/legacy-ui/button";
import { FileDown, FileUp } from "lucide-react";
import { useState } from "react";
import { usePermission } from "@/hooks/usePermission";
import { useCustomFields } from "../hooks";
import { ExportDialog } from "./ExportDialog";
import { ImportDialog } from "./ImportDialog";

export interface ImportExportBarProps {
  entity: CrmExportEntity;
  /** Display name for dialog titles, e.g. "Leads". */
  moduleLabel: string;
  /** Base filename (no extension/date), e.g. "crm-leads". */
  fileBaseName: string;
  /** The list's active search, for the "current view" export scope. */
  search?: string | undefined;
  /** Custom-field bucket whose columns the export can include. */
  customModule?: CrmCustomFieldModule | undefined;
  /** Hide Import (export-only lists such as Quotes). */
  exportOnly?: boolean | undefined;
}

/** Legacy ImportExportBar: "Import Data / Export Data" next to a list's
 * Create button. Gated by crm.import.write / crm.export.read — the API also
 * re-checks the target entity's own permission. */
export function ImportExportBar({
  entity,
  moduleLabel,
  fileBaseName,
  search,
  customModule,
  exportOnly,
}: ImportExportBarProps) {
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const canImport = usePermission("crm.import.write");
  const canExport = usePermission("crm.export.read");
  const customFields = useCustomFields(customModule);
  const showImport = canImport && !exportOnly && entity !== "quotations";

  if (!showImport && !canExport) return null;

  return (
    <div className="flex items-center gap-2">
      {showImport && (
        <Button
          size="sm"
          variant="outline"
          className="rounded-xl gap-1.5 h-9"
          onClick={() => setImportOpen(true)}
        >
          <FileUp className="h-3.5 w-3.5" /> Import Data
        </Button>
      )}
      {canExport && (
        <Button
          size="sm"
          variant="outline"
          className="rounded-xl gap-1.5 h-9"
          onClick={() => setExportOpen(true)}
        >
          <FileDown className="h-3.5 w-3.5" /> Export Data
        </Button>
      )}
      {showImport && (
        <ImportDialog
          open={importOpen}
          onClose={() => setImportOpen(false)}
          entity={entity as CrmImportEntity}
          title={moduleLabel}
          fileBaseName={fileBaseName}
        />
      )}
      {canExport && (
        <ExportDialog
          open={exportOpen}
          onClose={() => setExportOpen(false)}
          entity={entity}
          moduleLabel={moduleLabel}
          fileBaseName={fileBaseName}
          search={search}
          hasCustomFields={
            Boolean(customModule) && (customFields.data?.length ?? 0) > 0
          }
        />
      )}
    </div>
  );
}
