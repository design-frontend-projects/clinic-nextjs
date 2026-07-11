"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { createSupabaseClient } from "@/lib/supabase/client";

/** Shape of the row Supabase Realtime delivers for the notifications table. */
interface NotificationRow {
  id: string;
  recipient_id: string;
  title: string;
  body: string;
  priority: "normal" | "important";
  deep_link: string | null;
}

/** React Query keys used by the bell/panel/center so realtime can invalidate them. */
export const NOTIFICATION_KEYS = {
  all: ["notifications"] as const,
  unreadCount: ["notifications", "unread-count"] as const,
};

/**
 * Subscribe the current user to live notification changes via Supabase Realtime.
 *
 * On INSERT (a new notification for me): refresh the list + unread badge, and —
 * for `important` priority — pop an interrupting toast built from the payload
 * (self-sufficient, no follow-up fetch). On UPDATE (status -> read on another
 * device/tab): refresh so read state stays in sync across sessions (FR-16).
 *
 * Pass the current user's `profileId` (from `fetchTenantInfoAction`). The
 * subscription is a no-op until it is available.
 */
export function useNotificationsRealtime(profileId?: string | null): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!profileId) return;

    const supabase = createSupabaseClient();
    const filter = `recipient_id=eq.${profileId}`;

    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_KEYS.all });
    };

    const channel = supabase
      .channel(`notifications:${profileId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter },
        (payload: RealtimePostgresChangesPayload<NotificationRow>) => {
          invalidate();
          const row = payload.new as NotificationRow;
          if (row?.priority === "important") {
            toast(row.title, { description: row.body });
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter },
        () => invalidate(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profileId, queryClient]);
}
