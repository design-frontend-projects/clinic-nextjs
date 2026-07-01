// src/app/(dashboard)/settings/audit/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAuditLogsAction } from "@/features/rbac/actions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ClipboardList, Search, ChevronLeft, ChevronRight, Calendar, Laptop, Smartphone, Eye, EyeOff } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Query audit logs
  const { data, isLoading } = useQuery({
    queryKey: ["rbacAuditLogs", page, debouncedSearch],
    queryFn: async () => {
      const res = await getAuditLogsAction({
        page,
        limit: 15,
        search: debouncedSearch || null
      });
      if (res.error) throw new Error(res.error);
      return res.data || { logs: [], total: 0 };
    }
  });

  const logs = data?.logs || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / 15);

  const toggleExpand = (logId: string) => {
    setExpandedLogId(expandedLogId === logId ? null : logId);
  };

  return (
    <div className="space-y-6 font-inter max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-ink flex items-center gap-2">
          <ClipboardList className="h-8 w-8 text-primary" /> Security Audit Logs
        </h1>
        <p className="text-mute text-sm mt-1">
          Review a complete administrative log showing role creations, user assignments, permission updates, and IP locations.
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center bg-surface border border-hairline rounded-md p-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-mute" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by action, email, or device..."
            className="pl-9 h-9 border-hairline text-sm"
          />
        </div>
      </div>

      {/* Logs Table */}
      <div className="rounded-md border border-hairline bg-surface overflow-hidden">
        {isLoading ? (
          <div className="py-32 text-center text-sm text-mute">Loading security audit trails...</div>
        ) : logs.length === 0 ? (
          <div className="py-32 text-center text-sm text-mute italic">No audit records match your query.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-b border-hairline hover:bg-transparent">
                <TableHead className="w-[180px] font-semibold text-ink text-xs uppercase font-mono">Timestamp</TableHead>
                <TableHead className="w-[200px] font-semibold text-ink text-xs uppercase font-mono">Action</TableHead>
                <TableHead className="w-[220px] font-semibold text-ink text-xs uppercase font-mono">Actor (Who)</TableHead>
                <TableHead className="w-[150px] font-semibold text-ink text-xs uppercase font-mono">Client Details</TableHead>
                <TableHead className="text-right font-semibold text-ink text-xs uppercase font-mono">Metadata</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log: any) => {
                const isExpanded = expandedLogId === log.id;
                const date = new Date(log.created_at);

                return (
                  <React.Fragment key={log.id}>
                    <TableRow className="border-b border-hairline hover:bg-surface-elevated transition-colors">
                      <TableCell className="font-mono text-xs text-mute py-3">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{date.toLocaleDateString()} {date.toLocaleTimeString()}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <Badge variant="outline" className="font-mono uppercase text-[10px] border-hairline text-primary bg-primary/5">
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-ink py-3 truncate max-w-[220px]">
                        {log.actor_email || "system@clinicpro.com"}
                      </TableCell>
                      <TableCell className="font-mono text-[10px] text-mute py-3">
                        <div className="flex items-center gap-1.5">
                          {log.device === "Mobile" ? (
                            <Smartphone className="h-3.5 w-3.5 text-mute" />
                          ) : (
                            <Laptop className="h-3.5 w-3.5 text-mute" />
                          )}
                          <span>{log.ip_address || "127.0.0.1"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right py-3">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleExpand(log.id)}
                          className="h-8 w-8 text-primary"
                        >
                          {isExpanded ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </TableCell>
                    </TableRow>

                    {isExpanded && (
                      <TableRow className="bg-surface-elevated border-b border-hairline hover:bg-surface-elevated">
                        <TableCell colSpan={5} className="p-4">
                          <div className="rounded-md border border-hairline bg-background p-4 space-y-4 font-mono text-[11px] leading-relaxed text-mute">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <span className="font-bold text-ink uppercase">IP Address:</span> {log.ip_address || "Localhost"}
                              </div>
                              <div>
                                <span className="font-bold text-ink uppercase">Device Class:</span> {log.device}
                              </div>
                            </div>
                            <Separator className="border-hairline" />
                            <div className="space-y-1">
                              <span className="font-bold text-ink uppercase">User Agent:</span>
                              <p className="font-sans break-all">{log.user_agent || "Not captured"}</p>
                            </div>
                            <Separator className="border-hairline" />

                            <div className="grid md:grid-cols-2 gap-4">
                              {log.old_values && (
                                <div className="space-y-1">
                                  <span className="font-bold text-rose-500 uppercase">Old Values:</span>
                                  <pre className="p-2 rounded bg-surface border border-hairline overflow-x-auto text-[10px]">
                                    {JSON.stringify(log.old_values, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {log.new_values && (
                                <div className="space-y-1">
                                  <span className="font-bold text-emerald-500 uppercase">New Values:</span>
                                  <pre className="p-2 rounded bg-surface border border-hairline overflow-x-auto text-[10px]">
                                    {JSON.stringify(log.new_values, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between py-2 font-mono text-xs text-mute">
          <span>Page {page} of {totalPages} ({total} entries)</span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page === 1}
              className="h-8 text-[11px]"
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              disabled={page === totalPages}
              className="h-8 text-[11px]"
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
