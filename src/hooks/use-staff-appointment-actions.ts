"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  checkInStaffAppointment,
  updateStaffAppointmentStatus,
} from "@/app/actions/staff";
import { APPOINTMENT_KEYS } from "@/lib/appointments/use-appointments-realtime";
import type {
  AppointmentStatus,
  StaffAppointmentRow,
  StaffDashboardStats,
  StaffQueueItem,
} from "@/types/staff.types";

interface TransitionInput {
  id: string;
  status: AppointmentStatus;
  prevStatus?: AppointmentStatus;
}

interface SnapshotContext {
  prevQueue: StaffQueueItem[] | undefined;
  prevDashboard: StaffDashboardStats | undefined;
  prevAppointments: Array<[readonly unknown[], StaffAppointmentRow[] | undefined]>;
}

const ACTIVE_QUEUE_STATUSES: ReadonlySet<AppointmentStatus> = new Set([
  "scheduled",
  "checked_in",
]);

/**
 * Shared optimistic mutation hook for high-speed staff reception & dashboard
 * actions (Check-In, Complete, Undo Check-In, No-Show, Cancel). Updates all
 * staff React Query caches immediately so row transitions and KPI counters feel
 * instantaneous while staying consistent with Supabase Realtime.
 */
export function useStaffAppointmentActions() {
  const t = useTranslations("pages.staff");
  const queryClient = useQueryClient();
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());

  const transitionMutation = useMutation({
    mutationFn: async ({ id, status }: TransitionInput) => {
      if (status === "checked_in") {
        return checkInStaffAppointment(id);
      }
      return updateStaffAppointmentStatus(id, status);
    },
    onMutate: async ({ id, status, prevStatus }): Promise<SnapshotContext> => {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });

      await Promise.all([
        queryClient.cancelQueries({ queryKey: APPOINTMENT_KEYS.staffQueue }),
        queryClient.cancelQueries({ queryKey: APPOINTMENT_KEYS.staffDashboard }),
        queryClient.cancelQueries({
          queryKey: APPOINTMENT_KEYS.staffAppointments,
        }),
      ]);

      const prevQueue = queryClient.getQueryData<StaffQueueItem[]>(
        APPOINTMENT_KEYS.staffQueue,
      );
      const prevDashboard = queryClient.getQueryData<StaffDashboardStats>(
        APPOINTMENT_KEYS.staffDashboard,
      );
      const prevAppointments = queryClient.getQueriesData<StaffAppointmentRow[]>(
        { queryKey: APPOINTMENT_KEYS.staffAppointments },
      );

      const nowIso = new Date().toISOString();
      const nextCheckedInAt =
        status === "checked_in"
          ? nowIso
          : status === "scheduled"
            ? null
            : undefined;

      // 1. Optimistically patch staff-queue
      queryClient.setQueryData<StaffQueueItem[]>(
        APPOINTMENT_KEYS.staffQueue,
        (old) => {
          if (!old) return old;
          if (!ACTIVE_QUEUE_STATUSES.has(status)) {
            return old.filter((item) => item.id !== id);
          }
          return old.map((item) =>
            item.id === id
              ? {
                  ...item,
                  status,
                  checkedInAt:
                    nextCheckedInAt !== undefined
                      ? nextCheckedInAt
                      : item.checkedInAt,
                }
              : item,
          );
        },
      );

      // 2. Optimistically patch staff-dashboard queue + KPIs
      queryClient.setQueryData<StaffDashboardStats>(
        APPOINTMENT_KEYS.staffDashboard,
        (old) => {
          if (!old) return old;
          const matchingRow = old.queue.find((q) => q.id === id);
          const inferredPrev = prevStatus ?? matchingRow?.status;

          let checkedInDelta = 0;
          let completedDelta = 0;
          if (inferredPrev && inferredPrev !== status) {
            if (status === "checked_in") checkedInDelta += 1;
            if (inferredPrev === "checked_in") checkedInDelta -= 1;
            if (status === "completed") completedDelta += 1;
            if (inferredPrev === "completed") completedDelta -= 1;
          }

          const nextQueue = ACTIVE_QUEUE_STATUSES.has(status)
            ? old.queue.map((item) =>
                item.id === id
                  ? {
                      ...item,
                      status,
                      checkedInAt:
                        nextCheckedInAt !== undefined
                          ? nextCheckedInAt
                          : item.checkedInAt,
                    }
                  : item,
              )
            : old.queue.filter((item) => item.id !== id);

          const nextCompleted = Math.max(old.completedToday + completedDelta, 0);
          return {
            ...old,
            checkedInQueue: Math.max(old.checkedInQueue + checkedInDelta, 0),
            completedToday: nextCompleted,
            remainingToday: Math.max(old.todaysAppointments - nextCompleted, 0),
            queue: nextQueue,
            throughput: old.throughput.map((pt) => {
              if (inferredPrev && pt.status === inferredPrev && inferredPrev !== status) {
                return { ...pt, count: Math.max(pt.count - 1, 0) };
              }
              if (pt.status === status && inferredPrev !== status) {
                return { ...pt, count: pt.count + 1 };
              }
              return pt;
            }),
          };
        },
      );

      // 3. Optimistically patch staff-appointments (all active date filters)
      queryClient.setQueriesData<StaffAppointmentRow[]>(
        { queryKey: APPOINTMENT_KEYS.staffAppointments },
        (old) => {
          if (!old) return old;
          return old.map((row) =>
            row.id === id
              ? {
                  ...row,
                  status,
                  checkedInAt:
                    nextCheckedInAt !== undefined
                      ? nextCheckedInAt
                      : row.checkedInAt,
                }
              : row,
          );
        },
      );

      return { prevQueue, prevDashboard, prevAppointments };
    },
    onError: (error, _variables, context) => {
      if (context) {
        queryClient.setQueryData(APPOINTMENT_KEYS.staffQueue, context.prevQueue);
        queryClient.setQueryData(
          APPOINTMENT_KEYS.staffDashboard,
          context.prevDashboard,
        );
        for (const [key, data] of context.prevAppointments) {
          queryClient.setQueryData(key, data);
        }
      }
      toast.error(
        error instanceof Error ? error.message : t("actionFailedToast"),
      );
    },
    onSuccess: (_data, variables) => {
      if (variables.status === "checked_in") {
        toast.success(t("checkedInToast"));
      } else if (variables.status === "completed") {
        toast.success(t("completedToast"));
      } else if (variables.status === "no_show") {
        toast.success(t("noShowToast"));
      } else if (variables.status === "scheduled") {
        toast.success(t("undoCheckInToast"));
      } else if (variables.status === "cancelled") {
        toast.success(t("cancelledToast"));
      }
    },
    onSettled: (_data, _error, variables) => {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(variables.id);
        return next;
      });
      queryClient.invalidateQueries({ queryKey: APPOINTMENT_KEYS.staffQueue });
      queryClient.invalidateQueries({
        queryKey: APPOINTMENT_KEYS.staffDashboard,
      });
      queryClient.invalidateQueries({
        queryKey: APPOINTMENT_KEYS.staffAppointments,
      });
      queryClient.invalidateQueries({ queryKey: APPOINTMENT_KEYS.bookings });
      queryClient.invalidateQueries({ queryKey: APPOINTMENT_KEYS.doctor });
      queryClient.invalidateQueries({ queryKey: APPOINTMENT_KEYS.admin });
    },
  });

  return {
    pendingIds,
    checkIn: (id: string, prevStatus?: AppointmentStatus) =>
      transitionMutation.mutate({ id, status: "checked_in", prevStatus }),
    complete: (id: string, prevStatus?: AppointmentStatus) =>
      transitionMutation.mutate({ id, status: "completed", prevStatus }),
    markNoShow: (id: string, prevStatus?: AppointmentStatus) =>
      transitionMutation.mutate({ id, status: "no_show", prevStatus }),
    undoCheckIn: (id: string, prevStatus?: AppointmentStatus) =>
      transitionMutation.mutate({ id, status: "scheduled", prevStatus }),
    cancel: (id: string, prevStatus?: AppointmentStatus) =>
      transitionMutation.mutate({ id, status: "cancelled", prevStatus }),
  };
}
