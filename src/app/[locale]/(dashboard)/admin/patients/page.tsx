"use client";

import { useQuery } from "@tanstack/react-query";
import { getPatients, createPatient } from "@/app/actions/admin";
import { invitePatientToPortal } from "@/app/actions/patient";
import { toast } from "sonner";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Users, Mail, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";

const patientSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  date_of_birth: z.string().optional(),
  address: z.string().optional(),
});

type PatientForm = z.infer<typeof patientSchema>;

type Patient = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  gender: string | null;
  date_of_birth: Date | null;
  created_at: Date;
  profile_id: string | null;
};

function InviteToPortalCell({ patient }: { patient: Patient }) {
  const [isPending, startTransition] = useTransition();

  if (patient.profile_id) {
    return (
      <span className="text-xs text-muted-foreground">Portal active</span>
    );
  }

  const handleInvite = () => {
    if (!patient.email) {
      toast.error("This patient has no email address to invite.");
      return;
    }
    startTransition(async () => {
      const result = await invitePatientToPortal(patient.id);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Portal invitation sent.");
    });
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleInvite}
      disabled={isPending || !patient.email}
    >
      {isPending ? (
        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
      ) : (
        <Mail className="mr-2 h-3.5 w-3.5" />
      )}
      Invite to portal
    </Button>
  );
}

const columns: ColumnDef<Patient>[] = [
  {
    accessorKey: "first_name",
    header: "Name",
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
          <Users className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="font-medium">
            {row.original.first_name} {row.original.last_name}
          </p>
          <p className="text-xs text-muted-foreground">
            {row.original.email || "No email"}
          </p>
        </div>
      </div>
    ),
  },
  {
    accessorKey: "phone",
    header: "Phone",
    cell: ({ row }) => row.original.phone || "—",
  },
  {
    accessorKey: "gender",
    header: "Gender",
    cell: ({ row }) => (
      <span className="capitalize">{row.original.gender || "—"}</span>
    ),
  },
  {
    accessorKey: "date_of_birth",
    header: "Date of Birth",
    cell: ({ row }) =>
      row.original.date_of_birth
        ? format(new Date(row.original.date_of_birth), "MMM d, yyyy")
        : "—",
  },
  {
    accessorKey: "created_at",
    header: "Registered",
    cell: ({ row }) => format(new Date(row.original.created_at), "MMM d, yyyy"),
  },
  {
    id: "portal",
    header: "Portal",
    cell: ({ row }) => <InviteToPortalCell patient={row.original} />,
  },
];

export default function PatientsPage() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const { data: patients = [], refetch } = useQuery({
    queryKey: ["patients"],
    queryFn: () => getPatients(),
  });

  const form = useForm<PatientForm>({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      gender: undefined,
      date_of_birth: "",
      address: "",
    },
  });

  const onSubmit = (data: PatientForm) => {
    startTransition(async () => {
      await createPatient(data);
      setOpen(false);
      form.reset();
      refetch();
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Patients</h1>
          <p className="text-muted-foreground">
            Manage your clinic&apos;s patient records
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Patient
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add New Patient</DialogTitle>
              <DialogDescription>
                Register a new patient in the system.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">First Name *</Label>
                  <Input
                    id="first_name"
                    {...form.register("first_name")}
                    placeholder="John"
                  />
                  {form.formState.errors.first_name && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.first_name.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Last Name *</Label>
                  <Input
                    id="last_name"
                    {...form.register("last_name")}
                    placeholder="Doe"
                  />
                  {form.formState.errors.last_name && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.last_name.message}
                    </p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    {...form.register("email")}
                    placeholder="john@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    {...form.register("phone")}
                    placeholder="+1 234 567 890"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Gender</Label>
                  <Select
                    onValueChange={(v) =>
                      form.setValue("gender", v as "male" | "female" | "other")
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dob">Date of Birth</Label>
                  <Input
                    id="dob"
                    type="date"
                    {...form.register("date_of_birth")}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  {...form.register("address")}
                  placeholder="123 Main St..."
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Saving..." : "Save Patient"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <DataTable
        columns={columns}
        data={patients as Patient[]}
        searchKey="first_name"
        searchPlaceholder="Search patients..."
      />
    </div>
  );
}
