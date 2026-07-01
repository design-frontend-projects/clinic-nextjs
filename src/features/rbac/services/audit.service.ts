// src/features/rbac/services/audit.service.ts
import { headers } from "next/headers";
import { RBACRepository } from "../repositories/rbac.repository";

export class AuditService {
  constructor(private repo: RBACRepository = new RBACRepository()) {}

  private parseDevice(userAgent: string | null): string {
    if (!userAgent) return "Unknown";
    const ua = userAgent.toLowerCase();
    if (ua.includes("mobi") || ua.includes("android") || ua.includes("iphone")) {
      return "Mobile";
    }
    if (ua.includes("tablet") || ua.includes("ipad")) {
      return "Tablet";
    }
    return "Desktop";
  }

  async logChange(
    tenantId: string,
    action: string,
    payload: {
      actorId: string | null;
      actorEmail: string | null;
      entityType: string | null;
      entityId: string | null;
      oldValues: Record<string, any> | null;
      newValues: Record<string, any> | null;
    }
  ) {
    let ipAddress: string | null = null;
    let userAgent: string | null = null;
    let device: string = "Unknown";

    try {
      const requestHeaders = await headers();
      ipAddress = requestHeaders.get("x-forwarded-for")?.split(",")[0] || requestHeaders.get("x-real-ip");
      userAgent = requestHeaders.get("user-agent");
      device = this.parseDevice(userAgent);
    } catch {
      // Headers not accessible (e.g. running in test context or background worker)
    }

    return this.repo.createAuditLog(
      tenantId,
      action,
      payload.actorId,
      payload.actorEmail,
      payload.entityType,
      payload.entityId,
      payload.oldValues,
      payload.newValues,
      ipAddress,
      userAgent,
      device
    );
  }

  async getLogs(tenantId: string, query: any) {
    const logs = await this.repo.findAuditLogs(tenantId, query);
    const total = await this.repo.countAuditLogs(tenantId, query);
    return { logs, total };
  }
}
export const auditService = new AuditService();
