"use client";

import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  ErrorState,
  Skeleton,
  type TabItem,
  Tabs,
} from "@texawave-erp/ui-kit";
import { useState } from "react";
import { useAccount } from "../hooks";
import { ActivitiesTab } from "./tabs/ActivitiesTab";
import { ContactsTab } from "./tabs/ContactsTab";
import { DocumentsTab } from "./tabs/DocumentsTab";
import { FollowUpsTab } from "./tabs/FollowUpsTab";
import { MeetingsTab } from "./tabs/MeetingsTab";
import { NotesTab } from "./tabs/NotesTab";
import { OpportunitiesTab } from "./tabs/OpportunitiesTab";
import { OverviewTab } from "./tabs/OverviewTab";
import { QuotationsTab } from "./tabs/QuotationsTab";
import { TasksTab } from "./tabs/TasksTab";

type AccountTab =
  | "overview"
  | "contacts"
  | "opportunities"
  | "quotations"
  | "meetings"
  | "follow-ups"
  | "activities"
  | "tasks"
  | "documents"
  | "notes";

const TABS: readonly TabItem<AccountTab>[] = [
  { id: "overview", label: "Overview" },
  { id: "contacts", label: "Contacts" },
  { id: "opportunities", label: "Opportunities" },
  { id: "quotations", label: "Quotations" },
  { id: "meetings", label: "Meetings" },
  { id: "follow-ups", label: "Follow-ups" },
  { id: "activities", label: "Activities" },
  { id: "tasks", label: "Tasks" },
  { id: "documents", label: "Documents" },
  { id: "notes", label: "Notes" },
];

/** Account-360 detail page. Products and a unified Timeline tab are out of
 * scope for Phase 1A (Docs/CRM_FULL_LEGACY_PARITY.md §8 deferred list). */
export function AccountDetail({ id }: { id: number }) {
  const [tab, setTab] = useState<AccountTab>("overview");
  const query = useAccount(id);

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }
  if (query.isError) {
    if (query.error instanceof ApiError && query.error.isPermissionError) {
      return (
        <Alert variant="warning" title="You don't have access to this account">
          Ask an administrator for the <code>crm.account.read</code> permission.
        </Alert>
      );
    }
    return <ErrorState onRetry={() => void query.refetch()} />;
  }

  const account = query.data;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-theme-xl font-semibold text-gray-900 dark:text-white/90">
        {account.name}
      </h1>
      <Tabs
        label="Account sections"
        idPrefix="account-360"
        tabs={TABS}
        value={tab}
        onChange={setTab}
      >
        {tab === "overview" ? <OverviewTab account={account} /> : null}
        {tab === "contacts" ? <ContactsTab accountId={account.id} /> : null}
        {tab === "opportunities" ? (
          <OpportunitiesTab accountId={account.id} />
        ) : null}
        {tab === "quotations" ? <QuotationsTab accountId={account.id} /> : null}
        {tab === "meetings" ? <MeetingsTab accountId={account.id} /> : null}
        {tab === "follow-ups" ? <FollowUpsTab accountId={account.id} /> : null}
        {tab === "activities" ? <ActivitiesTab accountId={account.id} /> : null}
        {tab === "tasks" ? <TasksTab accountId={account.id} /> : null}
        {tab === "documents" ? <DocumentsTab accountId={account.id} /> : null}
        {tab === "notes" ? <NotesTab accountId={account.id} /> : null}
      </Tabs>
    </div>
  );
}
