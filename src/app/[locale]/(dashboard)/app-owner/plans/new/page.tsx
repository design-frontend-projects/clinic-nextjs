import { requireAppOwner } from "@/lib/app-owner-auth";
import { PlanEditor } from "@/components/app-owner/plan-editor";

export default async function NewPlanPage() {
  await requireAppOwner();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">New Subscription Plan</h2>
        <p className="text-muted-foreground">Define a new plan and its features.</p>
      </div>
      <PlanEditor />
    </div>
  );
}
