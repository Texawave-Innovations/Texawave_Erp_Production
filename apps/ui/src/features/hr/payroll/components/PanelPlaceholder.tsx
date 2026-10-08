import { Card, EmptyState } from "@texawave-erp/ui-kit";

/** Stand-in for a tab whose screen lands in a later change. Remove once
 * every panel is implemented. */
export function PanelPlaceholder({ title }: { title: string }) {
  return (
    <Card>
      <EmptyState
        title={title}
        description="This section is being built and will be available soon."
      />
    </Card>
  );
}
