"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";

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
import { searchPatients } from "@/app/actions/admin";
import { useTranslations } from "next-intl";

interface PatientComboboxProps {
  value: string;
  onChange: (patientId: string) => void;
}

/** Searchable patient picker used when prescribing outside a patient context. */
export function PatientCombobox({ value, onChange }: PatientComboboxProps) {
  const t = useTranslations("prescriptions.combobox");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [label, setLabel] = useState("");

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["patientsSearch", query],
    queryFn: () => searchPatients(query),
    enabled: query.trim().length >= 2,
  });

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
          <span className="truncate">{label || t("selectPatient")}</span>
          <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t("searchPatientsPlaceholder")}
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
            {!isFetching && query.trim().length >= 2 && results.length === 0 && (
              <CommandEmpty>{t("noPatientsFound")}</CommandEmpty>
            )}
            {!isFetching && query.trim().length < 2 && (
              <CommandEmpty>{t("typeAtLeastTwo")}</CommandEmpty>
            )}
            <CommandGroup>
              {results.map((patient) => {
                const name =
                  `${patient.first_name ?? ""} ${patient.last_name ?? ""}`.trim() ||
                  t("unnamedPatient");
                return (
                  <CommandItem
                    key={patient.id}
                    value={patient.id}
                    onSelect={() => {
                      onChange(patient.id);
                      setLabel(name);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        patient.id === value ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {name}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {patient.phone || patient.email}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
