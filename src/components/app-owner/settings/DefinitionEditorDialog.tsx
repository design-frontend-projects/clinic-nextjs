"use client";

import { useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { upsertSettingDefinition } from "@/app/actions/app-owner/settings";
import type { SettingDefinition } from "@/features/settings/domain/models";

const VALUE_TYPES = ["string", "number", "boolean", "enum", "json", "color", "email", "weekly_schedule"] as const;
const SCOPES = ["platform", "tenant", "user"] as const;

interface DefinitionEditorDialogProps {
  definition: SettingDefinition | null; // null = create new
  onClose: () => void;
}

export function DefinitionEditorDialog({ definition, onClose }: DefinitionEditorDialogProps) {
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();

  const [key, setKey] = useState(definition?.key ?? "");
  const [module, setModule] = useState(definition?.module ?? "");
  const [category, setCategory] = useState(definition?.category ?? "");
  const [valueType, setValueType] = useState<string>(definition?.value_type ?? "string");
  const [defaultValueJson, setDefaultValueJson] = useState(JSON.stringify(definition?.default_value ?? "", null, 2));
  const [validationJson, setValidationJson] = useState(
    definition?.validation ? JSON.stringify(definition.validation, null, 2) : ""
  );
  const [scopes, setScopes] = useState<string[]>(definition?.allowed_scopes ?? ["tenant"]);
  const [isSensitive, setIsSensitive] = useState(definition?.is_sensitive ?? false);
  const [isPublic, setIsPublic] = useState(definition?.is_public ?? false);
  const [description, setDescription] = useState(definition?.description ?? "");
  const [displayOrder, setDisplayOrder] = useState(definition?.display_order ?? 0);

  const toggleScope = (scope: string, checked: boolean) => {
    setScopes((current) => (checked ? [...new Set([...current, scope])] : current.filter((s) => s !== scope)));
  };

  const handleSave = () => {
    let defaultValue: unknown;
    let validation: Record<string, unknown> | null = null;
    try {
      defaultValue = JSON.parse(defaultValueJson);
    } catch {
      toast.error("Default value must be valid JSON (strings need quotes)");
      return;
    }
    if (validationJson.trim()) {
      try {
        validation = JSON.parse(validationJson);
      } catch {
        toast.error("Validation must be valid JSON");
        return;
      }
    }

    startTransition(async () => {
      const result = await upsertSettingDefinition({
        key,
        module,
        category,
        value_type: valueType,
        default_value: defaultValue,
        validation,
        allowed_scopes: scopes,
        is_sensitive: isSensitive,
        is_public: isPublic,
        description: description || null,
        display_order: displayOrder,
      });
      if (result && "error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Definition saved");
      queryClient.invalidateQueries({ queryKey: ["setting-definitions"] });
      queryClient.invalidateQueries({ queryKey: ["platform-settings"] });
      onClose();
    });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{definition ? `Edit ${definition.key}` : "New Setting Definition"}</DialogTitle>
          <DialogDescription>
            Definitions describe a configurable key: its type, default, validation and where it can be set.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="def-key">Key</Label>
            <Input
              id="def-key"
              value={key}
              disabled={definition !== null}
              placeholder="module.setting_name"
              className="font-mono"
              onChange={(event) => setKey(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Value type</Label>
            <Select value={valueType} onValueChange={setValueType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VALUE_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="def-module">Module</Label>
            <Input id="def-module" value={module} onChange={(event) => setModule(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="def-category">Category</Label>
            <Input id="def-category" value={category} onChange={(event) => setCategory(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="def-default">Default value (JSON)</Label>
            <Textarea
              id="def-default"
              rows={3}
              className="font-mono text-xs"
              value={defaultValueJson}
              onChange={(event) => setDefaultValueJson(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="def-validation">Validation (JSON, optional)</Label>
            <Textarea
              id="def-validation"
              rows={3}
              className="font-mono text-xs"
              placeholder='{"min":0,"max":100} or {"enum":["a","b"]}'
              value={validationJson}
              onChange={(event) => setValidationJson(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Allowed scopes</Label>
            <div className="flex gap-4 pt-1">
              {SCOPES.map((scope) => (
                <label key={scope} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={scopes.includes(scope)}
                    onCheckedChange={(checked) => toggleScope(scope, checked === true)}
                  />
                  {scope}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="def-order">Display order</Label>
            <Input
              id="def-order"
              type="number"
              min={0}
              value={displayOrder}
              onChange={(event) => setDisplayOrder(Number(event.target.value))}
            />
          </div>
          <div className="flex items-center gap-6 md:col-span-2">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={isSensitive} onCheckedChange={(checked) => setIsSensitive(checked === true)} />
              Sensitive (stored in Vault, always masked)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={isPublic} onCheckedChange={(checked) => setIsPublic(checked === true)} />
              Public (exposable to unauthenticated pages)
            </label>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="def-description">Description</Label>
            <Input id="def-description" value={description} onChange={(event) => setDescription(event.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isPending || !key || !module || !category || scopes.length === 0}>
            {isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
