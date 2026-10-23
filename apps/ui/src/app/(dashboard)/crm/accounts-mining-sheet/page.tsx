import { MiningRowsList } from "@/features/crm/mining-rows/components/MiningRowsList";

// `app/` stays thin — routing only. All real logic/markup lives in
// `features/crm/mining-rows/` (Docs/CODING_STANDARDS.md §4). The bulk-import
// task passes its `ImportExportBar` via `headerActions`.
export default function CrmAccountsMiningSheetPage() {
  return <MiningRowsList />;
}
