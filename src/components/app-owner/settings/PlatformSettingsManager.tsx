"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlatformSettingsEditor } from "./PlatformSettingsEditor";
import { DefinitionsTable } from "./DefinitionsTable";
import { FeatureFlagsPanel } from "./FeatureFlagsPanel";

export function PlatformSettingsManager() {
  return (
    <Tabs defaultValue="values" className="space-y-4">
      <TabsList>
        <TabsTrigger value="values">Platform Values</TabsTrigger>
        <TabsTrigger value="definitions">Definitions</TabsTrigger>
        <TabsTrigger value="flags">Feature Flags</TabsTrigger>
      </TabsList>
      <TabsContent value="values">
        <PlatformSettingsEditor />
      </TabsContent>
      <TabsContent value="definitions">
        <DefinitionsTable />
      </TabsContent>
      <TabsContent value="flags">
        <FeatureFlagsPanel />
      </TabsContent>
    </Tabs>
  );
}
