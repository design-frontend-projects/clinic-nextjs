// src/features/rbac/components/PermissionBadge.tsx
import { Badge } from "@/components/ui/badge";

export function PermissionBadge({ action }: { action: string }) {
  let color = "bg-blue-500/10 text-blue-500 border-blue-500/20";

  const act = action.toLowerCase();
  if (act.includes("create") || act.includes("import")) {
    color = "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
  } else if (act.includes("read") || act.includes("view") || act.includes("print")) {
    color = "bg-sky-500/10 text-sky-500 border-sky-500/20";
  } else if (act.includes("update") || act.includes("edit") || act.includes("restore")) {
    color = "bg-amber-500/10 text-amber-500 border-amber-500/20";
  } else if (
    act.includes("delete") ||
    act.includes("cancel") ||
    act.includes("reject") ||
    act.includes("refund") ||
    act.includes("archive")
  ) {
    color = "bg-rose-500/10 text-rose-500 border-rose-500/20";
  } else if (act.includes("approve") || act.includes("assign")) {
    color = "bg-indigo-500/10 text-indigo-500 border-indigo-500/20";
  } else if (act.includes("manage")) {
    color = "bg-purple-500/10 text-purple-500 border-purple-500/20";
  }

  return (
    <Badge variant="outline" className={`font-mono text-[11px] font-medium tracking-wide uppercase ${color}`}>
      {action}
    </Badge>
  );
}
