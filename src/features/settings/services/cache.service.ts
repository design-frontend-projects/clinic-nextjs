// src/features/settings/services/cache.service.ts
// TTL cache for the settings module. Reuses the ICacheStore contract from the
// RBAC feature (same accepted limitation: in-memory, per server process —
// staleness is bounded by TTL; swap the store for Redis via ICacheStore).
import { ICacheStore, InMemoryCacheStore } from "@/features/rbac/services/cache.service";

const TTL = {
  definitions: 600,
  platform: 300,
  tenant: 300,
  user: 120,
  lookups: 300,
  features: 120,
  templates: 600,
} as const;

// Module-level singleton so the cache survives per-request service instances.
const globalSettingsCacheStore = new InMemoryCacheStore();

export class SettingsCacheService {
  constructor(private store: ICacheStore = globalSettingsCacheStore) {}

  // --- keys ---
  private defsKey() {
    return "settings:defs";
  }
  private platformKey() {
    return "settings:platform";
  }
  private tenantKey(tenantId: string) {
    return `settings:tenant:${tenantId}`;
  }
  private userKey(tenantId: string | null, profileId: string) {
    return `settings:user:${tenantId ?? "none"}:${profileId}`;
  }
  private lookupsKey(tenantId: string, categoryCode: string) {
    return `lookups:${tenantId}:${categoryCode}`;
  }
  private featuresKey(tenantId: string) {
    return `features:${tenantId}`;
  }
  private templatesKey(tenantId: string) {
    return `templates:${tenantId}`;
  }

  // --- definitions ---
  async getDefinitions(): Promise<unknown[] | null> {
    return this.store.get(this.defsKey());
  }
  async setDefinitions(defs: unknown[]): Promise<void> {
    await this.store.set(this.defsKey(), defs, TTL.definitions);
  }
  async invalidateDefinitions(): Promise<void> {
    await this.store.del(this.defsKey());
  }

  // --- platform values ---
  async getPlatform(): Promise<unknown[] | null> {
    return this.store.get(this.platformKey());
  }
  async setPlatform(rows: unknown[]): Promise<void> {
    await this.store.set(this.platformKey(), rows, TTL.platform);
  }
  async invalidatePlatform(): Promise<void> {
    await this.store.del(this.platformKey());
  }

  // --- tenant values ---
  async getTenant(tenantId: string): Promise<unknown[] | null> {
    return this.store.get(this.tenantKey(tenantId));
  }
  async setTenant(tenantId: string, rows: unknown[]): Promise<void> {
    await this.store.set(this.tenantKey(tenantId), rows, TTL.tenant);
  }
  async invalidateTenant(tenantId: string): Promise<void> {
    await this.store.del(this.tenantKey(tenantId));
  }

  // --- user values ---
  async getUser(tenantId: string | null, profileId: string): Promise<unknown[] | null> {
    return this.store.get(this.userKey(tenantId, profileId));
  }
  async setUser(tenantId: string | null, profileId: string, rows: unknown[]): Promise<void> {
    await this.store.set(this.userKey(tenantId, profileId), rows, TTL.user);
  }
  async invalidateUser(tenantId: string | null, profileId: string): Promise<void> {
    await this.store.del(this.userKey(tenantId, profileId));
  }

  // --- lookups ---
  async getLookups(tenantId: string, categoryCode: string): Promise<unknown[] | null> {
    return this.store.get(this.lookupsKey(tenantId, categoryCode));
  }
  async setLookups(tenantId: string, categoryCode: string, rows: unknown[]): Promise<void> {
    await this.store.set(this.lookupsKey(tenantId, categoryCode), rows, TTL.lookups);
  }
  async invalidateLookups(tenantId: string, categoryCode: string): Promise<void> {
    await this.store.del(this.lookupsKey(tenantId, categoryCode));
  }

  // --- feature decisions ---
  async getFeatures(tenantId: string): Promise<unknown | null> {
    return this.store.get(this.featuresKey(tenantId));
  }
  async setFeatures(tenantId: string, decisions: unknown): Promise<void> {
    await this.store.set(this.featuresKey(tenantId), decisions, TTL.features);
  }
  async invalidateFeatures(tenantId: string): Promise<void> {
    await this.store.del(this.featuresKey(tenantId));
  }

  // --- templates ---
  async getTemplates(tenantId: string): Promise<unknown[] | null> {
    return this.store.get(this.templatesKey(tenantId));
  }
  async setTemplates(tenantId: string, rows: unknown[]): Promise<void> {
    await this.store.set(this.templatesKey(tenantId), rows, TTL.templates);
  }
  async invalidateTemplates(tenantId: string): Promise<void> {
    await this.store.del(this.templatesKey(tenantId));
  }
}

export const settingsCacheService = new SettingsCacheService();
