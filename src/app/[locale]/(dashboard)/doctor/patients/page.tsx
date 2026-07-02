"use client";

import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Users, ChevronRight } from "lucide-react";
import Link from "next/link";

type PatientSubset = {
  id: string;
  name: string;
  last_visit: string;
  condition: string;
};

const columns: ColumnDef<PatientSubset>[] = [
  {
    accessorKey: "name",
    header: "Patient",
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
          <Users className="h-4 w-4 text-primary" />
        </div>
        <p className="font-medium">{row.original.name}</p>
      </div>
    ),
  },
  {
    accessorKey: "condition",
    header: "Primary Condition",
  },
  {
    accessorKey: "last_visit",
    header: "Last Visit",
  },
  {
    id: "actions",
    cell: ({ row }) => (
      <Link href={`/doctor/patients/${row.original.id}`}>
        <Button variant="ghost" size="sm">
          File <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </Link>
    ),
  },
];

export default function DoctorPatientsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Patients</h1>
          <p className="text-muted-foreground">
            Directory of patients under your care
          </p>
        </div>
        <Link href="/doctor/appointments">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Book Follow-up
          </Button>
        </Link>
      </div>

      <DataTable
        columns={columns}
        data={[]}
        searchKey="name"
        searchPlaceholder="Search patients..."
      />
    </div>
  );
}
