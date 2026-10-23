import { ReturnsListView } from "@/features/scm/returns/components/ReturnsListView";

// `app/` stays thin — routing only (Docs/CODING_STANDARDS.md section 4).
export default function ScmReturnDispositionPage() {
  return <ReturnsListView presetStatus="DISPOSITION_PENDING" />;
}
