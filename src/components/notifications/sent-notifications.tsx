"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations, useLocale } from "next-intl";
import { formatDistanceToNow } from "date-fns";
import { ar as arLocale } from "date-fns/locale";
import type { ColumnDef } from "@tanstack/react-table";
import { Loader2, Pencil, RefreshCw, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import {
  getSentNotifications,
  getSentNotificationDraft,
  resendNotification,
} from "@/app/actions/notifications";
import { NOTIFICATION_KEYS } from "@/lib/notifications/use-notifications-realtime";
import type { SendNotificationData, SentNotification } from "@/types/notification.types";
import { ComposeNotificationDialog } from "./compose-notification-dialog";

const SENT_PAGE_SIZE = 100;

/** Sender-side history: everything the current user has sent, with resend. */
export function SentNotifications() {
  const t = useTranslations("notifications");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [editDraft, setEditDraft] = useState<SendNotificationData | null>(null);
  const [preparingId, setPreparingId] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: [...NOTIFICATION_KEYS.all, "sent"],
    queryFn: () => getSentNotifications({ page: 1, pageSize: SENT_PAGE_SIZE }),
  });

  const resend = useMutation({
    mutationFn: (groupId: string) => resendNotification(groupId),
    onSuccess: (result) => {
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(t("toast.resent", { count: result.count }));
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_KEYS.all });
    },
    onError: () => toast.error(t("toast.failed")),
  });

  const prepareEdit = async (groupId: string) => {
    setPreparingId(groupId);
    try {
      const draft = await getSentNotificationDraft(groupId);
      if ("error" in draft) {
        toast.error(draft.error);
        return;
      }
      setEditDraft(draft);
    } finally {
      setPreparingId(null);
    }
  };

  const columns = useMemo<ColumnDef<SentNotification>[]>(
    () => [
      {
        accessorKey: "title",
        header: t("sent.columns.message"),
        cell: ({ row }) => {
          const n = row.original;
          return (
            <div className="flex max-w-md flex-col">
              <span className="font-medium">{n.title}</span>
              <span className="line-clamp-1 text-xs text-muted-foreground">{n.body}</span>
            </div>
          );
        },
      },
      {
        accessorKey: "recipient_count",
        header: t("sent.columns.recipients"),
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            {row.original.recipient_count}
          </span>
        ),
      },
      {
        accessorKey: "priority",
        header: t("sent.columns.priority"),
        cell: ({ row }) =>
          row.original.priority === "important" ? (
            <Badge variant="destructive">{t("priority.important")}</Badge>
          ) : (
            <span className="text-muted-foreground">{t("priority.normal")}</span>
          ),
      },
      {
        accessorKey: "category",
        header: t("sent.columns.category"),
        cell: ({ row }) =>
          row.original.category ? (
            <span className="text-sm">{t(`category.${row.original.category}`)}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        accessorKey: "created_at",
        header: t("sent.columns.sent"),
        cell: ({ row }) =>
          formatDistanceToNow(new Date(row.original.created_at), {
            addSuffix: true,
            locale: locale === "ar" ? arLocale : undefined,
          }),
      },
      {
        id: "actions",
        cell: ({ row }) => {
          const n = row.original;
          const isPreparing = preparingId === n.group_id;
          const isResending = resend.isPending && resend.variables === n.group_id;
          return (
            <div className="flex items-center justify-end gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1"
                disabled={isPreparing}
                onClick={() => prepareEdit(n.group_id)}
              >
                {isPreparing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Pencil className="h-3.5 w-3.5" />
                )}
                {t("sent.editResend")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1"
                disabled={isResending}
                onClick={() => resend.mutate(n.group_id)}
              >
                {isResending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                {t("sent.resend")}
              </Button>
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, locale, preparingId, resend.isPending, resend.variables],
  );

  const items = data?.items ?? [];

  return (
    <>
      {items.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{t("sent.empty")}</p>
      ) : (
        <DataTable columns={columns} data={items} />
      )}

      <ComposeNotificationDialog
        open={editDraft !== null}
        onOpenChange={(v) => {
          if (!v) setEditDraft(null);
        }}
        prefill={editDraft ?? undefined}
      />
    </>
  );
}
