import { PipelineBoard } from "@/features/crm/opportunities/components/PipelineBoard";

// `app/` stays thin — routing only. All real logic/markup lives in
// `features/crm/opportunities/` (Docs/CODING_STANDARDS.md §4).
export default function CrmPipelinePage() {
  return <PipelineBoard />;
}
