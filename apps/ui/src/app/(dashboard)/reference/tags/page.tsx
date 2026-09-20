import { TagsView } from "@/features/_reference/tags/components/TagsView";

// `app/` stays thin — routing only. All real logic/markup lives in
// `features/_reference/tags/` (Docs/CODING_STANDARDS.md §4).
export default function ReferenceTagsPage() {
  return <TagsView />;
}
