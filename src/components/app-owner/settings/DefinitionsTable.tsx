"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getSettingDefinitions } from "@/app/actions/app-owner/settings";
import type { SettingDefinition } from "@/features/settings/domain/models";
import { DefinitionEditorDialog } from "./DefinitionEditorDialog";

export function DefinitionsTable() {
  const [editing, setEditing] = useState<SettingDefinition | null>(null);
  const [creating, setCreating] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["setting-definitions"],
    queryFn: async (): Promise<SettingDefinition[]> => {
      const result = await getSettingDefinitions();
      if ("error" in result && result.error) throw new Error(result.error);
      return (result.data ?? []) as SettingDefinition[];
    },
  });

  if (isLoading) return <Skeleton className="h-48 w-full" />;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          New Definition
        </Button>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Key</TableHead>
              <TableHead>Module</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Scopes</TableHead>
              <TableHead>Flags</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data ?? []).map((definition) => (
              <TableRow key={definition.id}>
                <TableCell className="font-mono text-xs">{definition.key}</TableCell>
                <TableCell className="capitalize">{definition.module.replace(/_/g, " ")}</TableCell>
                <TableCell>
                  <Badge variant="outline">{definition.value_type}</Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {definition.allowed_scopes.join(", ")}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {definition.is_sensitive && <Badge variant="destructive">sensitive</Badge>}
                    {definition.is_public && <Badge variant="secondary">public</Badge>}
                  </div>
                </TableCell>
                <TableCell className="text-end">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(definition)}>
                    Edit
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {(creating || editing) && (
        <DefinitionEditorDialog
          key={editing?.id ?? "new"}
          definition={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
