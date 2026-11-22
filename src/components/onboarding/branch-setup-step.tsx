"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  MapPin,
  Phone,
  Building,
  Loader2,
  ArrowLeft,
  ArrowRight,
  Plus,
  Trash2,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  branchSchema,
  type BranchFormData,
  type OnboardingBranchItem,
} from "@/types/onboarding.types";
import { useTranslations } from "next-intl";

type BranchSetupStepProps = {
  defaultBranches?: OnboardingBranchItem[];
  onSubmit: (branches: BranchFormData[]) => void;
  onBack: () => void;
  loading?: boolean;
};

export function BranchSetupStep({
  defaultBranches = [],
  onSubmit,
  onBack,
  loading,
}: BranchSetupStepProps) {
  const t = useTranslations("branch");
  const tOnboarding = useTranslations("auth.onboarding");

  const [branches, setBranches] = useState<BranchFormData[]>(
    defaultBranches.map((b) => ({
      id: b.id,
      name: b.name,
      address: b.address ?? "",
      phone: b.phone ?? "",
    })),
  );
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    getValues,
    formState: { errors },
  } = useForm<BranchFormData>({
    resolver: zodResolver(branchSchema),
    defaultValues: {
      name: defaultBranches.length === 0 ? "Main Branch" : "",
      address: "",
      phone: "",
    },
  });

  const isDuplicateName = (name: string, excludeIndex: number | null) => {
    const normalized = name.trim().toLowerCase();
    return branches.some(
      (b, idx) =>
        idx !== excludeIndex && b.name.trim().toLowerCase() === normalized,
    );
  };

  const handleAddOrUpdate = (data: BranchFormData) => {
    const trimmedName = data.name.trim();
    if (isDuplicateName(trimmedName, editingIndex)) {
      setListError(t("duplicateName"));
      return;
    }

    setListError(null);
    const entry: BranchFormData = {
      id: editingIndex !== null ? branches[editingIndex]?.id : undefined,
      name: trimmedName,
      address: data.address?.trim() || "",
      phone: data.phone?.trim() || "",
    };

    if (editingIndex !== null) {
      setBranches((prev) =>
        prev.map((item, idx) => (idx === editingIndex ? entry : item)),
      );
      setEditingIndex(null);
    } else {
      setBranches((prev) => [...prev, entry]);
    }

    reset({ name: "", address: "", phone: "" });
  };

  const handleEdit = (idx: number) => {
    const item = branches[idx];
    setEditingIndex(idx);
    setListError(null);
    reset({
      id: item.id,
      name: item.name,
      address: item.address ?? "",
      phone: item.phone ?? "",
    });
  };

  const handleRemove = (idx: number) => {
    setBranches((prev) => prev.filter((_, i) => i !== idx));
    if (editingIndex === idx) {
      setEditingIndex(null);
      reset({ name: "", address: "", phone: "" });
    } else if (editingIndex !== null && editingIndex > idx) {
      setEditingIndex(editingIndex - 1);
    }
    setListError(null);
  };

  const handleContinue = () => {
    setListError(null);
    const draft = getValues();
    const draftName = draft.name?.trim() ?? "";

    // If the user typed a branch in the form (or is editing one) and clicked
    // Continue directly, validate and include it seamlessly.
    if (draftName.length > 0) {
      const parsed = branchSchema.safeParse({
        ...draft,
        name: draftName,
      });
      if (!parsed.success) {
        setListError(parsed.error.issues[0]?.message || t("nameRequired"));
        return;
      }
      if (isDuplicateName(draftName, editingIndex)) {
        setListError(t("duplicateName"));
        return;
      }

      const entry: BranchFormData = {
        id: editingIndex !== null ? branches[editingIndex]?.id : undefined,
        name: draftName,
        address: draft.address?.trim() || "",
        phone: draft.phone?.trim() || "",
      };

      const finalList =
        editingIndex !== null
          ? branches.map((b, idx) => (idx === editingIndex ? entry : b))
          : [...branches, entry];

      setBranches(finalList);
      setEditingIndex(null);
      reset({ name: "", address: "", phone: "" });
      onSubmit(finalList);
      return;
    }

    if (branches.length === 0) {
      setListError(t("atLeastOneBranch"));
      return;
    }

    onSubmit(branches);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm font-medium">{tOnboarding("branchesTitle")}</p>
        <p className="text-xs text-muted-foreground">
          {tOnboarding("branchesSubtitle")}
        </p>
      </div>

      {branches.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {t("definedBranches", { count: branches.length })}
            </span>
          </div>
          <div className="max-h-40 space-y-2 overflow-y-auto pe-1">
            {branches.map((branch, idx) => (
              <div
                key={branch.id ?? `${branch.name}-${idx}`}
                className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Building className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="font-medium truncate">{branch.name}</span>
                    {idx === 0 && (
                      <Badge variant="outline" className="text-[10px] py-0">
                        {t("primaryBadge")}
                      </Badge>
                    )}
                  </div>
                  {(branch.address || branch.phone) && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {[branch.address, branch.phone]
                        .filter(Boolean)
                        .join(" • ")}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleEdit(idx)}
                    disabled={loading}
                    aria-label={t("editBranch")}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => handleRemove(idx)}
                    disabled={loading}
                    aria-label={t("removeBranch")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <form
        onSubmit={handleSubmit(handleAddOrUpdate)}
        className="space-y-3 rounded-md border border-dashed p-3"
      >
        <div className="space-y-1.5">
          <Label htmlFor="branch_name" className="flex items-center gap-2">
            <Building className="h-4 w-4 text-muted-foreground" />
            {t("name")} *
          </Label>
          <Input
            id="branch_name"
            placeholder={t("namePlaceholder")}
            {...register("name")}
            autoFocus
          />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="address" className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              {t("address")}
            </Label>
            <Input
              id="address"
              placeholder={t("addressPlaceholder")}
              {...register("address")}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="branch_phone" className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              {t("phone")}
            </Label>
            <Input
              id="branch_phone"
              placeholder={t("phonePlaceholder")}
              {...register("phone")}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="submit"
            variant="secondary"
            size="sm"
            disabled={loading}
            className="w-full"
          >
            <Plus className="me-1.5 h-4 w-4" />
            {editingIndex !== null ? t("updateBranchInList") : t("addBranchToList")}
          </Button>
          {editingIndex !== null && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditingIndex(null);
                setListError(null);
                reset({ name: "", address: "", phone: "" });
              }}
            >
              {t("cancelEdit")}
            </Button>
          )}
        </div>
      </form>

      {listError && <p className="text-xs text-destructive">{listError}</p>}

      <div className="flex flex-col gap-3 pt-2">
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            disabled={loading}
            className="flex-1"
          >
            <ArrowLeft className="me-2 h-4 w-4" />
            {tOnboarding("back")}
          </Button>
          <Button
            type="button"
            onClick={handleContinue}
            className="flex-1"
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="me-2 h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="me-2 h-4 w-4" />
            )}
            {tOnboarding("continue")}
          </Button>
        </div>
        <Button
          type="button"
          variant="ghost"
          onClick={() => onSubmit([])}
          disabled={loading}
          className="w-full text-muted-foreground"
        >
          {tOnboarding("skipForNow")}
        </Button>
      </div>
    </div>
  );
}
