import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { cn } from "@/lib/utils";

interface AppOwnerPageHeaderProps {
  title: string;
  description?: string;
  eyebrow?: string;
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
  className?: string;
}

/**
 * Shared responsive header for all App Owner screens, supporting optional
 * RTL-aware back navigation, eyebrow label, design-system Heading, and
 * wrapping action buttons.
 */
export function AppOwnerPageHeader({
  title,
  description,
  eyebrow,
  backHref,
  backLabel,
  actions,
  className,
}: AppOwnerPageHeaderProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {backHref && (
        <div>
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="-ms-2 h-8 px-2 text-muted-foreground hover:text-foreground"
          >
            <Link href={backHref}>
              <ArrowLeft className="me-1.5 h-4 w-4 rtl:rotate-180" />
              <span>{backLabel}</span>
            </Link>
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          {eyebrow && (
            <p className="text-eyebrow uppercase tracking-wider text-primary">
              {eyebrow}
            </p>
          )}
          <Heading title={title} description={description} size="heading-xl" />
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
