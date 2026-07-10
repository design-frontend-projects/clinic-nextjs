"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { exportTenantSettings, importTenantSettings } from "../actions";

export function ImportExportControls() {
  const t = useTranslations("settings");
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const [importOpen, setImportOpen] = useState(false);
  const [importJson, setImportJson] = useState("");

  const handleExport = () => {
    startTransition(async () => {
      const result = await exportTenantSettings();
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      await navigator.clipboard.writeText(result.data ?? "");
      toast.success(t("exported"));
    });
  };

  const handleImport = () => {
    startTransition(async () => {
      const result = await importTenantSettings({ json: importJson });
      if (result && "error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(t("imported"));
      queryClient.invalidateQueries({ queryKey: ["tenant-settings"] });
      queryClient.invalidateQueries({ queryKey: ["settings-history"] });
      setImportOpen(false);
      setImportJson("");
    });
  };

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={handleExport} disabled={isPending}>
        <Download className="size-4" />
        {t("export")}
      </Button>
      <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
        <Upload className="size-4" />
        {t("import")}
      </Button>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{t("importTitle")}</DialogTitle>
            <DialogDescription>{t("importPrompt")}</DialogDescription>
          </DialogHeader>
          <Textarea
            rows={10}
            className="font-mono text-xs"
            value={importJson}
            onChange={(event) => setImportJson(event.target.value)}
            placeholder='{"format":"clinic-settings/v1","settings":[...]}'
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)} disabled={isPending}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleImport} disabled={isPending || importJson.trim().length < 2}>
              {isPending ? t("saving") : t("import")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
