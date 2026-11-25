import type { ComponentType, ReactNode } from "react";
import { PageHeader } from "@texawave-erp/ui-kit";

interface PageBannerProps {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  actions?: ReactNode;
}

/** Projects page header: the shared ui-kit `PageHeader` in its banner variant. */
export function PageBanner({
  icon: Icon,
  title,
  description,
  actions,
}: PageBannerProps) {
  return (
    <PageHeader
      variant="banner"
      icon={Icon}
      title={title}
      description={description}
      action={actions}
    />
  );
}
