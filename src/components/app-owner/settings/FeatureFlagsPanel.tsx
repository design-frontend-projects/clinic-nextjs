"use client";

import { useState, useTransition } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getFeatureFlags, setTenantFeatureOverride, upsertFeatureFlag } from "@/app/actions/app-owner/settings";

interface FlagRow {
  id: string;
  key: string;
  name: string;
  name_ar: string | null;
  description: string | null;
  default_enabled: boolean;
  kill_switch: boolean;
  is_beta: boolean;
}

function FlagCard({ flag }: { flag: FlagRow }) {
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const [defaultEnabled, setDefaultEnabled] = useState(flag.default_enabled);
  const [killSwitch, setKillSwitch] = useState(flag.kill_switch);

  const handleSave = () => {
    startTransition(async () => {
      const result = await upsertFeatureFlag({
        key: flag.key,
        name: flag.name,
        name_ar: flag.name_ar,
        description: flag.description,
        default_enabled: defaultEnabled,
        kill_switch: killSwitch,
        is_beta: flag.is_beta,
      });
      if (result && "error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Flag "${flag.key}" saved`);
      queryClient.invalidateQueries({ queryKey: ["feature-flags"] });
    });
  };

  const dirty = defaultEnabled !== flag.default_enabled || killSwitch !== flag.kill_switch;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">{flag.name}</p>
          <Badge variant="outline" className="font-mono text-xs">
            {flag.key}
          </Badge>
          {flag.is_beta && <Badge variant="secondary">beta</Badge>}
        </div>
        {flag.description && <p className="text-xs text-muted-foreground">{flag.description}</p>}
      </div>
      <div className="flex items-center gap-6">
        <label className="flex items-center gap-2 text-xs">
          <Switch checked={defaultEnabled} onCheckedChange={(checked) => setDefaultEnabled(checked === true)} />
          Default on
        </label>
        <label className="flex items-center gap-2 text-xs text-destructive">
          <Switch checked={killSwitch} onCheckedChange={(checked) => setKillSwitch(checked === true)} />
          Kill switch
        </label>
        <Button size="sm" variant="outline" onClick={handleSave} disabled={isPending || !dirty}>
          Save
        </Button>
      </div>
    </div>
  );
}

function OverrideForm({ flags }: { flags: FlagRow[] }) {
  const [isPending, startTransition] = useTransition();
  const [tenantId, setTenantId] = useState("");
  const [featureKey, setFeatureKey] = useState(flags[0]?.key ?? "");
  const [isEnabled, setIsEnabled] = useState(true);
  const [reason, setReason] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const handleApply = () => {
    startTransition(async () => {
      const result = await setTenantFeatureOverride({
        tenantId,
        featureKey,
        isEnabled,
        reason: reason || null,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      });
      if (result && "error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Tenant override applied");
      setTenantId("");
      setReason("");
      setExpiresAt("");
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tenant Override</CardTitle>
        <CardDescription>
          Grant or block a feature for one tenant, overriding its plan. Find the tenant id on the Tenants page.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="override-tenant">Tenant ID</Label>
          <Input
            id="override-tenant"
            className="font-mono text-xs"
            placeholder="00000000-0000-0000-0000-000000000000"
            value={tenantId}
            onChange={(event) => setTenantId(event.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label>Feature</Label>
          <Select value={featureKey} onValueChange={setFeatureKey}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {flags.map((flag) => (
                <SelectItem key={flag.key} value={flag.key}>
                  {flag.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="override-reason">Reason</Label>
          <Input id="override-reason" value={reason} onChange={(event) => setReason(event.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="override-expiry">Expires at (optional)</Label>
          <Input
            id="override-expiry"
            type="date"
            value={expiresAt}
            onChange={(event) => setExpiresAt(event.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={isEnabled} onCheckedChange={(checked) => setIsEnabled(checked === true)} />
          <Label>{isEnabled ? "Enable feature" : "Disable feature"}</Label>
        </div>
        <div className="flex items-end justify-end">
          <Button size="sm" onClick={handleApply} disabled={isPending || !tenantId || !featureKey}>
            {isPending ? "Applying..." : "Apply Override"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function FeatureFlagsPanel() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["feature-flags"],
    queryFn: async (): Promise<FlagRow[]> => {
      const result = await getFeatureFlags();
      if ("error" in result && result.error) throw new Error(result.error);
      return (result.data ?? []) as FlagRow[];
    },
  });

  if (isLoading) return <Skeleton className="h-48 w-full" />;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {(data ?? []).map((flag) => (
          <FlagCard key={flag.id} flag={flag} />
        ))}
      </div>
      <OverrideForm flags={data ?? []} />
    </div>
  );
}
