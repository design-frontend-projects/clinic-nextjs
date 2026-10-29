"use client";

import { useState, useTransition } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ColumnDef } from "@tanstack/react-table";
import { PackagePlus, Pencil, Tags } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  createBillingCatalogItem,
  getBillingCatalogItems,
  toggleBillingCatalogItemStatus,
  updateBillingCatalogItem,
} from "@/app/actions/billing";
import {
  BILLING_ITEM_CATEGORIES,
  billingCatalogItemSchema,
  type BillingCatalogItemData,
  type BillingCatalogItemRow,
  type BillingItemCategory,
} from "@/types/billing.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const emptyCatalogForm: BillingCatalogItemData = {
  name_en: "",
  name_ar: "",
  category: "consultation",
  price: 0,
  description: "",
  is_active: true,
};

export function BillingCatalogTab() {
  const t = useTranslations("admin.billing");
  const locale = useLocale();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BillingCatalogItemRow | null>(null);
  const [isPending, startTransition] = useTransition();

  const { data: items = [] } = useQuery({
    queryKey: ["billing-catalog-items", "all"],
    queryFn: () => getBillingCatalogItems({ activeOnly: false }),
  });

  const form = useForm<BillingCatalogItemData>({
    resolver: zodResolver(
      billingCatalogItemSchema,
    ) as Resolver<BillingCatalogItemData>,
    defaultValues: emptyCatalogForm,
  });

  const openCreate = () => {
    setEditing(null);
    form.reset(emptyCatalogForm);
    setDialogOpen(true);
  };

  const openEdit = (row: BillingCatalogItemRow) => {
    setEditing(row);
    form.reset({
      name_en: row.name_en,
      name_ar: row.name_ar,
      category: row.category,
      price: row.price,
      description: row.description ?? "",
      is_active: row.is_active,
    });
    setDialogOpen(true);
  };

  const onSubmit = (data: BillingCatalogItemData) => {
    startTransition(async () => {
      const result = editing
        ? await updateBillingCatalogItem(editing.id, data)
        : await createBillingCatalogItem(data);

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success(
        editing
          ? t("catalog.itemUpdated")
          : t("catalog.itemCreated"),
      );
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["billing-catalog-items"] });
    });
  };

  const handleToggleActive = (row: BillingCatalogItemRow, next: boolean) => {
    startTransition(async () => {
      const result = await toggleBillingCatalogItemStatus(row.id, next);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(
        next ? t("catalog.itemEnabled") : t("catalog.itemDisabled"),
      );
      queryClient.invalidateQueries({ queryKey: ["billing-catalog-items"] });
    });
  };

  const columns: ColumnDef<BillingCatalogItemRow>[] = [
    {
      accessorKey: "name_en",
      header: t("catalog.colNameEn"),
      cell: ({ row }) => (
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 dark:bg-sky-900/30">
            <Tags className="h-4 w-4 text-sky-600" />
          </div>
          <div>
            <p className="font-medium text-sm">{row.original.name_en}</p>
            {row.original.description && (
              <p className="text-xs text-muted-foreground line-clamp-1">
                {row.original.description}
              </p>
            )}
          </div>
        </div>
      ),
    },
    {
      accessorKey: "name_ar",
      header: t("catalog.colNameAr"),
      cell: ({ row }) => (
        <span className="font-medium text-sm" dir="rtl">
          {row.original.name_ar}
        </span>
      ),
    },
    {
      accessorKey: "category",
      header: t("catalog.colCategory"),
      cell: ({ row }) => (
        <Badge variant="secondary" className="capitalize">
          {t(`categories.${row.original.category}`)}
        </Badge>
      ),
    },
    {
      accessorKey: "price",
      header: t("catalog.colPrice"),
      cell: ({ row }) => (
        <span className="font-semibold">
          ${Number(row.original.price).toFixed(2)}
        </span>
      ),
    },
    {
      accessorKey: "is_active",
      header: t("catalog.colStatus"),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Switch
            checked={row.original.is_active}
            disabled={isPending}
            onCheckedChange={(v) => handleToggleActive(row.original, v)}
            aria-label={t("catalog.colStatus")}
          />
          <Badge variant={row.original.is_active ? "default" : "outline"}>
            {row.original.is_active
              ? t("catalog.enabled")
              : t("catalog.disabled")}
          </Badge>
        </div>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => openEdit(row.original)}
            aria-label={t("catalog.editItem")}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">
            {t("catalog.title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("catalog.subtitle")}
          </p>
        </div>
        <Button onClick={openCreate}>
          <PackagePlus className="mr-2 h-4 w-4" />
          {t("catalog.addItem")}
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={items}
        searchKey={locale === "ar" ? "name_ar" : "name_en"}
        searchPlaceholder={t("catalog.searchPlaceholder")}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? t("catalog.editItem") : t("catalog.addItem")}
            </DialogTitle>
            <DialogDescription>
              {t("catalog.dialogDescription")}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name_en">{t("catalog.nameEnLabel")} *</Label>
                <Input
                  id="name_en"
                  {...form.register("name_en")}
                  placeholder="e.g. General Consultation"
                />
                {form.formState.errors.name_en && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.name_en.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="name_ar">{t("catalog.nameArLabel")} *</Label>
                <Input
                  id="name_ar"
                  dir="rtl"
                  {...form.register("name_ar")}
                  placeholder="مثال: استشارة عامة"
                />
                {form.formState.errors.name_ar && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.name_ar.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("catalog.categoryLabel")} *</Label>
                <Select
                  value={form.watch("category")}
                  onValueChange={(v) =>
                    form.setValue("category", v as BillingItemCategory)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BILLING_ITEM_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {t(`categories.${cat}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="price">{t("catalog.priceLabel")} ($) *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  {...form.register("price")}
                />
                {form.formState.errors.price && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.price.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">
                {t("catalog.descriptionLabel")}
              </Label>
              <Textarea
                id="description"
                rows={2}
                {...form.register("description")}
                placeholder={t("catalog.descriptionPlaceholder")}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label htmlFor="catalog_is_active" className="font-medium">
                  {t("catalog.activeLabel")}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t("catalog.activeHint")}
                </p>
              </div>
              <Switch
                id="catalog_is_active"
                checked={form.watch("is_active")}
                onCheckedChange={(v) => form.setValue("is_active", v)}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending
                  ? t("common.saving")
                  : editing
                    ? t("common.saveChanges")
                    : t("catalog.addItem")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

