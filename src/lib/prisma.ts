import { PrismaClient } from "@prisma/client";
import { statSync } from "fs";
import { createRequire } from "module";
import path from "path";
import { Pool, type PoolConfig } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { softDeleteExtension } from "./prisma-soft-delete";
import { transientRetryExtension } from "./prisma-retry";

// Setup adapter inside PrismaClient to fulfill Prisma 7 requirements
const rawDatabaseUrl = process.env.DATABASE_URL?.trim();

function warnIfDatabaseUrlSuspicious(urlStr: string | undefined): void {
  if (!urlStr) {
    console.error(
      "[prisma] DATABASE_URL is not set. Database queries will fail until it is configured.",
    );
    return;
  }
  try {
    const parsed = new URL(urlStr);
    const host = parsed.hostname;
    if (
      process.env.NODE_ENV === "production" &&
      host &&
      !host.includes(".") &&
      host !== "localhost"
    ) {
      console.error(
        `[prisma] DATABASE_URL resolved to single-label host "${host}" (port ${parsed.port || "default"}). ` +
          `If you are using Supabase, check for unencoded special characters in the password (e.g. @ -> %40, # -> %23) ` +
          `or shell $VAR interpolation in your deployment platform (enable "Is Literal" in Coolify).`,
      );
    }
  } catch {
    console.error(
      "[prisma] DATABASE_URL is not a valid URL. Check for unencoded special characters in the password or invalid formatting.",
    );
  }
}

warnIfDatabaseUrlSuspicious(rawDatabaseUrl);

const isProduction = process.env.NODE_ENV === "production";

export const DEFAULT_PG_POOL_MAX = 10;
export const DEFAULT_PG_IDLE_TIMEOUT_MS = 60_000;
export const DEFAULT_PG_CONNECTION_TIMEOUT_MS = 15_000;
export const DEFAULT_PG_KEEPALIVE_INITIAL_DELAY_MS = 10_000;

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const trimmed = raw?.trim();
  if (!trimmed || !/^\d+$/.test(trimmed)) return fallback;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Build pg.Pool configuration from environment variables with resilient defaults
 * for Supabase PgBouncer/Supavisor connections.
 */
export function buildPoolConfig(
  env: Record<string, string | undefined> = process.env,
): PoolConfig {
  return {
    connectionString: env.DATABASE_URL?.trim() ?? "",
    max: parsePositiveInt(env.PG_POOL_MAX, DEFAULT_PG_POOL_MAX),
    idleTimeoutMillis: parsePositiveInt(
      env.PG_IDLE_TIMEOUT_MS,
      DEFAULT_PG_IDLE_TIMEOUT_MS,
    ),
    connectionTimeoutMillis: parsePositiveInt(
      env.PG_CONNECTION_TIMEOUT_MS,
      DEFAULT_PG_CONNECTION_TIMEOUT_MS,
    ),
    keepAlive: true,
    keepAliveInitialDelayMillis: DEFAULT_PG_KEEPALIVE_INITIAL_DELAY_MS,
  };
}

const globalForPrisma = globalThis as unknown as {
  prismaPool: Pool | undefined;
  prismaPoolConfigKey: string | undefined;
  prismaBase: PrismaClient | undefined;
  prismaExtended: PrismaClient | undefined;
  prismaSchemaMtime: number | null | undefined;
};

function createPool(config: PoolConfig): Pool {
  const newPool = new Pool(config);

  // Prevent unhandled EventEmitter errors from crashing the Node.js process when
  // Supabase PgBouncer terminates an idle backend connection.
  newPool.on("error", (err) => {
    console.error("[pg.Pool] Unexpected error on idle client:", err);
  });

  return newPool;
}

const poolConfig = buildPoolConfig();
const poolConfigKey = JSON.stringify({
  connectionString: poolConfig.connectionString,
  max: poolConfig.max,
  idleTimeoutMillis: poolConfig.idleTimeoutMillis,
  connectionTimeoutMillis: poolConfig.connectionTimeoutMillis,
  keepAlive: poolConfig.keepAlive,
  keepAliveInitialDelayMillis: poolConfig.keepAliveInitialDelayMillis,
});

function getOrCreatePool(): Pool {
  if (isProduction) {
    return createPool(poolConfig);
  }

  if (
    globalForPrisma.prismaPool &&
    globalForPrisma.prismaPoolConfigKey === poolConfigKey
  ) {
    return globalForPrisma.prismaPool;
  }

  if (globalForPrisma.prismaPool) {
    void (globalForPrisma.prismaBase as { $disconnect?: () => Promise<void> } | undefined)
      ?.$disconnect?.()
      .catch(() => {});
    void globalForPrisma.prismaPool.end().catch(() => {});
    globalForPrisma.prismaBase = undefined;
    globalForPrisma.prismaExtended = undefined;
  }

  const nextPool = createPool(poolConfig);
  globalForPrisma.prismaPool = nextPool;
  globalForPrisma.prismaPoolConfigKey = poolConfigKey;
  return nextPool;
}

const pool = getOrCreatePool();

const adapter = new PrismaPg(pool);

type RuntimeField = { name: string };
type RuntimeClient = PrismaClient & {
  _runtimeDataModel?: {
    models?: Record<string, { fields?: RuntimeField[] }>;
  };
};

// Keep package specifiers non-literal so Turbopack/Webpack do not statically
// rewrite `createRequire(...).cache` or `nodeReq(pkg)` into bundler module caches.
const PRISMA_CLIENT_PKG = ["@prisma", "client"].join("/");
const GENERATED_PRISMA_ENTRY = [".prisma", "client", "index.js"].join("/");
const DEV_SCHEMA_CHECK_INTERVAL_MS = 1_000;
const NON_DELEGATE_PROPS = new Set([
  "then",
  "catch",
  "finally",
  "toJSON",
  "toString",
  "valueOf",
]);

function getNodeRequire(fromPath: string): NodeRequire {
  return createRequire(fromPath);
}

function getGeneratedClientMtime(): number | null {
  try {
    const rootReq = getNodeRequire(path.join(process.cwd(), "package.json"));
    const clientEntry = rootReq.resolve(PRISMA_CLIENT_PKG);
    const clientReq = getNodeRequire(clientEntry);
    const generatedEntry = clientReq.resolve(GENERATED_PRISMA_ENTRY);
    return statSync(generatedEntry).mtimeMs;
  } catch {
    return null;
  }
}

export function hasCurrentSchema(client: PrismaClient | undefined): client is PrismaClient {
  if (!client) return false;
  const runtime = client as RuntimeClient;
  if (!("billing_catalog_items" in runtime)) return false;
  if (!("clinic_branches" in runtime)) return false;
  if (!("patient_body_charts" in runtime)) return false;
  const clinicFields = runtime._runtimeDataModel?.models?.clinics?.fields;
  if (
    Array.isArray(clinicFields) &&
    !clinicFields.some((f) => f.name === "specialty_id")
  ) {
    return false;
  }
  const providerFields = runtime._runtimeDataModel?.models?.insurance_providers?.fields;
  if (
    Array.isArray(providerFields) &&
    !providerFields.some((f) => f.name === "consultation_deduction_type")
  ) {
    return false;
  }
  const branchFields = runtime._runtimeDataModel?.models?.branches?.fields;
  if (
    Array.isArray(branchFields) &&
    !branchFields.some((f) => f.name === "owner_id")
  ) {
    return false;
  }
  const medicationFields = runtime._runtimeDataModel?.models?.medications?.fields;
  if (
    Array.isArray(medicationFields) &&
    !medicationFields.some((f) => f.name === "default_dosage")
  ) {
    return false;
  }
  const appointmentFields = runtime._runtimeDataModel?.models?.appointments?.fields;
  if (
    Array.isArray(appointmentFields) &&
    !appointmentFields.some((f) => f.name === "catalog_item_id")
  ) {
    return false;
  }
  return true;
}

function loadFreshPrismaClientFromDisk(): PrismaClient | null {
  try {
    const nodeReq = getNodeRequire(path.join(process.cwd(), "package.json"));
    const cache = Reflect.get(nodeReq, "cache") as Record<string, unknown> | undefined;
    if (cache) {
      for (const key of Object.keys(cache)) {
        if (
          key.includes(".prisma") ||
          key.includes("@prisma/client") ||
          key.includes("@prisma\\client")
        ) {
          delete cache[key];
        }
      }
    }
    const mod = nodeReq(PRISMA_CLIENT_PKG) as {
      PrismaClient: typeof PrismaClient;
    };
    return new mod.PrismaClient({ adapter });
  } catch {
    return null;
  }
}

function createPrismaClient(forceReloadFromDisk = false): PrismaClient {
  if (!isProduction && forceReloadFromDisk) {
    const fresh = loadFreshPrismaClientFromDisk();
    if (fresh) return fresh;
  }

  const initial = new PrismaClient({ adapter });
  if (hasCurrentSchema(initial) || isProduction) {
    return initial;
  }

  // In development, if `prisma generate` ran while `next dev` was already running,
  // Node's CJS require cache may still hold the pre-generate `.prisma/client` DMMF.
  return loadFreshPrismaClientFromDisk() ?? initial;
}

function extendWithSoftDelete(base: PrismaClient): PrismaClient {
  // The `$extends` return type is structurally different from PrismaClient (it
  // drops $connect/$on/$use, none of which this app uses), which would ripple type
  // errors through code that passes `prisma`/`tx` as PrismaClient/TransactionClient.
  // Neither extension alters query result/input types, so we cast back to
  // PrismaClient to keep the public surface identical; both hooks still run at runtime.
  return base
    .$extends(transientRetryExtension)
    .$extends(softDeleteExtension) as unknown as PrismaClient;
}

let lastSchemaCheckAt = 0;

function ensureCurrentDevClients(missingProp?: string): {
  base: PrismaClient;
  extended: PrismaClient;
} {
  const now = Date.now();
  const cachedBase = globalForPrisma.prismaBase;
  const cachedExtended = globalForPrisma.prismaExtended;

  const missingOnCached =
    missingProp !== undefined &&
    !missingProp.startsWith("_") &&
    !NON_DELEGATE_PROPS.has(missingProp) &&
    cachedBase !== undefined &&
    !(missingProp in cachedBase);

  const shouldCheckDisk =
    !cachedBase ||
    !cachedExtended ||
    missingOnCached ||
    now - lastSchemaCheckAt >= DEV_SCHEMA_CHECK_INTERVAL_MS;

  if (!shouldCheckDisk && cachedBase && cachedExtended) {
    return { base: cachedBase, extended: cachedExtended };
  }

  lastSchemaCheckAt = now;
  const currentMtime = getGeneratedClientMtime();
  const mtimeChanged =
    currentMtime !== null && globalForPrisma.prismaSchemaMtime !== currentMtime;

  if (
    cachedBase &&
    cachedExtended &&
    hasCurrentSchema(cachedBase) &&
    !mtimeChanged
  ) {
    return { base: cachedBase, extended: cachedExtended };
  }

  const forceReload = mtimeChanged || !hasCurrentSchema(cachedBase);
  const nextBase = createPrismaClient(forceReload);
  const nextExtended = extendWithSoftDelete(nextBase);

  if (cachedBase && cachedBase !== nextBase) {
    void (cachedBase as { $disconnect?: () => Promise<void> }).$disconnect?.().catch(() => {});
  }

  globalForPrisma.prismaBase = nextBase;
  globalForPrisma.prismaExtended = nextExtended;
  globalForPrisma.prismaSchemaMtime = currentMtime;

  return { base: nextBase, extended: nextExtended };
}

function createDevReloadProxy(kind: "base" | "extended"): PrismaClient {
  const resolveClient = (prop?: PropertyKey): PrismaClient => {
    const clients = ensureCurrentDevClients(typeof prop === "string" ? prop : undefined);
    return kind === "base" ? clients.base : clients.extended;
  };

  return new Proxy({} as PrismaClient, {
    get(_target, prop) {
      const client = resolveClient(prop);
      const value = Reflect.get(client, prop, client);
      return typeof value === "function" ? value.bind(client) : value;
    },
    has(_target, prop) {
      return prop in resolveClient(prop);
    },
    ownKeys() {
      return Reflect.ownKeys(resolveClient());
    },
    getOwnPropertyDescriptor(_target, prop) {
      return Reflect.getOwnPropertyDescriptor(resolveClient(prop), prop);
    },
  });
}

// Base client — NO soft-delete filter. Use ONLY where tombstoned rows
// (deleted_at != null) must be visible, e.g. the RXDB sync PULL handler that
// propagates deletes to clients.
const prodBase = isProduction ? createPrismaClient() : undefined;

export const prismaBase: PrismaClient = isProduction
  ? (prodBase as PrismaClient)
  : (() => {
      ensureCurrentDevClients();
      return createDevReloadProxy("base");
    })();

// App-facing client — transparently excludes soft-deleted rows from reads on the
// clinical tables (see prisma-soft-delete.ts). Import THIS in server actions.
export const prisma: PrismaClient = isProduction
  ? extendWithSoftDelete(prodBase as PrismaClient)
  : createDevReloadProxy("extended");
