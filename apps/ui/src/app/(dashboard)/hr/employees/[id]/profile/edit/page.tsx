import { notFound } from "next/navigation";
import { ProfileEditView } from "@/features/hr/profiles/components/ProfileEditView";

export default async function HrEmployeeProfileEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  return <ProfileEditView id={Number(id)} />;
}
