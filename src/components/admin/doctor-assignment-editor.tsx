"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Building2, MapPin, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DoctorBranchAssignment } from "@/types/clinic.types";
import { useTranslations } from "next-intl";

export interface OwnerClinicWithBranches {
  id: string;
  name: string;
  is_primary: boolean | null;
  branches: { id: string; name: string; address: string | null }[];
}

interface DoctorAssignmentEditorProps {
  clinics: OwnerClinicWithBranches[];
  assignments: DoctorBranchAssignment[];
  primaryBranchId: string | null;
  onChange: (
    assignments: DoctorBranchAssignment[],
    primaryBranchId: string | null,
  ) => void;
}

/**
 * Lets an admin/owner pick the clinics + branches a doctor can work in, across
 * every clinic the owner has. One selected branch is marked the home/default
 * (the clinic/branch the doctor lands in on first login). Selection state is
 * lifted to the parent form.
 */
export function DoctorAssignmentEditor({
  clinics,
  assignments,
  primaryBranchId,
  onChange,
}: DoctorAssignmentEditorProps) {
  const t = useTranslations("admin.personnel.assignmentEditor");
  const isSelected = (clinicId: string, branchId: string) =>
    assignments.some(
      (a) => a.clinic_id === clinicId && a.branch_id === branchId,
    );

  const toggleBranch = (clinicId: string, branchId: string) => {
    if (isSelected(clinicId, branchId)) {
      const next = assignments.filter(
        (a) => !(a.clinic_id === clinicId && a.branch_id === branchId),
      );
      // If we removed the current default, promote another selection (or clear).
      const stillHasPrimary = next.some((a) => a.branch_id === primaryBranchId);
      const nextPrimary = stillHasPrimary
        ? primaryBranchId
        : (next[0]?.branch_id ?? null);
      onChange(next, nextPrimary);
    } else {
      const next = [...assignments, { clinic_id: clinicId, branch_id: branchId }];
      // First selection becomes the default automatically.
      const nextPrimary = primaryBranchId ?? branchId;
      onChange(next, nextPrimary);
    }
  };

  const setPrimary = (clinicId: string, branchId: string) => {
    if (!isSelected(clinicId, branchId)) return;
    onChange(assignments, branchId);
  };

  if (clinics.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("noClinics")}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <ScrollArea className="max-h-64 rounded-md border">
        <div className="p-3 space-y-4">
          {clinics.map((clinic) => (
            <div key={clinic.id} className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                {clinic.name}
                {clinic.is_primary && (
                  <span className="text-xs text-muted-foreground">({t("defaultLabel")})</span>
                )}
              </div>
              {clinic.branches.length === 0 ? (
                <p className="ps-6 text-xs text-muted-foreground italic">
                  {t("noActiveBranches")}
                </p>
              ) : (
                <div className="ps-6 space-y-1.5">
                  {clinic.branches.map((branch) => {
                    const selected = isSelected(clinic.id, branch.id);
                    const isPrimary = primaryBranchId === branch.id;
                    return (
                      <div
                        key={`${clinic.id}-${branch.id}`}
                        className="flex items-center justify-between gap-2"
                      >
                        <Label className="flex items-center gap-2 font-normal cursor-pointer">
                          <Checkbox
                            checked={selected}
                            onCheckedChange={() =>
                              toggleBranch(clinic.id, branch.id)
                            }
                          />
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{branch.name}</span>
                        </Label>
                        {selected && (
                          <button
                            type="button"
                            onClick={() => setPrimary(clinic.id, branch.id)}
                            className={cn(
                              "flex items-center gap-1 rounded px-2 py-0.5 text-xs transition-colors",
                              isPrimary
                                ? "text-primary font-medium"
                                : "text-muted-foreground hover:text-foreground",
                            )}
                            title={
                              isPrimary
                                ? t("defaultBranchTitle")
                                : t("setDefaultBranchTitle")
                            }
                          >
                            <Star
                              className={cn(
                                "h-3.5 w-3.5",
                                isPrimary && "fill-current",
                              )}
                            />
                            {isPrimary ? t("defaultLabel") : t("setDefault")}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
      <p className="text-xs text-muted-foreground">
        {t("hint")}
      </p>
    </div>
  );
}
