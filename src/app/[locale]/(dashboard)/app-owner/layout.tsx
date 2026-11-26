import { requireAppOwner } from "@/lib/app-owner-auth";

export default async function AppOwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAppOwner();

  return <div className="min-w-0 space-y-6">{children}</div>;
}
