import { requireAppOwner } from "@/lib/app-owner-auth";
import { SpecialtyEditor } from "@/components/app-owner/specialty-editor";

export default async function NewSpecialtyPage() {
  await requireAppOwner();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">New Specialty</h2>
        <p className="text-muted-foreground">
          Add a medical specialty to the shared catalog.
        </p>
      </div>
      <SpecialtyEditor />
    </div>
  );
}
