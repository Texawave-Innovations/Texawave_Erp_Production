"use client";

import type React from "react";
import Link from "next/link";
import {
  StatCard as BaseStatCard,
  type StatCardProps as BaseStatCardProps,
  type StatCardTone,
} from "@texawave-erp/ui-kit";

export type StatCardProps = BaseStatCardProps;
export type { StatCardTone };

function NextLinkAdapter({
  href,
  className,
  children,
  "aria-label": ariaLabel,
  onClick,
}: {
  href: string;
  className?: string | undefined;
  children?: React.ReactNode | undefined;
  "aria-label"?: string | undefined;
  onClick?: ((e: React.MouseEvent<HTMLElement>) => void) | undefined;
}) {
  return (
    <Link
      href={href}
      className={className}
      aria-label={ariaLabel}
      {...(onClick ? { onClick } : {})}
    >
      {children}
    </Link>
  );
}

export function StatCard(props: StatCardProps) {
  return (
    <BaseStatCard
      LinkComponent={props.LinkComponent ?? NextLinkAdapter}
      {...props}
    />
  );
}
