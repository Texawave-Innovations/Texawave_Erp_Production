import { Alert } from "@texawave-erp/ui-kit";

/** Page header shared by the Payroll and Compliance screens. */
export function SectionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <header className="rounded-2xl bg-gradient-to-r from-brand-700 via-brand-600 to-brand-500 p-6 text-white shadow-theme-md sm:p-8">
      <h1 className="text-theme-xl font-bold tracking-tight sm:text-2xl">
        {title}
      </h1>
      <p className="mt-1 max-w-2xl text-theme-sm text-brand-50">
        {description}
      </p>
    </header>
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
