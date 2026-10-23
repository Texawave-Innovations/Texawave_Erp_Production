import { ReturnsListView } from "@/features/scm/returns/components/ReturnsListView";

// `app/` stays thin — routing only (Docs/CODING_STANDARDS.md section 4).
export default function ScmVendorReturnsPage() {
  return <ReturnsListView onlyType="VENDOR_RETURN" />;
}
