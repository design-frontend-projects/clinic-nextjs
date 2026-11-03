import { PrismaClient } from "@prisma/client";
import { createRequire } from "module";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { softDeleteExtension } from "./prisma-soft-delete";

// Setup adapter inside PrismaClient to fulfill Prisma 7 requirements
const connectionString = `${process.env.DATABASE_URL}`;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const globalForPrisma = globalThis as unknown as {
  prismaBase: PrismaClient | undefined;
};

type RuntimeField = { name: string };
type RuntimeClient = PrismaClient & {
  _runtimeDataModel?: {
    models?: Record<string, { fields?: RuntimeField[] }>;
  };
};

function hasCurrentSchema(client: PrismaClient | undefined): client is PrismaClient {
  if (!client) return false;
  const runtime = client as RuntimeClient;
  if (!("billing_catalog_items" in runtime)) return false;
  const providerFields = runtime._runtimeDataModel?.models?.insurance_providers?.fields;
  if (
    Array.isArray(providerFields) &&
    !providerFields.some((f) => f.name === "consultation_deduction_type")
  ) {
    return false;
  }
  return true;
}

function createPrismaClient(): PrismaClient {
  const initial = new PrismaClient({ adapter });
  if (hasCurrentSchema(initial) || process.env.NODE_ENV === "production") {
    return initial;
  }

  // In development, if `prisma generate` ran while `next dev` was already running,
  // Node's CJS require cache may still hold the pre-generate `.prisma/client` DMMF.
  try {
    const req = createRequire(import.meta.url);
    for (const key of Object.keys(req.cache)) {
      if (
        key.includes(".prisma") ||
        key.includes("@prisma/client") ||
        key.includes("@prisma\\client")
      ) {
        delete req.cache[key];
      }
    }
    const { PrismaClient: FreshPrismaClient } = req("@prisma/client") as {
      PrismaClient: typeof PrismaClient;
    };
    return new FreshPrismaClient({ adapter });
  } catch {
    return initial;
  }
}

// Base client — NO soft-delete filter. Use ONLY where tombstoned rows
// (deleted_at != null) must be visible, e.g. the RXDB sync PULL handler that
// propagates deletes to clients.
export const prismaBase = hasCurrentSchema(globalForPrisma.prismaBase)
  ? globalForPrisma.prismaBase
  : createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prismaBase = prismaBase;

// App-facing client — transparently excludes soft-deleted rows from reads on the
// clinical tables (see prisma-soft-delete.ts). Import THIS in server actions.
//
// The `$extends` return type is structurally different from PrismaClient (it
// drops $connect/$on/$use, none of which this app uses), which would ripple type
// errors through code that passes `prisma`/`tx` as PrismaClient/TransactionClient.
// The soft-delete extension adds no new types, so we cast back to PrismaClient to
// keep the public surface identical; the query hook still runs at runtime.
export const prisma = prismaBase.$extends(softDeleteExtension) as unknown as PrismaClient;
