"use client";

import type { ReactNode } from "react";
import {
  PageHeader as GlobalPageHeader,
  type PageHeaderProps as GlobalPageHeaderProps,
  type BreadcrumbItem,
} from "@texawave-erp/ui-kit";

export interface PageHeaderProps extends Omit<
  GlobalPageHeaderProps,
  "breadcrumbs"
> {
  breadcrumbs?: (string | BreadcrumbItem)[] | undefined;
  title: ReactNode;
  description?: ReactNode | undefined;
  action?: ReactNode | undefined;
}

export type HrPageHeaderProps = PageHeaderProps;

/**
 * Standardized Page Header & Breadcrumbs compatibility wrapper.
 * Delegates to the global UI Kit PageHeader component.
 * Conforms to Docs/DESIGN_SYSTEM.md and Docs/CODING_STANDARDS.md.
 */
export function PageHeader(props: PageHeaderProps) {
  return <GlobalPageHeader {...props} />;
}

export const HrPageHeader = PageHeader;
