import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CrmCalendarEventDetail } from "@/features/crm/calendar/components/CrmCalendarEventDetail";

export default async function CrmCalendarEventPage({
  params,
}: {
  params: Promise<{ type: string; id: string }>;
}) {
  const { type, id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  return (
    <Suspense fallback={null}>
      <CrmCalendarEventDetail type={type} id={Number(id)} />
    </Suspense>
  );
}
