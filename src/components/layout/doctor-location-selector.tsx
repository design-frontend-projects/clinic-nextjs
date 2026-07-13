"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Building2, ChevronDown, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { getMyAssignments, setActiveClinic } from "@/app/actions/profile";
import { updateProfileBranch } from "@/app/actions/profile";
import { BranchDisplay } from "./branch-display";

interface DoctorLocationSelectorProps {
  activeClinicId: string | null;
  activeBranchId: string | null;
  clinicName: string | null;
  branchName: string | null;
}

/**
 * Top-bar clinic + branch switcher for doctors. A doctor may be assigned across
 * several clinics/branches (profile_branches); this lets them pick which one
 * they are currently working in. Falls back to a read-only display when the
 * doctor has no multi-clinic assignments (legacy single-branch doctors).
 */
export function DoctorLocationSelector({
  activeClinicId,
  activeBranchId,
  clinicName,
  branchName,
}: DoctorLocationSelectorProps) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["my-assignments"],
    queryFn: () => getMyAssignments(),
  });

  const clinicMutation = useMutation({
    mutationFn: (clinicId: string) => setActiveClinic(clinicId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-info"] });
      toast.success("Clinic switched");
      window.location.reload();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to switch clinic");
    },
  });

  const branchMutation = useMutation({
    mutationFn: (branchId: string) => updateProfileBranch(branchId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-info"] });
      toast.success("Branch switched");
      window.location.reload();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to switch branch");
    },
  });

  if (isLoading) {
    return <Skeleton className="h-9 w-[320px]" />;
  }

  const clinics = data?.clinics ?? [];
  const branches = data?.branches ?? [];

  // Legacy doctor with no assignment rows: nothing to switch — show read-only.
  if (clinics.length === 0) {
    return <BranchDisplay clinicName={clinicName} branchName={branchName} />;
  }

  const clinicBranches = branches.filter((b) => b.clinic_id === activeClinicId);
  const activeClinic = clinics.find((c) => c.id === activeClinicId);
  const activeBranch = clinicBranches.find((b) => b.id === activeBranchId);

  return (
    <div className="flex items-center gap-2">
      {/* Clinic switcher */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="flex items-center gap-2 px-3 h-9 min-w-[150px] justify-between"
            disabled={clinicMutation.isPending}
          >
            <div className="flex items-center gap-2 truncate">
              <Building2 className="h-4 w-4 text-primary shrink-0" />
              <span className="truncate">
                {activeClinic?.name || clinicName || "Select Clinic"}
              </span>
            </div>
            <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[240px]">
          <DropdownMenuLabel className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Switch Clinic
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {clinics.map((c) => (
            <DropdownMenuItem
              key={c.id}
              onClick={() => c.id !== activeClinicId && clinicMutation.mutate(c.id)}
              className="py-2"
            >
              <span className="font-medium">{c.name}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Branch switcher (within the active clinic) */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="flex items-center gap-2 px-3 h-9 min-w-[150px] justify-between"
            disabled={branchMutation.isPending}
          >
            <div className="flex items-center gap-2 truncate">
              <MapPin className="h-4 w-4 text-primary shrink-0" />
              <span className="truncate">
                {activeBranch?.name || branchName || "Select Branch"}
              </span>
            </div>
            <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[240px]">
          <DropdownMenuLabel className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Switch Branch
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {clinicBranches.map((b) => (
            <DropdownMenuItem
              key={b.id}
              onClick={() => b.id !== activeBranchId && branchMutation.mutate(b.id)}
              className="flex flex-col items-start gap-0.5 py-2"
            >
              <span className="font-medium">{b.name}</span>
              {b.address && (
                <span className="text-xs text-muted-foreground truncate w-full">
                  {b.address}
                </span>
              )}
            </DropdownMenuItem>
          ))}
          {clinicBranches.length === 0 && (
            <div className="p-2 text-xs text-center text-muted-foreground italic">
              No branches available
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
