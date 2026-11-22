// Server Component — no hooks or interactivity needed

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  trend?: { value: number; positive: boolean };
  className?: string;
}

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  className,
}: StatCardProps) {
  return (
    <Card
      elevated
      cornerAccent
      className={cn("relative overflow-hidden py-0", className)}
    >
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1.5">
            <p className="text-eyebrow font-medium text-muted-foreground dark:uppercase">
              {title}
            </p>
            <p className="text-3xl font-bold tracking-tight tabular-nums text-foreground">
              {value}
            </p>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
            {trend && (
              <p
                className={cn(
                  "text-xs font-semibold tabular-nums",
                  trend.positive ? "text-accent-green" : "text-accent-red",
                )}
              >
                {trend.positive ? "↑" : "↓"} {Math.abs(trend.value)}%{" "}
                <span className="font-normal text-muted-foreground">
                  vs last month
                </span>
              </p>
            )}
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-button)] border border-hairline-soft bg-canvas-soft dark:border-hairline dark:bg-surface-elevated">
            <Icon
              className={cn(
                "h-5 w-5",
                trend?.positive
                  ? "text-accent-green"
                  : trend
                    ? "text-accent-red"
                    : "text-primary",
              )}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
