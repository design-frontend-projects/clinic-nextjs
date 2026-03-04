"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getBranches } from "@/app/actions/clinic";
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
import { updateProfileBranch } from "@/app/actions/profile";

interface BranchSelectorProps {
  currentBranchId: string | null;
  clinicId: string;
}

export function BranchSelector({
  currentBranchId,
  clinicId,
}: BranchSelectorProps) {
  const queryClient = useQueryClient();

  const { data: branches, isLoading } = useQuery({
    queryKey: ["branches", clinicId],
    queryFn: () => getBranches(clinicId),
  });

  const updateBranchMutation = useMutation({
    mutationFn: (branchId: string) => updateProfileBranch(branchId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-info"] });
      toast.success("Branch switched successfully");
      // Optionally refresh the page or trigger a data reload across the app
      window.location.reload();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to switch branch");
    },
  });

  const currentBranch = branches?.find((b) => b.id === currentBranchId);

  if (isLoading) {
    return <Skeleton className="h-9 w-[200px]" />;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="flex items-center gap-2 px-3 h-9 min-w-[160px] justify-between"
        >
          <div className="flex items-center gap-2 truncate">
            <Building2 className="h-4 w-4 text-primary shrink-0" />
            <span className="truncate">
              {currentBranch?.name || "Select Branch"}
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
        {branches?.map((branch) => (
          <DropdownMenuItem
            key={branch.id}
            onClick={() => updateBranchMutation.mutate(branch.id!)}
            className="flex flex-col items-start gap-0.5 py-2"
          >
            <span className="font-medium">{branch.name}</span>
            {branch.address && (
              <span className="text-xs text-muted-foreground truncate w-full">
                {branch.address}
              </span>
            )}
          </DropdownMenuItem>
        ))}
        {branches?.length === 0 && (
          <div className="p-2 text-xs text-center text-muted-foreground italic">
            No branches available
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
