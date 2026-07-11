import { PrismaClient } from "@prisma/client";
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

// Base client — NO soft-delete filter. Use ONLY where tombstoned rows
// (deleted_at != null) must be visible, e.g. the RXDB sync PULL handler that
// propagates deletes to clients.
export const prismaBase =
  globalForPrisma.prismaBase ?? new PrismaClient({ adapter });

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
