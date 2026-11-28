"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Tag, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import {
  BILLING_ITEM_CATEGORIES,
  type BillingItemCategory,
} from "@/types/billing.types";
import type { BookingCatalogItemOption } from "@/types/booking.types";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface CatalogItemComboboxProps {
  items: BookingCatalogItemOption[];
  selectedFallback?: BookingCatalogItemOption | null;
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  disabled?: boolean;
}

/**
 * Searchable, category-filterable combobox that restricts selection strictly
 * to active clinic `billing_catalog_items` (no free-text entry).
 */
export function CatalogItemCombobox({
  items,
  selectedFallback,
  value,
  onChange,
  disabled = false,
}: CatalogItemComboboxProps) {
  const t = useTranslations("pages.booking");
  const tCat = useTranslations("admin.billing.categories");
  const locale = useLocale();

  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<
    "all" | BillingItemCategory
  >("all");

  const selectedItem = useMemo(() => {
    if (!value) return null;
    return (
      items.find((item) => item.id === value) ??
      (selectedFallback?.id === value ? selectedFallback : null)
    );
  }, [items, selectedFallback, value]);

  const availableCategories = useMemo(() => {
    const present = new Set(items.map((item) => item.category));
    return BILLING_ITEM_CATEGORIES.filter((cat) => present.has(cat));
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (categoryFilter !== "all" && item.category !== categoryFilter) {
        return false;
      }
      if (!q) return true;
      return (
        item.nameEn.toLowerCase().includes(q) ||
        item.nameAr.toLowerCase().includes(q) ||
        (item.description?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [items, categoryFilter, searchQuery]);

  const getPrimaryName = (item: BookingCatalogItemOption) =>
    locale === "ar" ? item.nameAr : item.nameEn;

  const getSecondaryName = (item: BookingCatalogItemOption) => {
    const primary = getPrimaryName(item);
    const secondary = locale === "ar" ? item.nameEn : item.nameAr;
    return secondary && secondary !== primary ? secondary : null;
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setSearchQuery("");
          setCategoryFilter("all");
        }
      }}
    >
      <div className="flex items-center gap-1.5">
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "h-auto min-h-9 w-full flex-1 justify-between gap-2 px-3 py-1.5 text-start font-normal",
              !selectedItem && "text-muted-foreground",
            )}
          >
            {selectedItem ? (
              <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="truncate font-medium text-foreground">
                  {getPrimaryName(selectedItem)}
                </span>
                <Badge
                  variant="secondary"
                  className="h-5 shrink-0 px-1.5 text-[10px]"
                >
                  {tCat(selectedItem.category)}
                </Badge>
                {!selectedItem.isActive && (
                  <Badge
                    variant="outline"
                    className="h-5 shrink-0 px-1.5 text-[10px] text-amber-600 dark:text-amber-400"
                  >
                    {t("inactiveServiceTag")}
                  </Badge>
                )}
                <span
                  dir="ltr"
                  className="ms-auto shrink-0 font-mono text-xs text-muted-foreground tabular-nums"
                >
                  ${selectedItem.price.toFixed(2)}
                </span>
              </span>
            ) : (
              <span className="truncate">{t("selectService")}</span>
            )}
            <ChevronsUpDown className="ms-1 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>

        {selectedItem && !disabled && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("clearService")}
            title={t("clearService")}
            onClick={() => onChange(null)}
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <PopoverContent
        className="w-[min(420px,calc(100vw-2rem))] p-0"
        align="start"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t("searchServicesPlaceholder")}
            value={searchQuery}
            onValueChange={setSearchQuery}
          />

          {availableCategories.length > 0 && (
            <div className="flex flex-wrap gap-1 border-b border-hairline px-2.5 py-2">
              <Button
                type="button"
                size="sm"
                variant={categoryFilter === "all" ? "default" : "ghost"}
                onClick={() => setCategoryFilter("all")}
                className="h-6 rounded-full px-2.5 text-[11px]"
              >
                {t("allCategories")}
              </Button>
              {availableCategories.map((cat) => (
                <Button
                  key={cat}
                  type="button"
                  size="sm"
                  variant={categoryFilter === cat ? "default" : "ghost"}
                  onClick={() => setCategoryFilter(cat)}
                  className="h-6 rounded-full px-2.5 text-[11px]"
                >
                  {tCat(cat)}
                </Button>
              ))}
            </div>
          )}

          <CommandList>
            {items.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">
                {t("emptyCatalogHint")}
              </div>
            ) : filteredItems.length === 0 ? (
              <CommandEmpty>{t("noServicesFound")}</CommandEmpty>
            ) : (
              <CommandGroup>
                {filteredItems.map((item) => {
                  const primary = getPrimaryName(item);
                  const secondary = getSecondaryName(item);
                  const isSelected = item.id === value;
                  return (
                    <CommandItem
                      key={item.id}
                      value={item.id}
                      onSelect={() => {
                        onChange(item.id);
                        setOpen(false);
                      }}
                      className="flex items-center justify-between gap-2 py-2"
                    >
                      <div className="flex min-w-0 flex-1 items-start gap-2">
                        <Check
                          className={cn(
                            "mt-0.5 h-4 w-4 shrink-0",
                            isSelected ? "opacity-100" : "opacity-0",
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="truncate font-medium text-foreground">
                              {primary}
                            </span>
                            <Badge
                              variant="secondary"
                              className="h-4.5 px-1.5 text-[10px]"
                            >
                              {tCat(item.category)}
                            </Badge>
                          </div>
                          {secondary && (
                            <p className="truncate text-[11px] text-muted-foreground">
                              {secondary}
                            </p>
                          )}
                        </div>
                      </div>
                      <span
                        dir="ltr"
                        className="shrink-0 font-mono text-xs font-medium text-foreground tabular-nums"
                      >
                        ${item.price.toFixed(2)}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>

          {selectedItem && (
            <div className="border-t border-hairline p-1.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-full justify-center text-xs text-muted-foreground hover:text-foreground"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                <X className="me-1.5 h-3.5 w-3.5" />
                {t("clearService")}
              </Button>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
