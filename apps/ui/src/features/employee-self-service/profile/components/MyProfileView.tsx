"use client";

import { Card, Skeleton } from "@texawave-erp/ui-kit";
import {
  useMyAddress,
  useMyBank,
  useMyDocuments,
  useMyExperience,
  useMyFamilyMembers,
  useMyGovernmentIds,
  useMyPersonal,
} from "@/features/onboarding/hooks";

/** `Record<string, unknown>` fields are rendered generically — the profile
 * controller's personal/address/bank/government-id shapes are free-form JSON
 * on the backend (see apps/api/src/modules/employee-self-service/profile/dto/),
 * so there's no fixed field list to hard-code here. */
function KeyValueGrid({ data }: { data: Record<string, unknown> | null }) {
  if (!data) {
    return <p className="text-theme-xs text-gray-400">Not provided yet.</p>;
  }
  const entries = Object.entries(data).filter(
    ([key]) => !["id", "employeeId", "createdAt", "updatedAt"].includes(key),
  );
  if (entries.length === 0) {
    return <p className="text-theme-xs text-gray-400">Not provided yet.</p>;
  }
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
      {entries.map(([key, value]) => (
        <div key={key} className="flex flex-col">
          <dt className="text-theme-xs capitalize text-gray-500 dark:text-gray-400">
            {key.replace(/([A-Z])/g, " $1").trim()}
          </dt>
          <dd className="text-theme-sm text-gray-900 dark:text-gray-100">
            {value === null || value === "" ? "—" : String(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Section({
  title,
  isPending,
  children,
}: {
  title: string;
  isPending: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-5">
      <h2 className="mb-3 text-theme-sm font-semibold text-gray-900 dark:text-white/90">
        {title}
      </h2>
      {isPending ? <Skeleton className="h-16 w-full" /> : children}
    </Card>
  );
}

/**
 * Read-only "My Profile" view for the employee self-service portal
 * (Docs/ARCHITECTURE.md §7). Reuses the same `employee/profile/*` queries
 * the onboarding wizard already built (apps/ui/src/features/onboarding/hooks.ts)
 * rather than duplicating a parallel data layer — this page only adds a
 * read surface for data the wizard already collects, including the two
 * endpoints (bank details, government ids) the wizard never needed to read
 * back, now added alongside the existing write-only wrappers.
 */
export function MyProfileView() {
  const personal = useMyPersonal();
  const permanentAddress = useMyAddress("PERMANENT");
  const presentAddress = useMyAddress("PRESENT");
  const bank = useMyBank();
  const governmentIds = useMyGovernmentIds();
  const family = useMyFamilyMembers();
  const experience = useMyExperience();
  const documents = useMyDocuments();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-theme-xl font-semibold text-gray-900 dark:text-white/90">
        My Profile
      </h1>

      <Section title="Personal details" isPending={personal.isPending}>
        <KeyValueGrid data={personal.data ?? null} />
      </Section>

      <Section title="Permanent address" isPending={permanentAddress.isPending}>
        <KeyValueGrid data={permanentAddress.data ?? null} />
      </Section>

      <Section title="Present address" isPending={presentAddress.isPending}>
        <KeyValueGrid data={presentAddress.data ?? null} />
      </Section>

      <Section title="Bank details" isPending={bank.isPending}>
        <KeyValueGrid data={bank.data ?? null} />
      </Section>

      <Section title="Government IDs" isPending={governmentIds.isPending}>
        <KeyValueGrid data={governmentIds.data ?? null} />
      </Section>

      <Card className="p-5">
        <h2 className="mb-3 text-theme-sm font-semibold text-gray-900 dark:text-white/90">
          Family members
        </h2>
        {family.isPending ? (
          <Skeleton className="h-16 w-full" />
        ) : !family.data || family.data.length === 0 ? (
          <p className="text-theme-xs text-gray-400">None added yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {family.data.map((member) => (
              <li
                key={member.id}
                className="flex flex-col gap-0.5 border-b border-gray-100 pb-2 last:border-none dark:border-gray-800"
              >
                <span className="text-theme-sm font-medium text-gray-900 dark:text-gray-100">
                  {member.name} — {member.relation}
                </span>
                <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                  {member.dateOfBirth ?? "DOB not provided"}
                  {member.contactPhone ? ` · ${member.contactPhone}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 text-theme-sm font-semibold text-gray-900 dark:text-white/90">
          Experience
        </h2>
        {experience.isPending ? (
          <Skeleton className="h-16 w-full" />
        ) : !experience.data || experience.data.length === 0 ? (
          <p className="text-theme-xs text-gray-400">None added yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {experience.data.map((row) => (
              <li
                key={row.id}
                className="flex flex-col gap-0.5 border-b border-gray-100 pb-2 last:border-none dark:border-gray-800"
              >
                <span className="text-theme-sm font-medium text-gray-900 dark:text-gray-100">
                  {row.designation} at {row.employer}
                </span>
                <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                  {row.fromDate} – {row.toDate ?? "present"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 text-theme-sm font-semibold text-gray-900 dark:text-white/90">
          Documents
        </h2>
        {documents.isPending ? (
          <Skeleton className="h-16 w-full" />
        ) : !documents.data || documents.data.length === 0 ? (
          <p className="text-theme-xs text-gray-400">None uploaded yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {documents.data.map((doc) => (
              <li
                key={doc.documentType}
                className="flex items-center justify-between border-b border-gray-100 pb-2 last:border-none dark:border-gray-800"
              >
                <span className="text-theme-sm text-gray-900 dark:text-gray-100">
                  {doc.documentType}: {doc.fileName}
                </span>
                <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                  {new Date(doc.uploadedAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
