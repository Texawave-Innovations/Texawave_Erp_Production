"use client";

import { PageHeader, Tabs, type TabItem } from "@texawave-erp/ui-kit";
import { useState } from "react";
import { ProjectCodeMasterTab } from "./ProjectCodeMasterTab";
import { ProjectMasterListTab } from "./ProjectMasterListTab";
import { TaskRunningNumberMasterTab } from "./TaskRunningNumberMasterTab";

type TopLevelTab = "project-master" | "code-master" | "task-number-master";

const TABS: TabItem<TopLevelTab>[] = [
  { id: "project-master", label: "1. Project Master" },
  { id: "code-master", label: "2. Project Code Master" },
  { id: "task-number-master", label: "3. Task Running Number Master" },
];

/** "Projects Master Lists" screen — the parent page for the whole
 * projects-master module: the project type registry, the project-code
 * format generator, and the task running-number format generator. */
export function ProjectsMasterView() {
  const [active, setActive] = useState<TopLevelTab>("project-master");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Projects Master Lists"
        description="Configure Project Master (ME, SW, EC, ...), code formats, task running numbers & audit save histories."
      />
      <Tabs
        label="Projects Master Lists sections"
        idPrefix="projects-master-lists"
        tabs={TABS}
        value={active}
        onChange={setActive}
      >
        {active === "project-master" ? <ProjectMasterListTab /> : null}
        {active === "code-master" ? <ProjectCodeMasterTab /> : null}
        {active === "task-number-master" ? (
          <TaskRunningNumberMasterTab />
        ) : null}
      </Tabs>
    </div>
  );
}
