import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireTenantInfo } from "@/lib/auth";
import { COLLECTION_BY_NAME } from "@/lib/offline/collection-registry";
import {
  pushChangesForClinic,
  type PushRow,
} from "@/lib/offline/sync-server/pull-push";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const pushRequestSchema = z.object({
  collection: z
    .string()
    .refine((c) => COLLECTION_BY_NAME.has(c), "Unknown sync collection"),
  rows: z
    .array(
      z.object({
        newDocumentState: z.record(z.string(), z.unknown()),
        assumedMasterState: z
          .record(z.string(), z.unknown())
          .nullable()
          .optional(),
      }),
    )
    .max(200),
});

function errorStatus(message: string): number {
  if (message.startsWith("Unauthorized")) return 401;
  if (message.startsWith("Forbidden")) return 403;
  return 500;
}

/**
 * Parallel RXDB push endpoint. Replaces serialized Next.js Server Actions so
 * offline mutations upload concurrently per collection.
 */
export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = pushRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid push payload" },
        { status: 400 },
      );
    }

    const spec = COLLECTION_BY_NAME.get(parsed.data.collection);
    if (!spec) {
      return NextResponse.json(
        { error: "Unknown sync collection" },
        { status: 400 },
      );
    }

    const tenant = await requireTenantInfo();
    const conflicts = await pushChangesForClinic(
      spec,
      tenant.clinicId,
      tenant.branchId ?? null,
      parsed.data.rows as PushRow[],
    );

    return NextResponse.json(
      { conflicts },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Sync push failed";
    return NextResponse.json(
      { error: message },
      { status: errorStatus(message), headers: { "Cache-Control": "no-store" } },
    );
  }
}
