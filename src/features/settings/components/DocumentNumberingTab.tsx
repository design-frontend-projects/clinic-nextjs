"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { getDocumentSequences } from "../actions";
import { DOCUMENT_TYPES } from "../domain/models";
import { TabError, TabLoading } from "./tab-states";
import { SequenceForm, type SequenceRow } from "./SequenceForm";

export function DocumentNumberingTab() {
  const t = useTranslations("settings.numbering");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["document-sequences"],
    queryFn: async (): Promise<SequenceRow[]> => {
      const result = await getDocumentSequences();
      if ("error" in result && result.error) throw new Error(result.error);
      return (result.data ?? []) as SequenceRow[];
    },
  });

  if (isLoading) return <TabLoading />;
  if (error) return <TabError message={(error as Error).message} onRetry={() => refetch()} />;

  // Rows are ordered latest-first per type; the first hit is the active config.
  const latestByType = new Map<string, SequenceRow>();
  for (const row of data ?? []) {
    if (!latestByType.has(row.document_type)) latestByType.set(row.document_type, row);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("description")}</p>
      {DOCUMENT_TYPES.map((documentType) => (
        <SequenceForm
          key={`${documentType}-${latestByType.get(documentType)?.period_key ?? "new"}`}
          documentType={documentType}
          latest={latestByType.get(documentType)}
        />
      ))}
    </div>
  );
}
