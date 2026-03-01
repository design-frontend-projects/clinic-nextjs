"use client";

import { useQuery } from "@tanstack/react-query";
import { getDoctors } from "@/app/actions/admin";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Stethoscope } from "lucide-react";
import { format } from "date-fns";

type Doctor = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  specialty: string | null;
  status: string;
  created_at: Date;
};

const columns: ColumnDef<Doctor>[] = [
  {
    accessorKey: "full_name",
    header: "Doctor",
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
          <Stethoscope className="h-4 w-4 text-emerald-600" />
        </div>
        <div>
          <p className="font-medium">{row.original.full_name || "Unnamed"}</p>
          <p className="text-xs text-muted-foreground">
            {row.original.specialty || "General"}
          </p>
        </div>
      </div>
    ),
  },
  {
    accessorKey: "email",
    header: "Email",
    cell: ({ row }) => row.original.email || "—",
  },
  {
    accessorKey: "phone",
    header: "Phone",
    cell: ({ row }) => row.original.phone || "—",
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    accessorKey: "created_at",
    header: "Joined",
    cell: ({ row }) => format(new Date(row.original.created_at), "MMM d, yyyy"),
  },
];

export default function DoctorsPage() {
  const { data: doctors = [] } = useQuery({
    queryKey: ["doctors"],
    queryFn: () => getDoctors(),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Doctors</h1>
          <p className="text-muted-foreground">Manage your medical staff</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Doctor
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={doctors as Doctor[]}
        searchKey="full_name"
        searchPlaceholder="Search doctors..."
      />
    </div>
  );
}
