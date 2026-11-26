"use client";

import { Building2 } from "lucide-react";
import { useRouter, usePathname } from "@/i18n/routing";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ClinicOption } from "@/types/medication.types";

interface MedicationClinicSelectorProps {
  clinics: ClinicOption[];
  value: string;
  label: string;
}

/**
 * Owner-facing clinic picker. Changing the clinic reloads the medication list
 * via the `?clinic=` query param (server component re-fetches).
 */
export function MedicationClinicSelector({
  clinics,
  value,
  label,
}: MedicationClinicSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();

  const onChange = (clinicId: string) => {
    router.replace(`${pathname}?clinic=${clinicId}`);
  };

  return (
    <div className="flex w-full items-center gap-2 sm:w-auto">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          className="w-full sm:w-[240px]"
          aria-label={label}
        >
          <div className="flex items-center gap-2 truncate">
            <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            <SelectValue placeholder={label} />
          </div>
        </SelectTrigger>
        <SelectContent>
          {clinics.map((clinic) => (
            <SelectItem key={clinic.id} value={clinic.id}>
              {clinic.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
