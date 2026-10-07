import { notFound } from "next/navigation";
import { ProfileView } from "@/features/hr/profiles/components/ProfileView";

export default async function HrEmployeeProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  return <ProfileView id={Number(id)} />;
}
