"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { createSupabaseClient } from "@/lib/supabase/client";

/** Shape of the row Supabase Realtime delivers for the appointments table. */
interface AppointmentRow {
  id: string;
  clinic_id: string;
  status: string;
  checked_in_at: string | null;
}

/**
 * React Query keys the appointment views use so realtime can invalidate them.
 * Keys carrying a filter suffix (e.g. `["staff-appointments", filter]`) are
 * matched by prefix.
 */
export const APPOINTMENT_KEYS = {
  doctor: ["doctor-appointments"] as const,
  admin: ["appointments"] as const,
  staffDashboard: ["staff-dashboard"] as const,
  staffQueue: ["staff-queue"] as const,
  staffAppointments: ["staff-appointments"] as const,
};

interface UseAppointmentsRealtimeOptions {
  /** Called when an appointment transitions into `checked_in` (any client). */
  onCheckIn?: (row: AppointmentRow) => void;
}

/**
 * Subscribe the current clinic to live `appointments` changes via Supabase
 * Realtime. On any INSERT/UPDATE/DELETE for the tenant's rows, invalidate every
 * appointment query (doctor, admin, and the three staff views) so open tables
 * refetch immediately — a newly created or checked-in appointment appears
 * without a manual refresh. `onCheckIn` fires only on the scheduled ->
 * checked_in edge, letting a page surface a live toast.
 *
 * Pass the current tenant's `clinicId` (from `fetchTenantInfoAction`). The
 * subscription is a no-op until it is available. The `appointments` table is
 * already in the `supabase_realtime` publication with REPLICA IDENTITY FULL and
 * tenant RLS SELECT policies (migration 14), so no DB change is required.
 */
export function useAppointmentsRealtime(
  clinicId?: string | null,
  options?: UseAppointmentsRealtimeOptions,
): void {
  const queryClient = useQueryClient();

  // Keep the latest callback in a ref so an inline `onCheckIn` doesn't force the
  // channel to resubscribe on every render.
  const onCheckInRef = useRef(options?.onCheckIn);
  useEffect(() => {
    onCheckInRef.current = options?.onCheckIn;
  });

  useEffect(() => {
    if (!clinicId) return;

    const supabase = createSupabaseClient();
    const filter = `clinic_id=eq.${clinicId}`;

    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: APPOINTMENT_KEYS.doctor });
      queryClient.invalidateQueries({ queryKey: APPOINTMENT_KEYS.admin });
      queryClient.invalidateQueries({
        queryKey: APPOINTMENT_KEYS.staffDashboard,
      });
      queryClient.invalidateQueries({ queryKey: APPOINTMENT_KEYS.staffQueue });
      queryClient.invalidateQueries({
        queryKey: APPOINTMENT_KEYS.staffAppointments,
      });
    };

    const channel = supabase
      .channel(`appointments:${clinicId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "appointments", filter },
        () => invalidate(),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "appointments", filter },
        (payload: RealtimePostgresChangesPayload<AppointmentRow>) => {
          invalidate();
          const next = payload.new as AppointmentRow;
          const prev = payload.old as Partial<AppointmentRow>;
          if (
            next?.status === "checked_in" &&
            prev?.status !== "checked_in"
          ) {
            onCheckInRef.current?.(next);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "appointments", filter },
        () => invalidate(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clinicId, queryClient]);
}
