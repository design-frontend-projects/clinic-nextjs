// src/features/settings/services/vault.service.ts
// Secret storage behind an interface. The default implementation is Supabase
// Vault (vault.create_secret / vault.decrypted_secrets), reached with
// parameterized $queryRaw through the app's normal database connection.
//
// RISK / CONTINGENCY: if the DATABASE_URL role lacks vault grants (see
// prisma/migrations/12_notifications.sql section 4), swap this file's exported
// singleton for an AES-256-GCM implementation keyed by a
// SETTINGS_ENCRYPTION_KEY env var — the ISecretStore contract is the seam.
//
// Secrets NEVER leave the server: actions only ever expose { hasSecret: true }.
import { prisma } from "@/lib/prisma";

export interface ISecretStore {
  /** Stores a secret; returns its opaque reference id. */
  create(name: string, secret: string, description?: string): Promise<string>;
  /** Replaces the secret behind an existing reference. */
  update(id: string, secret: string): Promise<void>;
  /** Reads the plaintext secret (server-side senders/tests only). */
  read(id: string): Promise<string | null>;
  delete(id: string): Promise<void>;
  /** True when the backing store is reachable with the current DB role. */
  isAvailable(): Promise<boolean>;
}

export class VaultSecretStore implements ISecretStore {
  async create(name: string, secret: string, description = ""): Promise<string> {
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT vault.create_secret(${secret}, ${name}, ${description}) AS id
    `;
    const id = rows[0]?.id;
    if (!id) throw new Error("Vault did not return a secret id");
    return id;
  }

  async update(id: string, secret: string): Promise<void> {
    await prisma.$queryRaw`
      SELECT vault.update_secret(${id}::uuid, ${secret})
    `;
  }

  async read(id: string): Promise<string | null> {
    const rows = await prisma.$queryRaw<{ decrypted_secret: string }[]>`
      SELECT decrypted_secret FROM vault.decrypted_secrets WHERE id = ${id}::uuid
    `;
    return rows[0]?.decrypted_secret ?? null;
  }

  async delete(id: string): Promise<void> {
    await prisma.$executeRaw`
      DELETE FROM vault.secrets WHERE id = ${id}::uuid
    `;
  }

  async isAvailable(): Promise<boolean> {
    try {
      await prisma.$queryRaw`SELECT 1 FROM vault.decrypted_secrets LIMIT 0`;
      return true;
    } catch {
      return false;
    }
  }
}

/** Naming convention keeps Vault entries traceable back to their owner. */
export function channelSecretName(tenantId: string, channelType: string): string {
  return `tenant:${tenantId}:channel:${channelType}`;
}

export const secretStore: ISecretStore = new VaultSecretStore();
