// src/features/rbac/components/PermissionCheckbox.tsx
import React from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type PermissionState = "allow" | "deny" | "inherited" | "none";

interface PermissionCheckboxProps {
  state: PermissionState;
  onChange?: (newState: "allow" | "deny" | "none") => void;
  disabled?: boolean;
  className?: string;
}

export function PermissionCheckbox({
  state,
  onChange,
  disabled = false,
  className
}: PermissionCheckboxProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (disabled || !onChange) return;
    
    // Cycle state: none -> allow -> deny -> none
    if (state === "none") {
      onChange("allow");
    } else if (state === "allow") {
      onChange("deny");
    } else {
      onChange("none");
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={cn(
        "flex h-6 w-6 items-center justify-center rounded border text-xs font-semibold shadow-sm transition-all focus:outline-none focus:ring-1 focus:ring-ring",
        state === "allow" && "border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600",
        state === "deny" && "border-rose-500 bg-rose-500 text-white hover:bg-rose-600",
        state === "inherited" && "border-sky-500/30 bg-sky-500/10 text-sky-500 cursor-not-allowed opacity-80",
        state === "none" && "border-hairline bg-surface hover:bg-surface-elevated",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
    >
      {state === "allow" && <Check className="h-3.5 w-3.5 stroke-[3px]" />}
      {state === "deny" && <X className="h-3.5 w-3.5 stroke-[3px]" />}
      {state === "inherited" && <Check className="h-3 w-3 opacity-80" />}
    </button>
  );
}
