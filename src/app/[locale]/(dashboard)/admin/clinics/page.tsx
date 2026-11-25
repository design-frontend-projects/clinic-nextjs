"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getClinics,
  getOwnerBranches,
  createClinic,
  updateClinic,
  upsertBranch,
} from "@/app/actions/clinic";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  clinicSchema,
  branchSchema,
  type Clinic,
  type Branch,
  type ClinicWithBranches,
} from "@/types/clinic.types";
import { toast } from "sonner";
import { Building, Building2, Plus, Settings2 } from "lucide-react";
import { BranchManagement } from "@/components/admin/branch-management";
import { ClinicBranchesPanel } from "@/components/admin/clinic-branches-panel";
import { BranchMultiSelect } from "@/components/shared/branch-multi-select";
import { useTranslations } from "next-intl";

export default function ClinicAdminPage() {
  const t = useTranslations("admin.clinics");
  const tBranch = useTranslations("admin.branches");
  const tBranchShared = useTranslations("branch");
  const tStatus = useTranslations("enums.status");
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"branches" | "clinics">("clinics");
  const [isClinicDialogOpen, setIsClinicDialogOpen] = useState(false);
  const [editingClinic, setEditingClinic] =
    useState<ClinicWithBranches | null>(null);

  // Quick-add branch dialog (can be triggered from the clinic modal or a clinic card)
  const [quickBranchOpen, setQuickBranchOpen] = useState(false);
  const [quickBranchTargetClinicId, setQuickBranchTargetClinicId] = useState<
    string | null
  >(null);

  const { data: clinics, isLoading: clinicsLoading } = useQuery({
    queryKey: ["clinics"],
    queryFn: () => getClinics(),
  });

  const { data: ownerBranches, isLoading: branchesLoading } = useQuery({
    queryKey: ["owner-branches"],
    queryFn: () => getOwnerBranches(),
  });

  const activeOwnerBranches = (ownerBranches ?? []).filter(
    (b) => b.status === "active",
  );

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["clinics"] });
    queryClient.invalidateQueries({ queryKey: ["owner-branches"] });
    queryClient.invalidateQueries({ queryKey: ["branches"] });
    queryClient.invalidateQueries({ queryKey: ["owner-clinics-branches"] });
  };

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<Clinic>({
    resolver: zodResolver(clinicSchema),
    defaultValues: {
      name: "",
      registration_number: "",
      email: "",
      phone: "",
      subscription_plan: "trial",
      status: "trial",
      have_pharmacy: false,
      have_lab: false,
      have_radio_center: false,
      branch_ids: [],
      primary_branch_id: null,
    },
  });

  const selectedBranchIds = watch("branch_ids") ?? [];
  const selectedPrimaryBranchId = watch("primary_branch_id");

  const {
    register: registerQuickBranch,
    handleSubmit: handleQuickBranchSubmit,
    reset: resetQuickBranch,
    formState: { errors: quickBranchErrors },
  } = useForm<Branch>({
    resolver: zodResolver(branchSchema),
    defaultValues: {
      name: "",
      address: "",
      phone: "",
      status: "active",
    },
  });

  const createClinicMutation = useMutation({
    mutationFn: (data: Clinic) => createClinic(data),
    onSuccess: () => {
      invalidateAll();
      toast.success(t("successCreated"));
      setIsClinicDialogOpen(false);
      setEditingClinic(null);
    },
    onError: (error) => {
      toast.error(error.message || t("errorCreated"));
    },
  });

  const updateClinicMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Clinic }) =>
      updateClinic(id, data),
    onSuccess: () => {
      invalidateAll();
      toast.success(t("successUpdated"));
      setIsClinicDialogOpen(false);
      setEditingClinic(null);
    },
    onError: (error) => {
      toast.error(error.message || t("errorUpdated"));
    },
  });

  const quickBranchMutation = useMutation({
    mutationFn: (data: Branch) =>
      upsertBranch({
        ...data,
        clinic_id: quickBranchTargetClinicId ?? undefined,
      }),
    onSuccess: (created) => {
      invalidateAll();
      toast.success(tBranch("toastCreated"));
      setQuickBranchOpen(false);
      resetQuickBranch({ name: "", address: "", phone: "", status: "active" });

      // If opened from the Clinic create/edit modal, auto-select the new branch.
      if (!quickBranchTargetClinicId && isClinicDialogOpen && created?.id) {
        const nextIds = Array.from(new Set([...selectedBranchIds, created.id]));
        setValue("branch_ids", nextIds, { shouldValidate: true });
        if (!selectedPrimaryBranchId) {
          setValue("primary_branch_id", created.id);
        }
      }
      setQuickBranchTargetClinicId(null);
    },
    onError: (error) => {
      toast.error(error.message || tBranch("toastOperationFailed"));
    },
  });

  const openCreateClinic = () => {
    setEditingClinic(null);
    const defaultIds =
      activeOwnerBranches.length === 1 ? [activeOwnerBranches[0].id] : [];
    reset({
      name: "",
      registration_number: "",
      email: "",
      phone: "",
      subscription_plan: "trial",
      status: "trial",
      have_pharmacy: false,
      have_lab: false,
      have_radio_center: false,
      branch_ids: defaultIds,
      primary_branch_id: defaultIds[0] ?? null,
    });
    setIsClinicDialogOpen(true);
  };

  const openEditClinic = (clinic: ClinicWithBranches) => {
    setEditingClinic(clinic);
    const branchIds = clinic.branches.map((b) => b.id);
    const primaryId =
      clinic.branches.find((b) => b.is_primary)?.id ?? branchIds[0] ?? null;
    reset({
      id: clinic.id,
      name: clinic.name,
      registration_number: clinic.registration_number ?? "",
      email: clinic.email ?? "",
      phone: clinic.phone ?? "",
      subscription_plan: clinic.subscription_plan ?? "trial",
      status:
        clinic.status === "active" || clinic.status === "suspended"
          ? clinic.status
          : "trial",
      have_pharmacy: !!clinic.have_pharmacy,
      have_lab: !!clinic.have_lab,
      have_radio_center: !!clinic.have_radio_center,
      branch_ids: branchIds,
      primary_branch_id: primaryId,
    });
    setIsClinicDialogOpen(true);
  };

  const openQuickAddBranch = (targetClinicId: string | null = null) => {
    setQuickBranchTargetClinicId(targetClinicId);
    resetQuickBranch({ name: "", address: "", phone: "", status: "active" });
    setQuickBranchOpen(true);
  };

  const onSubmitClinic = (data: Clinic) => {
    if (editingClinic) {
      updateClinicMutation.mutate({ id: editingClinic.id, data });
    } else {
      createClinicMutation.mutate(data);
    }
  };

  const isSavingClinic =
    createClinicMutation.isPending || updateClinicMutation.isPending;

  if (clinicsLoading && branchesLoading) {
    return <div className="p-8">{t("loading")}</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        {activeTab === "clinics" && (
          <Button onClick={openCreateClinic}>
            <Plus className="me-2 h-4 w-4" />
            {t("addClinic")}
          </Button>
        )}
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "branches" | "clinics")}
        className="space-y-6"
      >
        <TabsList>
          <TabsTrigger value="branches" className="flex items-center gap-2">
            <Building className="h-4 w-4" />
            {t("tabs.branches")}
            <Badge variant="secondary" className="ms-1 px-1.5 py-0 text-xs">
              {ownerBranches?.length ?? 0}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="clinics" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            {t("tabs.clinics")}
            <Badge variant="secondary" className="ms-1 px-1.5 py-0 text-xs">
              {clinics?.length ?? 0}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="branches">
          <BranchManagement
            branches={ownerBranches}
            isLoading={branchesLoading}
          />
        </TabsContent>

        <TabsContent value="clinics" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
            {clinics?.map((clinic) => (
              <Card
                key={clinic.id}
                className="transition-all duration-200 hover:shadow-md"
              >
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <div className="space-y-1 min-w-0">
                    <CardTitle className="text-xl flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-primary shrink-0" />
                      <span className="truncate">{clinic.name}</span>
                    </CardTitle>
                    <CardDescription>
                      {t("regNo")} {clinic.registration_number || t("na")} •{" "}
                      {t("plan")} {clinic.subscription_plan}
                    </CardDescription>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {clinic.have_pharmacy && (
                        <Badge
                          variant="outline"
                          className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400"
                        >
                          {t("form.pharmacy")}
                        </Badge>
                      )}
                      {clinic.have_lab && (
                        <Badge
                          variant="outline"
                          className="bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400"
                        >
                          {t("form.lab")}
                        </Badge>
                      )}
                      {clinic.have_radio_center && (
                        <Badge
                          variant="outline"
                          className="bg-purple-500/10 text-purple-600 border-purple-500/20 dark:text-purple-400"
                        >
                          {t("radiologyCenter")}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge
                      variant={
                        clinic.status === "active" ? "default" : "secondary"
                      }
                    >
                      {clinic.status}
                    </Badge>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => openEditClinic(clinic)}
                      aria-label={t("editClinic")}
                    >
                      <Settings2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="mt-3 pt-3 border-t">
                    <ClinicBranchesPanel
                      clinicId={clinic.id}
                      linkedBranches={clinic.branches}
                      ownerBranches={ownerBranches ?? []}
                      onQuickAddBranch={(cid) => openQuickAddBranch(cid)}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}

            {clinics?.length === 0 && (
              <Card className="bg-muted/50 border-dashed md:col-span-2 lg:col-span-3">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Building2 className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                  <p className="text-xl font-semibold">{t("noClinics")}</p>
                  <p className="text-muted-foreground mt-1 max-w-sm">
                    {t("noClinicsDesc")}
                  </p>
                  <Button
                    variant="outline"
                    className="mt-6"
                    onClick={openCreateClinic}
                  >
                    {t("addFirstClinic")}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Create / Edit Clinic Dialog */}
      <Dialog open={isClinicDialogOpen} onOpenChange={setIsClinicDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingClinic ? t("editClinic") : t("createClinic")}
            </DialogTitle>
            <DialogDescription>
              {editingClinic ? t("editDescription") : t("createDescription")}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmitClinic)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t("form.name")}</Label>
              <Input
                id="name"
                {...register("name")}
                placeholder={t("form.namePlaceholder")}
              />
              {errors.name && (
                <p className="text-xs text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>{t("form.branches")} *</Label>
              {activeOwnerBranches.length === 0 &&
              selectedBranchIds.length === 0 ? (
                <div className="rounded-md border border-dashed p-3 text-sm space-y-2 bg-muted/30">
                  <p className="text-muted-foreground text-xs">
                    {t("noBranchesPrompt")}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => openQuickAddBranch(null)}
                  >
                    <Plus className="me-1.5 h-3.5 w-3.5" />
                    {t("defineBranchFirst")}
                  </Button>
                </div>
              ) : (
                <BranchMultiSelect
                  options={ownerBranches ?? []}
                  selectedIds={selectedBranchIds}
                  primaryId={selectedPrimaryBranchId}
                  onChange={(ids, primaryId) => {
                    setValue("branch_ids", ids, { shouldValidate: true });
                    setValue("primary_branch_id", primaryId ?? null);
                  }}
                  onQuickAdd={() => openQuickAddBranch(null)}
                  placeholder={t("form.selectBranches")}
                  searchPlaceholder={t("form.searchBranches")}
                  emptyText={t("form.noBranchesFound")}
                  primaryLabel={tBranchShared("primaryBadge")}
                  setPrimaryLabel={tBranchShared("setPrimary")}
                  inactiveLabel={tStatus("inactive")}
                  quickAddLabel={t("quickAddBranch")}
                  selectedCountLabel={(count) =>
                    t("form.branchesCount", { count })
                  }
                  disabled={isSavingClinic}
                />
              )}
              <p className="text-xs text-muted-foreground">
                {t("form.branchesHint")}
              </p>
              {errors.branch_ids && (
                <p className="text-xs text-destructive">
                  {errors.branch_ids.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="registration_number">
                {t("form.registrationNumber")}
              </Label>
              <Input
                id="registration_number"
                {...register("registration_number")}
                placeholder={t("form.registrationPlaceholder")}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t("form.email")}</Label>
                <Input id="email" type="email" {...register("email")} />
                {errors.email && (
                  <p className="text-xs text-destructive">
                    {errors.email.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">{t("form.phone")}</Label>
                <Input id="phone" {...register("phone")} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t pt-4">
              <div className="flex flex-col gap-2">
                <Label
                  htmlFor="have_pharmacy"
                  className="cursor-pointer text-sm font-medium"
                >
                  {t("form.pharmacy")}
                </Label>
                <div className="flex h-9 items-center">
                  <Switch
                    id="have_pharmacy"
                    checked={!!watch("have_pharmacy")}
                    onCheckedChange={(v) => setValue("have_pharmacy", v)}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label
                  htmlFor="have_lab"
                  className="cursor-pointer text-sm font-medium"
                >
                  {t("form.lab")}
                </Label>
                <div className="flex h-9 items-center">
                  <Switch
                    id="have_lab"
                    checked={!!watch("have_lab")}
                    onCheckedChange={(v) => setValue("have_lab", v)}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label
                  htmlFor="have_radio_center"
                  className="cursor-pointer text-sm font-medium"
                >
                  {t("form.radiology")}
                </Label>
                <div className="flex h-9 items-center">
                  <Switch
                    id="have_radio_center"
                    checked={!!watch("have_radio_center")}
                    onCheckedChange={(v) => setValue("have_radio_center", v)}
                  />
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isSavingClinic}>
              {isSavingClinic
                ? editingClinic
                  ? t("saving")
                  : t("creating")
                : editingClinic
                  ? t("saveChanges")
                  : t("createClinicSubmit")}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Quick-Add Branch Dialog */}
      <Dialog open={quickBranchOpen} onOpenChange={setQuickBranchOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tBranch("addBranch")}</DialogTitle>
            <DialogDescription>{tBranch("dialogDesc")}</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={handleQuickBranchSubmit((data) =>
              quickBranchMutation.mutate(data),
            )}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="quick_branch_name">{tBranch("formName")}</Label>
              <Input
                id="quick_branch_name"
                {...registerQuickBranch("name")}
                placeholder={tBranch("formNamePlaceholder")}
                autoFocus
              />
              {quickBranchErrors.name && (
                <p className="text-xs text-destructive">
                  {quickBranchErrors.name.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="quick_branch_address">
                {tBranch("formAddress")}
              </Label>
              <Input
                id="quick_branch_address"
                {...registerQuickBranch("address")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quick_branch_phone">{tBranch("formPhone")}</Label>
              <Input
                id="quick_branch_phone"
                {...registerQuickBranch("phone")}
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={quickBranchMutation.isPending}
            >
              {quickBranchMutation.isPending
                ? tBranch("saving")
                : tBranch("saveBranch")}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
