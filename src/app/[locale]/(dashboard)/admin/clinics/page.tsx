"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getClinics, createClinic } from "@/app/actions/clinic";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { clinicSchema, type Clinic } from "@/types/clinic.types";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Building, Plus, Settings2 } from "lucide-react";
import { useState } from "react";
import { BranchManagement } from "@/components/admin/branch-management";
import { Switch } from "@/components/ui/switch";

export default function ClinicAdminPage() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedClinicId, setSelectedClinicId] = useState<string | null>(null);

  const { data: clinics, isLoading } = useQuery({
    queryKey: ["clinics"],
    queryFn: () => getClinics(),
  });

  const createClinicMutation = useMutation({
    mutationFn: (data: Clinic) => createClinic(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clinics"] });
      toast.success("Clinic created successfully");
      setIsCreateOpen(false);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create clinic");
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<Clinic>({
    resolver: zodResolver(clinicSchema),
    defaultValues: {
      subscription_plan: "trial",
      status: "trial",
      have_pharmacy: false,
      have_lab: false,
      have_radio_center: false,
    },
  });

  const onSubmit = (data: Clinic) => {
    createClinicMutation.mutate(data);
  };

  if (isLoading) {
    return <div className="p-8">Loading clinics...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Clinic Definition
          </h1>
          <p className="text-muted-foreground">
            Manage your clinics, branches, and subscription plans.
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => reset()}>
              <Plus className="mr-2 h-4 w-4" />
              Add Clinic
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Clinic</DialogTitle>
              <DialogDescription>
                Add a new clinic to your organization. A main branch will be
                created automatically.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Clinic Name</Label>
                <Input
                  id="name"
                  {...register("name")}
                  placeholder="e.g. HealthCare Center"
                />
                {errors.name && (
                  <p className="text-xs text-destructive">
                    {errors.name.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="registration_number">Registration Number</Label>
                <Input
                  id="registration_number"
                  {...register("registration_number")}
                  placeholder="e.g. REG-12345"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" {...register("email")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" {...register("phone")} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t pt-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="have_pharmacy" className="cursor-pointer text-sm font-medium">Pharmacy</Label>
                  <div className="flex h-9 items-center">
                    <Switch
                      id="have_pharmacy"
                      checked={!!watch("have_pharmacy")}
                      onCheckedChange={(v) => setValue("have_pharmacy", v)}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="have_lab" className="cursor-pointer text-sm font-medium">Laboratory</Label>
                  <div className="flex h-9 items-center">
                    <Switch
                      id="have_lab"
                      checked={!!watch("have_lab")}
                      onCheckedChange={(v) => setValue("have_lab", v)}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="have_radio_center" className="cursor-pointer text-sm font-medium">Radiology</Label>
                  <div className="flex h-9 items-center">
                    <Switch
                      id="have_radio_center"
                      checked={!!watch("have_radio_center")}
                      onCheckedChange={(v) => setValue("have_radio_center", v)}
                    />
                  </div>
                </div>
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={createClinicMutation.isPending}
              >
                {createClinicMutation.isPending
                  ? "Creating..."
                  : "Create Clinic"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
        {clinics?.map((clinic) => (
          <Card
            key={clinic.id}
            className={
              selectedClinicId === clinic.id
                ? "ring-2 ring-primary transition-all duration-200"
                : "transition-all duration-200 hover:shadow-md"
            }
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="space-y-1">
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Building className="h-6 w-6 text-primary" />
                  {clinic.name}
                </CardTitle>
                <CardDescription>
                  Reg No: {clinic.registration_number || "N/A"} • Plan:{" "}
                  {clinic.subscription_plan}
                </CardDescription>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {clinic.have_pharmacy && (
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400">
                      Pharmacy
                    </Badge>
                  )}
                  {clinic.have_lab && (
                    <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400">
                      Laboratory
                    </Badge>
                  )}
                  {clinic.have_radio_center && (
                    <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/20 dark:text-purple-400">
                      Radiology Center
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant={clinic.status === "active" ? "default" : "secondary"}
                >
                  {clinic.status}
                </Badge>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    setSelectedClinicId(
                      clinic.id === selectedClinicId ? null : clinic.id,
                    )
                  }
                >
                  <Settings2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mt-4">
                <BranchManagement clinicId={clinic.id!} />
              </div>
            </CardContent>
          </Card>
        ))}

        {clinics?.length === 0 && (
          <Card className="bg-muted/50 border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Building className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
              <p className="text-xl font-semibold">No clinics defined</p>
              <p className="text-muted-foreground mt-1 max-w-sm">
                Get started by creating your first clinic. Each clinic can have
                multiple branches.
              </p>
              <Button
                variant="outline"
                className="mt-6"
                onClick={() => setIsCreateOpen(true)}
              >
                Add your first clinic
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
