"use client";

import { useState } from "react";
import { DropdownMenu, type DropdownOption } from "./index";
import { Button } from "../button/index";

export function DropdownMenuDemo() {
  const [selectedAction, setSelectedAction] = useState<string>("None");

  const sampleOptions: DropdownOption[] = [
    {
      label: "View details",
      description: "Inspect complete profile information",
      onClick: () => setSelectedAction("View details"),
    },
    {
      label: "Edit settings",
      description: "Modify preferences and role permissions",
      onClick: () => setSelectedAction("Edit settings"),
    },
    {
      label: "Duplicate record",
      description: "Clone into a new draft",
      onClick: () => setSelectedAction("Duplicate record"),
    },
    {
      label: "Archive record",
      disabled: true,
      description: "Requires administrator override",
      onClick: () => setSelectedAction("Archive record"),
    },
    {
      label: "Delete permanently",
      variant: "destructive",
      separator: true,
      description: "Cannot be undone",
      onClick: () => setSelectedAction("Delete permanently"),
    },
  ];

  return (
    <div className="flex flex-col gap-4 p-6 rounded-2xl border border-sky-100 bg-white/70 backdrop-blur-md shadow-xs dark:border-slate-800 dark:bg-slate-900/60">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800 dark:text-white">
          TexaOne Animated Glassmorphism Dropdown Menu
        </h3>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Last action:{" "}
          <strong className="text-brand-600 dark:text-cyan-400">
            {selectedAction}
          </strong>
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* Default Button Trigger */}
        <DropdownMenu
          triggerLabel="Table Actions"
          triggerVariant="primary"
          options={sampleOptions}
        />

        {/* Glass Button Trigger */}
        <DropdownMenu
          triggerLabel="Options"
          triggerVariant="glass"
          options={sampleOptions}
        />

        {/* Outline Trigger with End Alignment */}
        <DropdownMenu
          triggerLabel="More Actions"
          triggerVariant="outline"
          align="end"
          options={sampleOptions}
        />

        {/* Custom Icon/Child Trigger */}
        <DropdownMenu options={sampleOptions} align="end">
          <Button variant="ghost" size="icon" aria-label="More options">
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="1.5" fill="currentColor" />
              <circle cx="12" cy="5" r="1.5" fill="currentColor" />
              <circle cx="12" cy="19" r="1.5" fill="currentColor" />
            </svg>
          </Button>
        </DropdownMenu>
      </div>
    </div>
  );
}
