"use client";

import { useState, useTransition } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { previewNextNumber, upsertDocumentSequence } from "../actions";

export interface SequenceRow {
  document_type: string;
  prefix: string;
  padding: number;
  reset_period: string;
  include_period: boolean;
  current_value: number;
  period_key: string;
}

interface SequenceFormProps {
  documentType: string;
  latest: SequenceRow | undefined;
}

export function SequenceForm({ documentType, latest }: SequenceFormProps) {
  const t = useTranslations("settings.numbering");
  const tCommon = useTranslations("settings");
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();

  const [prefix, setPrefix] = useState(latest?.prefix ?? `${documentType.slice(0, 3).toUpperCase()}-`);
  const [padding, setPadding] = useState(latest?.padding ?? 5);
  const [resetPeriod, setResetPeriod] = useState(latest?.reset_period ?? "never");
  const [includePeriod, setIncludePeriod] = useState(latest?.include_period ?? true);

  const previewQuery = useQuery({
    queryKey: ["sequence-preview", documentType, prefix, padding, resetPeriod, includePeriod],
    queryFn: async (): Promise<string> => {
      const result = await previewNextNumber({
        document_type: documentType,
        prefix,
        padding,
        reset_period: resetPeriod as "never" | "yearly" | "monthly",
        include_period: includePeriod,
      });
      if ("error" in result && result.error) throw new Error(result.error);
      return result.data ?? "";
    },
    staleTime: 10_000,
  });

  const handleSave = () => {
    startTransition(async () => {
      const result = await upsertDocumentSequence({
        document_type: documentType,
        prefix,
        padding,
        reset_period: resetPeriod as "never" | "yearly" | "monthly",
        include_period: includePeriod,
      });
      if (result && "error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(t("updated"));
      queryClient.invalidateQueries({ queryKey: ["document-sequences"] });
      queryClient.invalidateQueries({ queryKey: ["sequence-preview", documentType] });
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{t(`types.${documentType}` as never)}</CardTitle>
        <div className="text-sm">
          <span className="text-muted-foreground">{t("preview")}: </span>
          <span className="font-mono">{previewQuery.data ?? "…"}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="space-y-1">
            <Label htmlFor={`${documentType}-prefix`}>{t("prefix")}</Label>
            <Input
              id={`${documentType}-prefix`}
              value={prefix}
              maxLength={20}
              onChange={(event) => setPrefix(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${documentType}-padding`}>{t("padding")}</Label>
            <Input
              id={`${documentType}-padding`}
              type="number"
              min={1}
              max={12}
              value={padding}
              onChange={(event) => setPadding(Number(event.target.value))}
            />
          </div>
          <div className="space-y-1">
            <Label>{t("resetPeriod")}</Label>
            <Select value={resetPeriod} onValueChange={setResetPeriod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="never">{t("periods.never")}</SelectItem>
                <SelectItem value="yearly">{t("periods.yearly")}</SelectItem>
                <SelectItem value="monthly">{t("periods.monthly")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 pt-6">
            <Switch checked={includePeriod} onCheckedChange={(checked) => setIncludePeriod(checked === true)} />
            <Label className="text-xs">{t("includePeriod")}</Label>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {t("currentValue")}: <span className="font-mono">{latest?.current_value ?? 0}</span>
          </p>
          <Button size="sm" onClick={handleSave} disabled={isPending}>
            {isPending ? tCommon("saving") : tCommon("save")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
