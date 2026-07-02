"use client";

import { PersonnelManagement } from "@/components/admin/personnel-management";
import { Heading } from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";

export default function DoctorsPage() {
  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-start justify-between">
        <Heading
          title="Doctor Management"
          description="Manage your clinic's doctors, specialties, and assignments."
        />
      </div>
      <Separator />
      <PersonnelManagement role="doctor" title="Doctor" />
    </div>
  );
}
