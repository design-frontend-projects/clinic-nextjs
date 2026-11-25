"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Loader2, Search } from "lucide-react";

import { Link } from "@/i18n/routing";
import { checkTenantRequestStatusAction } from "@/app/actions/auth";
import {
  checkRequestStatusSchema,
  type CheckRequestStatusData,
  type TenantRequestStatusDetails,
} from "@/types/tenant-request.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";

export function RequestStatusChecker({ initialRef }: { initialRef?: string }) {
  const t = useTranslations("auth.requestStatus");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [details, setDetails] = useState<TenantRequestStatusDetails | null>(
    null,
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CheckRequestStatusData>({
    resolver: zodResolver(checkRequestStatusSchema),
    defaultValues: {
      requestRef: initialRef ?? "",
      email: "",
    },
  });

  const onSubmit = async (data: CheckRequestStatusData) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await checkTenantRequestStatusAction(data);
      if ("error" in res) {
        setDetails(null);
        setErrorMessage(res.error);
        return;
      }
      setDetails(res.request);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="requestRef">{t("refLabel")}</Label>
          <Input
            id="requestRef"
            placeholder={t("refPlaceholder")}
            className="font-mono uppercase"
            {...register("requestRef")}
          />
          {errors.requestRef && (
            <p className="text-xs text-destructive">
              {errors.requestRef.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">{t("emailLabel")}</Label>
          <Input
            id="email"
            type="email"
            placeholder={t("emailPlaceholder")}
            {...register("email")}
          />
          {errors.email && (
            <p className="text-xs text-destructive">{errors.email.message}</p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? (
            <Loader2 className="me-2 h-4 w-4 animate-spin" />
          ) : (
            <Search className="me-2 h-4 w-4" />
          )}
          {t("checkButton")}
        </Button>
      </form>

      {errorMessage && (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-xs text-destructive"
        >
          {errorMessage}
        </div>
      )}

      {details && (
        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono font-bold text-foreground">
              {details.requestRef}
            </span>
            <StatusBadge status={details.status} />
          </div>

          <dl className="grid grid-cols-1 gap-2 text-xs sm:text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">{t("clinicLabel")}</dt>
              <dd className="font-medium text-foreground">
                {details.clinicName}
              </dd>
            </div>
            {details.planName && (
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">{t("planLabel")}</dt>
                <dd className="font-medium text-foreground">
                  {details.planName}
                </dd>
              </div>
            )}
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">{t("submittedAtLabel")}</dt>
              <dd>{new Date(details.submittedAt).toLocaleDateString()}</dd>
            </div>
            {details.reviewedAt && (
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">{t("reviewedAtLabel")}</dt>
                <dd>{new Date(details.reviewedAt).toLocaleDateString()}</dd>
              </div>
            )}
            {details.paymentStatus && (
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">
                  {t("paymentStatusLabel")}
                </dt>
                <dd>
                  <StatusBadge status={details.paymentStatus} />
                </dd>
              </div>
            )}
            {(details.status === "active" || details.status === "trial") &&
              details.startDate && (
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">{t("periodLabel")}</dt>
                  <dd>
                    {new Date(details.startDate).toLocaleDateString()} –{" "}
                    {details.endDate
                      ? new Date(details.endDate).toLocaleDateString()
                      : t("lifetime")}
                  </dd>
                </div>
              )}
          </dl>

          {details.status === "rejected" && details.rejectionReason && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
              <span className="font-semibold">{t("rejectionReasonLabel")}: </span>
              {details.rejectionReason}
            </div>
          )}

          {(details.status === "active" || details.status === "trial") && (
            <div className="pt-2 space-y-2">
              <p className="text-xs text-muted-foreground">
                {t("activeReadyHint")}
              </p>
              <Button asChild className="w-full" size="sm">
                <Link href="/sign-in">{t("signInButton")}</Link>
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
