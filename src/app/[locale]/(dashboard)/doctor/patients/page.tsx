"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, ChevronRight, Loader2 } from "lucide-react";
import { Link } from "@/i18n/routing";
import { getDoctorPatients } from "@/app/actions/doctor";

type PatientSubset = {
  id: string;
  name: string;
  last_visit: string;
  condition: string;
  phone?: string;
  email?: string;
};

const columns: ColumnDef<PatientSubset>[] = [
  {
    accessorKey: "name",
    header: "Patient",
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-blue-soft text-accent-blue font-bold">
          {row.original.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="font-semibold text-sm text-foreground">{row.original.name}</p>
          <p className="text-xs text-muted-foreground">{row.original.phone || "—"}</p>
        </div>
      </div>
    ),
  },
  {
    accessorKey: "condition",
    header: "Primary Condition",
    cell: ({ row }) => (
      <span className="inline-flex items-center rounded-lg bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground border border-border/20">
        {row.original.condition}
      </span>
    ),
  },
  {
    accessorKey: "last_visit",
    header: "Last Visit",
    cell: ({ row }) => {
      try {
        return (
          <span className="text-sm font-medium text-muted-foreground">
            {format(new Date(row.original.last_visit), "MMM d, yyyy")}
          </span>
        );
      } catch {
        return <span className="text-sm text-muted-foreground">{row.original.last_visit || "—"}</span>;
      }
    },
  },
  {
    id: "actions",
    cell: ({ row }) => (
      <Link href={`/doctor/patients/${row.original.id}`}>
        <Button
          variant="ghost"
          size="sm"
          className="rounded-lg hover:bg-accent-blue-soft hover:text-accent-blue font-semibold transition-all"
        >
          File <ChevronRight className="ml-1.5 h-4 w-4" />
        </Button>
      </Link>
    ),
  },
];

export default function DoctorPatientsPage() {
  const { data: patients = [], isLoading } = useQuery({
    queryKey: ["doctor-patients"],
    queryFn: () => getDoctorPatients(),
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="space-y-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground via-muted-foreground to-foreground bg-clip-text text-transparent">
            My Patients
          </h1>
          <p className="text-muted-foreground">
            Directory of patients under your care
          </p>
        </div>
        <Link href="/doctor/appointments">
          <Button className="rounded-xl font-medium shadow-sm hover:opacity-95">
            <Plus className="mr-2 h-4 w-4" />
            Book Follow-up
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-accent-blue" />
          <span className="text-sm font-medium">Loading patients directory...</span>
        </div>
      ) : (
        <div className="rounded-2xl border border-border/40 bg-card/30 p-4 backdrop-blur-md shadow-sm">
          <DataTable
            columns={columns}
            data={patients as PatientSubset[]}
            searchKey="name"
            searchPlaceholder="Search patients by name..."
          />
        </div>
      )}
    </motion.div>
  );
}
