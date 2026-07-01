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
    <Card className={cn("relative overflow-hidden", className)}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-mute font-inter">{title}</p>
            <p className="text-3xl font-semibold tracking-tight text-ink">{value}</p>
            {description && (
              <p className="text-xs text-mute font-inter">{description}</p>
            )}
            {trend && (
              <p
                className={cn(
                  "text-xs font-medium font-inter",
                  trend.positive ? "text-accent-green" : "text-accent-red",
                )}
              >
                {trend.positive ? "↑" : "↓"} {Math.abs(trend.value)}%{" "}
                <span className="text-mute">vs last month</span>
              </p>
            )}
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-elevated">
            <Icon className={cn("h-6 w-6", trend?.positive ? "text-accent-green" : trend ? "text-accent-red" : "text-accent-blue")} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}