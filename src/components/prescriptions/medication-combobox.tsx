"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Loader2, Plus } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
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
  CommandSeparator,
} from "@/components/ui/command";
import { getPrescriptionCatalog } from "@/app/actions/prescription";
import {
  formatMedicineLabel,
  type CatalogMedicineOption,
} from "@/types/medication.types";
import { MedicineFormDialog } from "@/components/medicines/medicine-form-dialog";

interface MedicationSelection {
  name: string;
  medicationId: string;
  medicine: CatalogMedicineOption;
}

interface MedicationComboboxProps {
  value: string;
  selectedId?: string | null;
  onChange: (selection: MedicationSelection) => void;
  placeholder?: string;
  disabled?: boolean;
}

function summarizeCatalogDefaults(med: CatalogMedicineOption): string {
  return [
    med.default_dosage,
    med.default_frequency,
    med.default_duration,
    med.route,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Catalog-only medication picker: loads active clinic medicines immediately on
 * open, shows prescribing defaults preview, and lets authorized users (doctor
 * or owner) quick-add a missing medicine directly into the clinic catalog.
 */
export function MedicationCombobox({
  value,
  selectedId,
  onChange,
  placeholder,
  disabled = false,
}: MedicationComboboxProps) {
  const t = useTranslations("prescriptions.combobox");
  const queryClient = useQueryClient();
  const resolvedPlaceholder = placeholder ?? t("searchMedicationPlaceholder");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddInitialName, setQuickAddInitialName] = useState("");

  const { data, isFetching } = useQuery({
    queryKey: ["prescriptionCatalog", query],
    queryFn: () => getPrescriptionCatalog(query),
    enabled: !disabled && open,
  });

  const results = data?.medicines ?? [];
  const canQuickAdd = data?.canQuickAdd ?? false;
  const trimmed = query.trim();

  function openQuickAdd() {
    setQuickAddInitialName(trimmed);
    setOpen(false);
    setQuickAddOpen(true);
  }

  function selectMedicine(med: CatalogMedicineOption) {
    onChange({
      name: formatMedicineLabel(med),
      medicationId: med.id,
      medicine: med,
    });
    setOpen(false);
  }

  return (
    <>
      <Popover
        open={disabled ? false : open}
        onOpenChange={(next) => {
          if (!disabled) setOpen(next);
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            disabled={disabled}
            className={cn(
              "w-full justify-between font-normal",
              !value && "text-muted-foreground",
            )}
          >
            <span className="truncate">{value || t("selectMedication")}</span>
            <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[280px] p-0">
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

              {!isFetching && results.length === 0 && (
                <CommandEmpty className="py-4 px-3 text-center text-sm">
                  <p className="text-muted-foreground">
                    {t("noMedicinesFound")}
                  </p>
                  {canQuickAdd && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={openQuickAdd}
                    >
                      <Plus className="me-1.5 h-3.5 w-3.5" />
                      {trimmed
                        ? t("quickAddWithQuery", { value: trimmed })
                        : t("quickAdd")}
                    </Button>
                  )}
                </CommandEmpty>
              )}

              {results.length > 0 && (
                <CommandGroup heading={t("catalogHeading")}>
                  {results.map((med) => {
                    const label = formatMedicineLabel(med);
                    const defaultsSummary = summarizeCatalogDefaults(med);
                    const isSelected = selectedId
                      ? selectedId === med.id
                      : value === label;
                    return (
                      <CommandItem
                        key={med.id}
                        value={med.id}
                        onSelect={() => selectMedicine(med)}
                        className="items-start py-2"
                      >
                        <Check
                          className={cn(
                            "me-2 mt-0.5 h-4 w-4 shrink-0",
                            isSelected ? "opacity-100" : "opacity-0",
                          )}
                        />
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate font-medium">{label}</span>
                            {med.form && (
                              <Badge
                                variant="secondary"
                                className="shrink-0 px-1.5 py-0 text-[10px]"
                              >
                                {med.form}
                              </Badge>
                            )}
                          </div>
                          {defaultsSummary && (
                            <p className="truncate text-[11px] text-muted-foreground">
                              {defaultsSummary}
                            </p>
                          )}
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}

              {!isFetching && results.length > 0 && canQuickAdd && (
                <>
                  <CommandSeparator />
                  <CommandGroup>
                    <CommandItem
                      value="__quick_add_medicine__"
                      onSelect={openQuickAdd}
                      className="text-primary font-medium"
                    >
                      <Plus className="me-2 h-4 w-4" />
                      {trimmed
                        ? t("quickAddWithQuery", { value: trimmed })
                        : t("quickAdd")}
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {canQuickAdd && (
        <MedicineFormDialog
          open={quickAddOpen}
          onOpenChange={setQuickAddOpen}
          mode="create"
          initialGenericName={quickAddInitialName}
          onSaved={(created) => {
            queryClient.invalidateQueries({ queryKey: ["prescriptionCatalog"] });
            queryClient.invalidateQueries({ queryKey: ["clinicMedicines"] });
            selectMedicine(created);
            setQuery("");
          }}
        />
      )}
    </>
  );
}
