"use client";

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
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-[220px]">
          <SelectValue />
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
