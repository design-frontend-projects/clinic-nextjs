"use client";

import { PersonnelManagement } from "@/components/admin/personnel-management";
import { Heading } from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";

export default function StaffPage() {
  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-start justify-between">
        <Heading
          title="Staff Management"
          description="Manage your clinic's administrative and support staff."
        />
      </div>
      <Separator />
      <PersonnelManagement role="staff" title="Staff" />
    </div>
  );
}
