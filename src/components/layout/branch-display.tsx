"use client";

import { Building2, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";

interface BranchDisplayProps {
  clinicName: string | null;
  branchName: string | null;
}

/**
 * Read-only clinic + branch context shown to branch-locked roles
 * (doctor/staff/pharmacist/receptionist) instead of the BranchSelector.
 */
export function BranchDisplay({ clinicName, branchName }: BranchDisplayProps) {
  const t = useTranslations();

  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-muted/40 px-3 py-1.5">
      {clinicName && (
        <div className="flex items-center gap-1.5 text-sm">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-foreground">{clinicName}</span>
        </div>
      )}
      <div className="flex items-center gap-1.5 text-sm">
        <MapPin className="h-4 w-4 text-muted-foreground" />
        <span className="text-muted-foreground">
          {branchName ?? t("header.noBranchAssigned")}
        </span>
      </div>
    </div>
  );
}
