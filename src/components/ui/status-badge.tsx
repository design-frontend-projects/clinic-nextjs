import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusVariant =
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
  | "approved"
  | "rejected";

const statusConfig: Record<
  StatusVariant,
  { label: string; className: string }
> = {
  scheduled: {
    label: "Scheduled",
    className:
      "bg-accent-blue-soft text-accent-blue",
  },
  checked_in: {
    label: "Checked In",
    className:
      "bg-accent-yellow-soft text-accent-yellow",
  },
  completed: {
    label: "Completed",
    className:
      "bg-accent-green-soft text-accent-green",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-accent-red-soft text-accent-red",
  },
  no_show: {
    label: "No Show",
    className:
      "bg-surface-elevated text-mute",
  },
  active: {
    label: "Active",
    className:
      "bg-accent-green-soft text-accent-green",
  },
  inactive: {
    label: "Inactive",
    className:
      "bg-surface-elevated text-mute",
  },
  blocked: {
    label: "Blocked",
    className: "bg-accent-red-soft text-accent-red",
  },
  draft: {
    label: "Draft",
    className:
      "bg-surface-elevated text-mute",
  },
  issued: {
    label: "Issued",
    className:
      "bg-accent-blue-soft text-accent-blue",
  },
  paid: {
    label: "Paid",
    className:
      "bg-accent-green-soft text-accent-green",
  },
  pending: {
    label: "Pending",
    className:
      "bg-accent-yellow-soft text-accent-yellow",
  },
  refunded: {
    label: "Refunded",
    className:
      "bg-accent-blue-soft text-accent-blue",
  },
  trial: {
    label: "Trial",
    className:
      "bg-accent-blue-soft text-accent-blue",
  },
  suspended: {
    label: "Suspended",
    className:
      "bg-accent-yellow-soft text-accent-yellow",
  },
  approved: {
    label: "Approved",
    className:
      "bg-accent-green-soft text-accent-green",
  },
  rejected: {
    label: "Rejected",
    className: "bg-accent-red-soft text-accent-red",
  },
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status as StatusVariant] || {
    label: status,
    className: "bg-surface-elevated text-mute",
  };

  return (
    <Badge
      variant="secondary"
      className={cn(
        "border-0 font-medium capitalize font-inter",
        config.className,
        className,
      )}
    >
      {config.label}
    </Badge>
  );
}