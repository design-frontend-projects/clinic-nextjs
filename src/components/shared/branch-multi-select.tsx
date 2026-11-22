"use client";

import { useState } from "react";
import {
  Building,
  ChevronsUpDown,
  MapPin,
  Plus,
  Star,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { cn } from "@/lib/utils";

export interface BranchSelectOption {
  id: string;
  name: string;
  address?: string | null;
  status?: "active" | "inactive";
}

interface BranchMultiSelectProps {
  options: BranchSelectOption[];
  selectedIds: string[];
  primaryId?: string | null;
  onChange: (branchIds: string[], primaryBranchId: string | undefined) => void;
  onQuickAdd?: () => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  primaryLabel?: string;
  setPrimaryLabel?: string;
  inactiveLabel?: string;
  quickAddLabel?: string;
  selectedCountLabel?: (count: number) => string;
  disabled?: boolean;
}

export function BranchMultiSelect({
  options,
  selectedIds,
  primaryId,
  onChange,
  onQuickAdd,
  placeholder = "Select branches...",
  searchPlaceholder = "Search branches...",
  emptyText = "No branches available.",
  primaryLabel = "Primary",
  setPrimaryLabel = "Set primary",
  inactiveLabel = "Inactive",
  quickAddLabel = "Define a new branch",
  selectedCountLabel,
  disabled = false,
}: BranchMultiSelectProps) {
  const [open, setOpen] = useState(false);

  const selectedSet = new Set(selectedIds);
  const effectivePrimary =
    primaryId && selectedSet.has(primaryId) ? primaryId : selectedIds[0];

  const selectedOptions = options.filter((o) => selectedSet.has(o.id));

  const toggle = (branchId: string) => {
    if (selectedSet.has(branchId)) {
      const next = selectedIds.filter((id) => id !== branchId);
      const nextPrimary =
        effectivePrimary === branchId ? next[0] : effectivePrimary;
      onChange(next, nextPrimary);
    } else {
      const next = [...selectedIds, branchId];
      const nextPrimary = effectivePrimary ?? branchId;
      onChange(next, nextPrimary);
    }
  };

  const setPrimary = (branchId: string) => {
    if (!selectedSet.has(branchId)) return;
    onChange(selectedIds, branchId);
  };

  const triggerText =
    selectedOptions.length === 0
      ? placeholder
      : selectedOptions.length === 1
        ? selectedOptions[0].name
        : selectedCountLabel
          ? selectedCountLabel(selectedOptions.length)
          : `${selectedOptions.length} branches selected`;

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full justify-between font-normal"
          >
            <span className="flex items-center gap-2 truncate">
              <Building className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span
                className={cn(
                  "truncate",
                  selectedOptions.length === 0 && "text-muted-foreground",
                )}
              >
                {triggerText}
              </span>
            </span>
            <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0"
          align="start"
        >
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {options.map((branch) => {
                  const isSelected = selectedSet.has(branch.id);
                  const isInactive =
                    branch.status === "inactive" && !isSelected;

                  return (
                    <CommandItem
                      key={branch.id}
                      value={`${branch.name} ${branch.address ?? ""}`}
                      disabled={isInactive}
                      onSelect={() => {
                        if (!isInactive) toggle(branch.id);
                      }}
                      className="flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Checkbox
                          checked={isSelected}
                          disabled={isInactive}
                          aria-hidden="true"
                          tabIndex={-1}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate font-medium">
                              {branch.name}
                            </span>
                            {branch.status === "inactive" && (
                              <Badge
                                variant="secondary"
                                className="text-[10px] px-1.5 py-0"
                              >
                                {inactiveLabel}
                              </Badge>
                            )}
                          </div>
                          {branch.address && (
                            <p className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                              <MapPin className="h-3 w-3 shrink-0" />
                              <span className="truncate">{branch.address}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
              {onQuickAdd && (
                <>
                  <CommandSeparator />
                  <CommandGroup>
                    <CommandItem
                      onSelect={() => {
                        setOpen(false);
                        onQuickAdd();
                      }}
                      className="text-primary font-medium"
                    >
                      <Plus className="me-2 h-4 w-4" />
                      {quickAddLabel}
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedOptions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedOptions.map((branch) => {
            const isPrimary = effectivePrimary === branch.id;
            return (
              <Badge
                key={branch.id}
                variant={isPrimary ? "default" : "secondary"}
                className="flex items-center gap-1.5 pe-1 py-1"
              >
                <button
                  type="button"
                  onClick={() => setPrimary(branch.id)}
                  disabled={disabled}
                  className="inline-flex items-center gap-1 hover:opacity-80"
                  title={isPrimary ? primaryLabel : setPrimaryLabel}
                >
                  <Star
                    className={cn(
                      "h-3 w-3",
                      isPrimary ? "fill-current" : "opacity-60",
                    )}
                  />
                  <span>{branch.name}</span>
                  {isPrimary && (
                    <span className="text-[10px] opacity-85">
                      ({primaryLabel})
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => toggle(branch.id)}
                  disabled={disabled}
                  className="rounded-full p-0.5 hover:bg-background/20"
                  aria-label={`Remove ${branch.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}
