import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Alert } from "@texawave-erp/ui-kit";
import { HrPageHeader } from "@/features/hr/components/HrPageHeader";

/** Page header shared across HR screens. */
export function SectionHeader({
  title,
  description,
  icon,
  badge,
  action,
}: {
  title: string;
  description: string;
  icon?: LucideIcon;
  badge?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <HrPageHeader
      title={title}
      description={description}
      icon={icon}
      badge={badge}
      action={action}
    />
  );
}

export function NoAccess({ area }: { area: string }) {
  return (
    <Alert variant="warning" title="No access">
      Your role does not include any {area} permissions. Ask an administrator to
      grant access.
    </Alert>
  );
}
