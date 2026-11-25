import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

export type StatusVariant =
  | "scheduled"
  | "checked_in"
  | "completed"
  | "cancelled"
  | "no_show"
  | "active"
  | "inactive"
  | "blocked"
  | "draft"
  | "issued"
  | "paid"
  | "pending"
  | "refunded"
  | "trial"
  | "suspended"
  | "under_review"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "ordered"
  | "in_progress"
  | "confirmed"
  | "submitted"
  | "processing"
  | "received"
  | "dispensed"
  | "in_stock"
  | "low_stock"
  | "expired"
  | "archived"
  | "past_due"
  | "stopped";

export const statusConfig: Record<
  StatusVariant,
  { label: string; className: string }
> = {
  scheduled: {
    label: "Scheduled",
    className: "bg-accent-blue-soft text-accent-blue",
  },
  checked_in: {
    label: "Checked In",
    className: "bg-accent-yellow-soft text-accent-yellow",
  },
  completed: {
    label: "Completed",
    className: "bg-accent-green-soft text-accent-green",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-accent-red-soft text-accent-red",
  },
  no_show: {
    label: "No Show",
    className: "bg-muted text-muted-foreground",
  },
  active: {
    label: "Active",
    className: "bg-accent-green-soft text-accent-green",
  },
  inactive: {
    label: "Inactive",
    className: "bg-muted text-muted-foreground",
  },
  blocked: {
    label: "Blocked",
    className: "bg-accent-red-soft text-accent-red",
  },
  draft: {
    label: "Draft",
    className: "bg-muted text-muted-foreground",
  },
  issued: {
    label: "Issued",
    className: "bg-accent-blue-soft text-accent-blue",
  },
  paid: {
    label: "Paid",
    className: "bg-accent-green-soft text-accent-green",
  },
  pending: {
    label: "Pending",
    className: "bg-accent-yellow-soft text-accent-yellow",
  },
  refunded: {
    label: "Refunded",
    className: "bg-accent-blue-soft text-accent-blue",
  },
  trial: {
    label: "Trial",
    className: "bg-accent-blue-soft text-accent-blue",
  },
  suspended: {
    label: "Suspended",
    className: "bg-accent-yellow-soft text-accent-yellow",
  },
  under_review: {
    label: "Under Review",
    className: "bg-accent-yellow-soft text-accent-yellow",
  },
  pending_approval: {
    label: "Pending Approval",
    className: "bg-accent-yellow-soft text-accent-yellow",
  },
  approved: {
    label: "Approved",
    className: "bg-accent-green-soft text-accent-green",
  },
  rejected: {
    label: "Rejected",
    className: "bg-accent-red-soft text-accent-red",
  },
  ordered: {
    label: "Ordered",
    className: "bg-accent-blue-soft text-accent-blue",
  },
  in_progress: {
    label: "In Progress",
    className: "bg-accent-yellow-soft text-accent-yellow",
  },
  confirmed: {
    label: "Confirmed",
    className: "bg-accent-green-soft text-accent-green",
  },
  submitted: {
    label: "Submitted",
    className: "bg-accent-blue-soft text-accent-blue",
  },
  processing: {
    label: "Processing",
    className: "bg-accent-yellow-soft text-accent-yellow",
  },
  received: {
    label: "Received",
    className: "bg-accent-green-soft text-accent-green",
  },
  dispensed: {
    label: "Dispensed",
    className: "bg-accent-green-soft text-accent-green",
  },
  in_stock: {
    label: "In Stock",
    className: "bg-accent-green-soft text-accent-green",
  },
  low_stock: {
    label: "Low Stock",
    className: "bg-accent-yellow-soft text-accent-yellow",
  },
  expired: {
    label: "Expired",
    className: "bg-accent-red-soft text-accent-red",
  },
  archived: {
    label: "Archived",
    className: "bg-muted text-muted-foreground",
  },
  past_due: {
    label: "Past Due",
    className: "bg-accent-red-soft text-accent-red",
  },
  stopped: {
    label: "Stopped",
    className: "bg-accent-red-soft text-accent-red",
  },
};

export interface StatusTranslator {
  (key: string): string;
  has: (key: string) => boolean;
}

/**
 * Resolves the display label and Tailwind classes for a status badge without
 * invoking `t(key)` when a key is absent, avoiding `next-intl` MISSING_MESSAGE
 * console errors.
 */
export function resolveStatusBadge(
  status: string,
  t?: StatusTranslator,
): { label: string; className: string } {
  const normalizedStatus = status.trim().toLowerCase();
  const config = statusConfig[normalizedStatus as StatusVariant] || {
    label: status.trim().replace(/_/g, " "),
    className: "bg-muted text-muted-foreground",
  };

  let label = config.label;
  try {
    if (t && t.has(normalizedStatus)) {
      const translated = t(normalizedStatus);
      if (translated && translated !== `enums.status.${normalizedStatus}`) {
        label = translated;
      }
    }
  } catch {
    // Fallback if translation lookup throws (e.g. context is missing)
  }

  return { label, className: config.className };
}

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const t = useTranslations("enums.status");
  const { label, className: statusClassName } = resolveStatusBadge(status, t);

  return (
    <Badge
      variant="secondary"
      className={cn(
        "border-0 font-medium capitalize font-sans",
        statusClassName,
        className,
      )}
    >
      {label}
    </Badge>
  );
}
