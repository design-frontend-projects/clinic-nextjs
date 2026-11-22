"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Loader2, Pencil } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { searchMedications } from "@/app/actions/prescription";
import { useTranslations } from "next-intl";

interface MedicationSelection {
  name: string;
  medicationId: string | null;
}

interface MedicationComboboxProps {
  value: string;
  onChange: (selection: MedicationSelection) => void;
  placeholder?: string;
}

/** Format a catalog row into a human-readable medication label. */
function formatMedicationLabel(med: {
  generic_name: string;
  brand_name: string | null;
  strength: string | null;
}): string {
  const base = med.brand_name
    ? `${med.brand_name} (${med.generic_name})`
    : med.generic_name;
  return med.strength ? `${base} ${med.strength}` : base;
}

/**
 * Hybrid medication picker: searches the clinic medications catalog, but also
 * lets the doctor commit a free-text name for a drug that isn't catalogued
 * (medicationId then stays null).
 */
export function MedicationCombobox({
  value,
  onChange,
  placeholder,
}: MedicationComboboxProps) {
  const t = useTranslations("prescriptions.combobox");
  const resolvedPlaceholder = placeholder ?? t("searchMedicationPlaceholder");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["medicationsSearch", query],
    queryFn: () => searchMedications(query),
    enabled: query.trim().length >= 2,
  });

  const trimmed = query.trim();
  const hasExactMatch = results.some(
    (m) => formatMedicationLabel(m).toLowerCase() === trimmed.toLowerCase(),
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground",
          )}
        >
          <span className="truncate">{value || t("selectMedication")}</span>
          <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={resolvedPlaceholder}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {isFetching && (
              <div className="p-3 text-center text-sm text-muted-foreground">
                <Loader2 className="me-2 inline h-4 w-4 animate-spin" />
                {t("searching")}
              </div>
            )}

            {!isFetching && trimmed.length < 2 && (
              <CommandEmpty>{t("typeAtLeastTwo")}</CommandEmpty>
            )}

            {results.length > 0 && (
              <CommandGroup heading={t("catalogHeading")}>
                {results.map((med) => {
                  const label = formatMedicationLabel(med);
                  return (
                    <CommandItem
                      key={med.id}
                      value={med.id}
                      onSelect={() => {
                        onChange({ name: label, medicationId: med.id });
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "me-2 h-4 w-4",
                          value === label ? "opacity-100" : "opacity-0",
                        )}
                      />
                      {label}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}

            {trimmed.length >= 2 && !hasExactMatch && !isFetching && (
              <CommandGroup heading={t("freeTextHeading")}>
                <CommandItem
                  value={`__freetext__${trimmed}`}
                  onSelect={() => {
                    onChange({ name: trimmed, medicationId: null });
                    setOpen(false);
                  }}
                >
                  <Pencil className="me-2 h-4 w-4" />
                  {t("useCustom", { value: trimmed })}
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
