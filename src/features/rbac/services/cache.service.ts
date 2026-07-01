// src/features/rbac/services/cache.service.ts
import { cache as reactCache } from "react";

export interface ICacheStore {
  get(key: string): Promise<any>;
  set(key: string, value: any, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  clear(): Promise<void>;
}

export class InMemoryCacheStore implements ICacheStore {
  private store = new Map<string, { value: any; expiresAt: number }>();

  async get(key: string): Promise<any> {
    const item = this.store.get(key);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return item.value;
  }

  async set(key: string, value: any, ttlSeconds = 300): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000
    });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }
}

// Global singleton instance for server process persistence
const globalCacheStore = new InMemoryCacheStore();

export class CacheService {
  constructor(private cacheStore: ICacheStore = globalCacheStore) {}

  getUserPermissionsKey(tenantId: string, profileId: string): string {
    return `rbac:permissions:${tenantId}:${profileId}`;
  }

  getUserRolesKey(tenantId: string, profileId: string): string {
    return `rbac:roles:${tenantId}:${profileId}`;
  }

  getRoleHierarchyKey(tenantId: string): string {
    return `rbac:hierarchy:${tenantId}`;
  }

  async getUserPermissions(tenantId: string, profileId: string): Promise<string[] | null> {
    return this.cacheStore.get(this.getUserPermissionsKey(tenantId, profileId));
  }

  async setUserPermissions(tenantId: string, profileId: string, permissions: string[]): Promise<void> {
    await this.cacheStore.set(this.getUserPermissionsKey(tenantId, profileId), permissions, 300); // 5 min TTL
  }

  async getUserRoles(tenantId: string, profileId: string): Promise<string[] | null> {
    return this.cacheStore.get(this.getUserRolesKey(tenantId, profileId));
  }

  async setUserRoles(tenantId: string, profileId: string, roles: string[]): Promise<void> {
    await this.cacheStore.set(this.getUserRolesKey(tenantId, profileId), roles, 300);
  }

  async getRoleHierarchy(tenantId: string): Promise<any | null> {
    return this.cacheStore.get(this.getRoleHierarchyKey(tenantId));
  }

  async setRoleHierarchy(tenantId: string, hierarchy: any): Promise<void> {
    await this.cacheStore.set(this.getRoleHierarchyKey(tenantId), hierarchy, 600); // 10 min TTL
  }

  async invalidateUser(tenantId: string, profileId: string): Promise<void> {
    await this.cacheStore.del(this.getUserPermissionsKey(tenantId, profileId));
    await this.cacheStore.del(this.getUserRolesKey(tenantId, profileId));
  }

  async invalidateTenant(tenantId: string): Promise<void> {
    await this.cacheStore.del(this.getRoleHierarchyKey(tenantId));
    
    // In-memory key scan cleanup
    if (this.cacheStore instanceof InMemoryCacheStore) {
      const store = (this.cacheStore as any).store as Map<string, any>;
      for (const key of store.keys()) {
        if (
          key.startsWith(`rbac:permissions:${tenantId}:`) ||
          key.startsWith(`rbac:roles:${tenantId}:`)
        ) {
          store.delete(key);
        }
      }
    }
  }

  // React cache request deduplication (scoped to a single render pass)
  dedupedPermissionCheck = reactCache(
    async (
      checkFn: (tenantId: string, profileId: string, permission: string) => Promise<boolean>,
      tenantId: string,
      profileId: string,
      permission: string
    ): Promise<boolean> => {
      return checkFn(tenantId, profileId, permission);
    }
  );
}
export const cacheService = new CacheService();
