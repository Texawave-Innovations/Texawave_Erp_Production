"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@texawave-erp/ui-kit";

export interface HrPageHeaderProps {
  title: string;
  description: string;
  icon?: LucideIcon | undefined;
  badge?: ReactNode | undefined;
  action?: ReactNode | undefined;
  className?: string | undefined;
}

/**
 * Standardized TexaOne HR Page Header compatibility wrapper.
 * Delegates to the global UI Kit PageHeader with variant="banner".
 * Conforms to Docs/DESIGN_SYSTEM.md.
 */
export function HrPageHeader(props: HrPageHeaderProps) {
  return <PageHeader variant="banner" {...props} />;
}
